/* Dragonwatch server — static files + REST API backed by SQLite, with accounts.
   Zero dependencies: uses Node's built-in http, crypto and node:sqlite (Node >= 22.5).

   Safety features: password accounts (scrypt) with per-account data, HttpOnly session cookies, login throttling,
   CSRF checks, rate limits, strict security headers, WAL database with startup integrity check, automatic daily
   backups, a recycle bin (30 days), a private player-view room code per account and an activity log. */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
let encounterGen = null;   // SRD monster data for the Encounter lab dialog (encounter.js + monsters.json); the rest of the app works without it
try { encounterGen = require('./encounter'); encounterGen.options(); } catch (e) { encounterGen = null; console.warn('SRD monster data unavailable:', e.message); }
let srdCache = null;
const srdRecords = () => srdCache || (srdCache = JSON.parse(fs.readFileSync(path.join(__dirname, 'monsters.json'), 'utf8')));

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, 'app'));
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === '1';          // anyone may create an account (off: only an admin can)
const TRUST_PROXY = process.env.TRUST_PROXY === '1';            // behind a reverse proxy that sets X-Forwarded-*
const COOKIE_PATH = (process.env.BASE_PATH || '/').replace(/\/*$/, '/');       // set to e.g. /dragonwatch/ when a proxy serves the app under a path
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';        // force the Secure flag (use with HTTPS)
const TRASH_DAYS = 30, BACKUP_KEEP = 14, SESSION_DAYS = 30;
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'dragonwatch.db');
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash  TEXT NOT NULL,
    is_admin   INTEGER NOT NULL DEFAULT 0,
    room       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    ip         TEXT
  );
  CREATE TABLE IF NOT EXISTS audit (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    at      TEXT NOT NULL DEFAULT (datetime('now')),
    ip      TEXT,
    action  TEXT NOT NULL,
    detail  TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS combat_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data    TEXT NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS characters (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id      INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    player           TEXT NOT NULL DEFAULT '',
    class            TEXT NOT NULL DEFAULT '',
    level            INTEGER NOT NULL DEFAULT 1,
    max_hp           INTEGER NOT NULL DEFAULT 10,
    current_hp       INTEGER NOT NULL DEFAULT 0,
    ac               INTEGER NOT NULL DEFAULT 10,
    init_mod         INTEGER NOT NULL DEFAULT 0,
    passive_perception INTEGER NOT NULL DEFAULT 10,
    notes            TEXT NOT NULL DEFAULT '',
    resources        TEXT NOT NULL DEFAULT '[]',
    combat           TEXT NOT NULL DEFAULT '{}',
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
  CREATE TABLE IF NOT EXISTS bestiary (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL COLLATE NOCASE,
    data       TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS encounters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,   -- NULL = available in every campaign
    name        TEXT NOT NULL COLLATE NOCASE,
    data        TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const hasCol = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
const addCol = (t, c, ddl) => { if (!hasCol(t, c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${ddl}`); };
addCol('users', 'must_change', 'INTEGER NOT NULL DEFAULT 0');
// Migrations for databases created by older versions
if (!hasCol('characters', 'current_hp')) { db.exec('ALTER TABLE characters ADD COLUMN current_hp INTEGER NOT NULL DEFAULT 0'); db.exec('UPDATE characters SET current_hp = max_hp'); }
addCol('characters', 'temp_hp', 'INTEGER NOT NULL DEFAULT 0');
addCol('characters', 'classes', "TEXT NOT NULL DEFAULT '[]'");
addCol('characters', 'resources', "TEXT NOT NULL DEFAULT '[]'");
addCol('characters', 'combat', "TEXT NOT NULL DEFAULT '{}'");
addCol('characters', 'deleted_at', 'TEXT');
addCol('campaigns', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
addCol('campaigns', 'deleted_at', 'TEXT');
addCol('encounters', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
addCol('encounters', 'deleted_at', 'TEXT');
if (!hasCol('bestiary', 'user_id')) {   // old table had a global UNIQUE(name): rebuild it per user
  db.exec(`BEGIN;
    CREATE TABLE bestiary_new (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL COLLATE NOCASE,
      data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT);
    INSERT INTO bestiary_new (id, name, data, created_at) SELECT id, name, data, created_at FROM bestiary;
    DROP TABLE bestiary; ALTER TABLE bestiary_new RENAME TO bestiary;
  COMMIT;`);
}
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS uq_bestiary ON bestiary(user_id, name) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
  CREATE INDEX IF NOT EXISTS idx_encounters_user ON encounters(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

// Startup safety check: refuse to serve (and say why) if the database file is damaged
let dbOk = true, dbProblem = '';
try { const r = db.prepare('PRAGMA quick_check').all(); if (!(r.length === 1 && Object.values(r[0])[0] === 'ok')) { dbOk = false; dbProblem = 'quick_check failed'; } }
catch (e) { dbOk = false; dbProblem = String(e.message || e); }
if (!dbOk) console.error(`!! DATABASE INTEGRITY CHECK FAILED (${dbProblem}). The server will answer 503 until you restore a backup from ${BACKUP_DIR}.`);
let persistent = true;
try { const t = path.join(DATA_DIR, '.write-test'); fs.writeFileSync(t, String(Date.now())); fs.unlinkSync(t); } catch (e) { persistent = false; console.error('!! Data directory is not writable:', e.message); }

/* ---------- helpers ---------- */
class HttpError extends Error { constructor(status, msg, headers) { super(msg); this.status = status; this.headers = headers; } }

const str = (v, max, required = false, field = 'value') => {
  const s = (v == null ? '' : String(v)).trim().slice(0, max);
  if (required && !s) throw new HttpError(400, `${field} is required`);
  return s;
};
const int = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
};
const RESTS = ['long', 'short', 'none'];
/** Class resources: [{ name, cur, max, rest: 'long'|'short'|'none', slot?: true }] */
const cleanResources = list => {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map(r => {
    const name = str(r && r.name, 40);
    if (!name) return null;
    const max = int(r.max, 0, 999, 1);
    const out = { name, cur: int(r.cur, 0, max, max), max, rest: RESTS.includes(r.rest) ? r.rest : 'long' };
    if (r.slot) out.slot = true;
    return out;
  }).filter(Boolean);
};
/** Optional real attack numbers for the win chance and the Encounter lab: { atk, nat, dmg }. A missing key means "use the class table". */
const cleanCombat = v => {
  let a = v;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = {}; } }
  if (!a || typeof a !== 'object') return {};
  const num = (x, min, max) => { if (x === '' || x == null) return null; const n = Number(x); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n * 2) / 2)) : null; };
  const out = {}, atk = num(a.atk, -5, 30), nat = num(a.nat, 1, 12), dmg = num(a.dmg, 0, 300);
  if (atk != null) out.atk = atk; if (nat != null) out.nat = Math.round(nat); if (dmg != null) out.dmg = dmg;
  return out;
};
/** Classes: [{ name, level }]. Older characters only have a single class and level, which become one entry. */
const cleanClasses = v => {
  let a = v;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = []; } }
  if (!Array.isArray(a)) return [];
  const out = [];
  for (const c of a.slice(0, 12)) {
    if (!c || typeof c !== 'object') continue;
    const name = str(c.name, 60), level = int(c.level, 1, 30, 1), at = out.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
    if (at >= 0) out[at].level = Math.min(30, out[at].level + level); else out.push({ name, level });
  }
  return out;
};
const classesOf = row => {
  if (!row || typeof row !== 'object') return [];
  const have = cleanClasses(row.classes);
  if (have.length) return have;
  return row.class !== undefined || row.level !== undefined ? [{ name: str(row.class, 60), level: int(row.level, 1, 30, 1) }] : [];
};
const hydrate = row => row && Object.assign({}, row, { classes: classesOf(row), resources: (() => { try { return JSON.parse(row.resources || '[]'); } catch { return []; } })(), combat: cleanCombat(row.combat) });
const charFields = (b, base = {}) => {
  const max_hp = int(b.max_hp ?? base.max_hp, 1, 9999, 10);
  const had = classesOf(base);
  let classes;
  if (b.classes !== undefined) classes = cleanClasses(b.classes);
  else if (b.class !== undefined || b.level !== undefined) {
    // a plain class/level (older exports, scripts) can only describe a single-class character
    classes = had.length > 1 ? had : [{ name: str(b.class ?? base.class, 60), level: int(b.level ?? base.level, 1, 30, 1) }];
  } else classes = had;
  if (!classes.length) classes = [{ name: '', level: 1 }];
  return {
    name: str(b.name ?? base.name, 100, true, 'name'),
    player: str(b.player ?? base.player, 100),
    classes,
    class: classes.map(c => c.name).filter(Boolean).join(' / ').slice(0, 100),
    level: Math.min(30, classes.reduce((a, c) => a + c.level, 0)),
    max_hp,
    // new characters start at full health; current HP can never exceed max HP
    current_hp: int(b.current_hp ?? base.current_hp ?? max_hp, 0, max_hp, max_hp),
    temp_hp: int(b.temp_hp ?? base.temp_hp, 0, 999, 0),
    ac: int(b.ac ?? base.ac, 0, 99, 10),
    init_mod: int(b.init_mod ?? base.init_mod, -20, 30, 0),
    passive_perception: int(b.passive_perception ?? base.passive_perception, 0, 99, 10),
    notes: str(b.notes ?? base.notes, 2000),
    resources: cleanResources(b.resources ?? base.resources),
    combat: cleanCombat(b.combat ?? base.combat),
  };
};

const DMG_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
const typeList = l => (Array.isArray(l) ? [...new Set(l.filter(t => DMG_TYPES.includes(t)))] : []);
/** A favourite monster template: what is needed to summon it again. */
const cleanFav = b => {
  const def = b.def || {};
  const abil = (Array.isArray(b.abil) ? b.abil : []).slice(0, 12).map(a => {
    if (!Array.isArray(a)) return null;
    const kind = a[0];
    if (kind === 'lr' || kind === 'la') return [kind, int(a[1], 1, 20, 1)];
    if (kind === 'recharge') return str(a[1], 60) ? [kind, str(a[1], 60), int(a[2], 2, 6, 5)] : null;
    if (kind === 'uses') return str(a[1], 60) ? [kind, str(a[1], 60), int(a[2], 1, 99, 1)] : null;
    return null;
  }).filter(Boolean);
  const out = {
    name: str(b.name, 100, true, 'name'),
    type: ['monster', 'npc', 'pc'].includes(b.type) ? b.type : 'monster',
    hp: int(b.hp, 1, 9999, 10), ac: int(b.ac, 0, 99, 10), mod: int(b.mod, -20, 30, 0),
    cr: str(b.cr, 10), kind: str(b.kind, 60), notes: str(b.notes, 2000), abil,
    def: { res: typeList(def.res), imm: typeList(def.imm), vul: typeList(def.vul), nm: typeList(def.nm) },
  };
  const atk = cleanAtk(b.atk); if (atk) out.atk = atk;      // optional: lets the Encounter lab predict fights that include this monster
  return out;
};
/** Attack numbers used by the Encounter lab: attacks per round, to-hit bonus, average damage per hit. */
const cleanAtk = a => {
  if (!a || typeof a !== 'object') return null;
  const dmg = Math.round(Number(a.dmg) * 10) / 10;
  if (!Number.isFinite(dmg) || dmg <= 0) return null;
  return { n: int(a.n, 1, 10, 1), hit: int(a.hit, -5, 30, 0), dmg: Math.min(dmg, 500) };
};
/** A saved encounter: a named list of monster templates with a count each (never live HP, conditions or initiative). */
const cleanEncounter = b => {
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map(it => ({ ...cleanFav(it || {}), count: int(it && it.count, 1, 30, 1) }));
  if (!items.length) throw new HttpError(400, 'an encounter needs at least one creature');
  return { name: str(b.name, 100, true, 'name'), items };
};
const favRow = r => ({ id: r.id, ...JSON.parse(r.data || '{}') });
const encRow = r => ({ id: r.id, campaign_id: r.campaign_id, ...JSON.parse(r.data || '{}') });

/* ---------- security helpers ---------- */
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const ROOM_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const ROOM_RE = /^[a-hjkmnp-z2-9]{10}$/;
const newRoom = () => {
  for (;;) {
    let s = ''; for (const x of crypto.randomBytes(10)) s += ROOM_CHARS[x % ROOM_CHARS.length];
    if (!db.prepare('SELECT 1 FROM users WHERE room = ?').get(s)) return s;
  }
};
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
async function hashPassword(pw) { const salt = crypto.randomBytes(16); return `scrypt1$${salt.toString('base64')}$${(await scrypt(pw, salt)).toString('base64')}`; }
async function checkPassword(pw, stored) {
  const [tag, s, h] = String(stored).split('$');
  if (tag !== 'scrypt1' || !s || !h) return false;
  const k = await scrypt(pw, Buffer.from(s, 'base64')), want = Buffer.from(h, 'base64');
  return k.length === want.length && crypto.timingSafeEqual(k, want);
}
let dummyHash = null;   // checked when the username is unknown, so timing does not reveal which usernames exist
const COMMON = new Set(['password', 'passwordpassword', '1234567890', '12345678910', 'qwertyuiop', 'letmein123', 'iloveyou123', 'welcome123', 'dragonwatch', 'dungeonmaster']);
function cleanUsername(v) {
  const u = String(v == null ? '' : v).trim();
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(u)) throw new HttpError(400, 'Username: 3–32 letters, numbers, dots, dashes or underscores.');
  return u;
}
function checkNewPassword(pw, username) {
  if (typeof pw !== 'string' || pw.length < 10) throw new HttpError(400, 'Password must be at least 10 characters.');
  if (pw.length > 200) throw new HttpError(400, 'Password is too long (200 characters maximum).');
  if (COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) throw new HttpError(400, 'That password is too easy to guess.');
  if (username && username.length >= 3 && pw.toLowerCase().includes(username.toLowerCase())) throw new HttpError(400, 'Password must not contain your username.');
}

/* rate limits and login lockout (in memory) */
const buckets = new Map(), fails = new Map();
function hit(key, limit, windowMs) {   // returns 0 if allowed, else seconds to wait
  const now = Date.now(); let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  return ++b.n <= limit ? 0 : Math.ceil((b.reset - now) / 1000);
}
const lockedFor = key => { const f = fails.get(key); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; };
function noteFail(key, max) {
  const now = Date.now(); let f = fails.get(key);
  if (!f || f.expires <= now) f = { n: 0, expires: now + 15 * 60e3, until: 0 };
  if (++f.n >= max) f.until = now + 15 * 60e3;
  fails.set(key, f);
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k); for (const [k, f] of fails) if (f.expires <= now && f.until <= now) fails.delete(k); }, 60e3).unref();

const clientIp = req => {
  if (TRUST_PROXY) { const x = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (x) return x.slice(0, 64); }
  return String(req.socket.remoteAddress || '').slice(0, 64);
};
const isHttps = req => COOKIE_SECURE || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https');
const COOKIE = 'dw_session';
const parseCookies = h => Object.fromEntries(String(h || '').split(';').map(p => { const i = p.indexOf('='); return i < 0 ? null : [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }).filter(Boolean));
const sessionCookie = (req, token, maxAge) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=${COOKIE_PATH}; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;

function secHeaders(req) {
  const h = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.open5e.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  if (req && isHttps(req)) h['Strict-Transport-Security'] = 'max-age=31536000';
  return h;
}

/* ---------- prepared statements ---------- */
const q = {
  countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
  countAdmins: db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1'),
  getUser: db.prepare('SELECT id, username, is_admin, room, must_change, created_at, last_login FROM users WHERE id = ?'),
  getUserAuth: db.prepare('SELECT * FROM users WHERE username = ?'),
  getUserFull: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByRoom: db.prepare('SELECT id FROM users WHERE room = ?'),
  listUsers: db.prepare('SELECT id, username, is_admin, created_at, last_login FROM users ORDER BY username COLLATE NOCASE'),
  addUser: db.prepare('INSERT INTO users (username, pass_hash, is_admin, room, must_change) VALUES (?, ?, ?, ?, ?)'),
  setPassTemp: db.prepare('UPDATE users SET pass_hash = ?, must_change = 1 WHERE id = ?'),
  setPass: db.prepare('UPDATE users SET pass_hash = ?, must_change = 0 WHERE id = ?'),
  setRoom: db.prepare('UPDATE users SET room = ? WHERE id = ?'),
  setLogin: db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?"),
  delUser: db.prepare('DELETE FROM users WHERE id = ?'),
  addSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?)'),
  getSession: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
  slideSession: db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?'),
  delSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  delUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  delOtherSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?'),
  purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  addAudit: db.prepare('INSERT INTO audit (user_id, ip, action, detail) VALUES (?, ?, ?, ?)'),
  listAudit: db.prepare('SELECT a.id, a.at, a.ip, a.action, a.detail, u.username FROM audit a LEFT JOIN users u ON u.id = a.user_id WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 150'),
  listAuditAll: db.prepare('SELECT a.id, a.at, a.ip, a.action, a.detail, u.username FROM audit a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300'),
  pruneAudit: db.prepare('DELETE FROM audit WHERE id <= (SELECT COALESCE(MAX(id), 0) - 5000 FROM audit)'),
  getCombat: db.prepare('SELECT data, updated FROM combat_state WHERE user_id = ?'),
  putCombat: db.prepare('INSERT INTO combat_state (user_id, data, updated) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated = excluded.updated'),

  listCampaigns: db.prepare(`
    SELECT c.id, c.name, c.created_at, COUNT(ch.id) AS characters
    FROM campaigns c LEFT JOIN characters ch ON ch.campaign_id = c.id AND ch.deleted_at IS NULL
    WHERE c.user_id = ? AND c.deleted_at IS NULL
    GROUP BY c.id ORDER BY c.name COLLATE NOCASE`),
  getCampaign: db.prepare('SELECT id, name, created_at FROM campaigns WHERE id = ? AND user_id = ? AND deleted_at IS NULL'),
  findCampaign: db.prepare('SELECT id FROM campaigns WHERE user_id = ? AND name = ? COLLATE NOCASE AND deleted_at IS NULL'),
  addCampaign: db.prepare('INSERT INTO campaigns (name, user_id) VALUES (?, ?)'),
  renameCampaign: db.prepare('UPDATE campaigns SET name = ? WHERE id = ?'),
  trashCampaign: db.prepare("UPDATE campaigns SET deleted_at = datetime('now') WHERE id = ?"),
  listChars: db.prepare('SELECT * FROM characters WHERE campaign_id = ? AND deleted_at IS NULL ORDER BY id'),
  getChar: db.prepare(`SELECT ch.* FROM characters ch JOIN campaigns c ON c.id = ch.campaign_id
    WHERE ch.id = ? AND c.user_id = ? AND ch.deleted_at IS NULL AND c.deleted_at IS NULL`),
  addChar: db.prepare(`INSERT INTO characters
    (campaign_id, name, player, class, level, max_hp, current_hp, temp_hp, ac, init_mod, passive_perception, notes, resources, classes, combat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  updChar: db.prepare(`UPDATE characters SET
    name = ?, player = ?, class = ?, level = ?, max_hp = ?, current_hp = ?, temp_hp = ?, ac = ?, init_mod = ?, passive_perception = ?, notes = ?, resources = ?, classes = ?, combat = ?
    WHERE id = ?`),
  restCampaign: db.prepare('UPDATE characters SET current_hp = max_hp, temp_hp = 0 WHERE campaign_id = ? AND deleted_at IS NULL'),
  setResources: db.prepare('UPDATE characters SET resources = ? WHERE id = ?'),
  trashChar: db.prepare("UPDATE characters SET deleted_at = datetime('now') WHERE id = ?"),

  listFavs: db.prepare('SELECT * FROM bestiary WHERE user_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE'),
  getFav: db.prepare('SELECT * FROM bestiary WHERE id = ? AND user_id = ? AND deleted_at IS NULL'),
  getFavByName: db.prepare('SELECT * FROM bestiary WHERE user_id = ? AND name = ? AND deleted_at IS NULL'),
  addFav: db.prepare('INSERT INTO bestiary (user_id, name, data) VALUES (?, ?, ?)'),
  updFav: db.prepare('UPDATE bestiary SET name = ?, data = ? WHERE id = ?'),
  trashFav: db.prepare("UPDATE bestiary SET deleted_at = datetime('now') WHERE id = ?"),
  countFavs: db.prepare('SELECT COUNT(*) AS n FROM bestiary WHERE user_id = ? AND deleted_at IS NULL'),

  listEnc: db.prepare('SELECT * FROM encounters WHERE user_id = ? AND deleted_at IS NULL AND (campaign_id IS NULL OR campaign_id IS ?) ORDER BY name COLLATE NOCASE'),
  getEnc: db.prepare('SELECT * FROM encounters WHERE id = ? AND user_id = ? AND deleted_at IS NULL'),
  findEnc: db.prepare('SELECT * FROM encounters WHERE user_id = ? AND name = ? AND campaign_id IS ? AND deleted_at IS NULL'),
  addEnc: db.prepare('INSERT INTO encounters (user_id, campaign_id, name, data) VALUES (?, ?, ?, ?)'),
  updEnc: db.prepare('UPDATE encounters SET name = ?, data = ? WHERE id = ?'),
  trashEnc: db.prepare("UPDATE encounters SET deleted_at = datetime('now') WHERE id = ?"),
  countEnc: db.prepare('SELECT COUNT(*) AS n FROM encounters WHERE user_id = ? AND deleted_at IS NULL'),

  trashedCampaigns: db.prepare(`SELECT c.id, c.name, c.deleted_at, (SELECT COUNT(*) FROM characters x WHERE x.campaign_id = c.id) AS n FROM campaigns c WHERE c.user_id = ? AND c.deleted_at IS NOT NULL`),
  trashedChars: db.prepare(`SELECT ch.id, ch.name, ch.deleted_at, c.name AS camp, c.deleted_at AS camp_deleted FROM characters ch JOIN campaigns c ON c.id = ch.campaign_id WHERE c.user_id = ? AND ch.deleted_at IS NOT NULL`),
  trashedFavs: db.prepare('SELECT id, name, deleted_at FROM bestiary WHERE user_id = ? AND deleted_at IS NOT NULL'),
  trashedEncs: db.prepare('SELECT id, name, deleted_at FROM encounters WHERE user_id = ? AND deleted_at IS NOT NULL'),
};
const TRASH_TABLES = { campaign: 'campaigns', character: 'characters', favorite: 'bestiary', encounter: 'encounters' };
const audit = (uid, action, detail, ip) => { try { q.addAudit.run(uid == null ? null : uid, ip || '', action, String(detail || '').slice(0, 300)); } catch (e) { /* never block a request on logging */ } };

function authUser(req) {
  const tok = parseCookies(req.headers.cookie)[COOKIE];
  if (!tok || tok.length > 100) return null;
  const h = sha256(tok), s = q.getSession.get(h);
  if (!s) return null;
  if (s.expires_at < Date.now()) { q.delSession.run(h); return null; }
  const u = q.getUser.get(s.user_id);
  if (!u) return null;
  if (s.expires_at - Date.now() < (SESSION_DAYS - 1) * 864e5) q.slideSession.run(Date.now() + SESSION_DAYS * 864e5, h);
  return Object.assign({}, u, { session: h });
}
async function startSession(req, res, uid) {
  const token = crypto.randomBytes(32).toString('base64url');
  q.addSession.run(sha256(token), uid, Date.now(), Date.now() + SESSION_DAYS * 864e5, clientIp(req));
  res.cookieHeader = sessionCookie(req, token, SESSION_DAYS * 86400);
}

/* ---------- API ---------- */
/* Live snapshots for the player view, one per account (keyed by its private room code). In memory only. */
const liveRooms = new Map();
const needUser = c => { if (!c.user) throw new HttpError(401, 'Please sign in.'); return c.user; };
const needAdmin = c => { const u = needUser(c); if (!u.is_admin) throw new HttpError(403, 'Administrators only.'); return u; };
const ownCampaign = (id, uid) => { const c = q.getCampaign.get(id, uid); if (!c) throw new HttpError(404, 'campaign not found'); return c; };

/** Everything one account owns, as a portable object (no passwords, no other accounts). */
function exportAccount(u) {
  const campaigns = q.listCampaigns.all(u.id);
  return {
    format: 'dragonwatch-backup', version: 1, exported: new Date().toISOString(), account: u.username,
    campaigns: campaigns.map(c => ({
      name: c.name,
      characters: q.listChars.all(c.id).map(hydrate).map(({ id, campaign_id, created_at, deleted_at, ...rest }) => rest),
    })),
    favorites: q.listFavs.all(u.id).map(favRow).map(({ id, ...rest }) => rest),
    encounters: db.prepare('SELECT * FROM encounters WHERE user_id = ? AND deleted_at IS NULL').all(u.id).map(r => {
      const e = encRow(r); const i = campaigns.findIndex(c => c.id === r.campaign_id);
      return { name: e.name, campaign: i >= 0 ? i : null, items: e.items };
    }),
  };
}
/** Merge a backup into an account. Nothing existing is overwritten or deleted. */
function importAccount(u, b) {
  if (!b || b.format !== 'dragonwatch-backup' || !Array.isArray(b.campaigns)) throw new HttpError(400, 'This is not a Dragonwatch backup file.');
  if (b.campaigns.length > 100 || (b.favorites || []).length > 500 || (b.encounters || []).length > 300) throw new HttpError(400, 'Backup is too large.');
  const out = { campaigns: 0, characters: 0, favorites: 0, encounters: 0 };
  db.exec('BEGIN');
  try {
    const ids = [];
    for (const c of b.campaigns) {
      let name = str(c && c.name, 100, true, 'campaign name');
      if (q.findCampaign.get(u.id, name)) name = (name.slice(0, 80) + ' (restored)');
      const id = Number(q.addCampaign.run(name, u.id).lastInsertRowid); ids.push(id); out.campaigns++;
      for (const ch of (Array.isArray(c.characters) ? c.characters.slice(0, 200) : [])) {
        const f = charFields(ch || {});
        q.addChar.run(id, f.name, f.player, f.class, f.level, f.max_hp, f.current_hp, f.temp_hp, f.ac, f.init_mod, f.passive_perception, f.notes, JSON.stringify(f.resources), JSON.stringify(f.classes), JSON.stringify(f.combat)); out.characters++;
      }
    }
    for (const fv of (b.favorites || [])) {
      const f = cleanFav(fv || {}), old = q.getFavByName.get(u.id, f.name);
      if (old) q.updFav.run(f.name, JSON.stringify(f), old.id); else if (q.countFavs.get(u.id).n < 500) q.addFav.run(u.id, f.name, JSON.stringify(f));
      out.favorites++;
    }
    for (const en of (b.encounters || [])) {
      const e = cleanEncounter(en || {}), cid = Number.isInteger(en.campaign) && ids[en.campaign] ? ids[en.campaign] : null;
      const old = q.findEnc.get(u.id, e.name, cid);
      if (old) q.updEnc.run(e.name, JSON.stringify(e), old.id); else if (q.countEnc.get(u.id).n < 300) q.addEnc.run(u.id, cid, e.name, JSON.stringify(e));
      out.encounters++;
    }
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch (e2) { /* ignore */ } throw e; }
  return out;
}

async function api(c) {
  const { method, pathname, body, query, ip } = c;
  let m;

  /* a temporary password must be replaced before anything else works */
  if (c.user && c.user.must_change && !['/api/me', '/api/password', '/api/logout', '/api/health'].includes(pathname)) throw new HttpError(403, 'Please choose a new password first.');

  /* --- public --- */
  if (pathname === '/api/health' && method === 'GET') {
    return [dbOk ? 200 : 503, { ok: dbOk && persistent, db: dbOk, persistent, accounts: q.countUsers.get().n }];
  }
  if (pathname === '/api/me' && method === 'GET') {
    const u = c.user;
    return [200, { setup: q.countUsers.get().n === 0, signup: ALLOW_SIGNUP, persistent, user: u ? { id: u.id, username: u.username, admin: !!u.is_admin, room: u.room, must_change: !!u.must_change } : null }];
  }
  if (pathname === '/api/live' && method === 'GET') {
    const room = String(query.get('room') || '');
    if (!ROOM_RE.test(room) || !q.getUserByRoom.get(room)) throw new HttpError(404, 'This table link is not valid. Ask your Dungeon Master for a new one.');
    const live = liveRooms.get(room) || { rev: 0, at: 0, data: null };
    if (query.get('rev') === String(live.rev)) return [200, { rev: live.rev, same: true, now: Date.now(), at: live.at }];
    return [200, { rev: live.rev, at: live.at, now: Date.now(), data: live.data }];
  }

  if ((pathname === '/api/setup' || pathname === '/api/signup') && method === 'POST') {
    const wait = hit('signup:' + ip, 10, 3600e3);
    if (wait) throw new HttpError(429, 'Too many attempts. Try again later.', { 'Retry-After': wait });
    const first = q.countUsers.get().n === 0;
    if (pathname === '/api/setup' && !first) throw new HttpError(403, 'Setup is already done.');
    if (pathname === '/api/signup' && !first && !ALLOW_SIGNUP) throw new HttpError(403, 'Sign-up is closed. Ask an administrator for an account.');
    const username = cleanUsername(body.username); checkNewPassword(body.password, username);
    const hash = await hashPassword(body.password);
    if (q.getUserAuth.get(username)) throw new HttpError(409, 'That username is taken.');
    if (!first && q.countUsers.get().n === 0) throw new HttpError(409, 'Try again.');
    const uid = Number(q.addUser.run(username, hash, first ? 1 : 0, newRoom(), 0).lastInsertRowid);
    if (first) {   // the first account adopts everything that was saved before accounts existed
      for (const t of ['campaigns', 'bestiary', 'encounters']) db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id IS NULL`).run(uid);
    }
    q.setLogin.run(uid);
    await startSession(c.req, c.res, uid);
    audit(uid, first ? 'setup' : 'signup', username, ip);
    return [201, { ok: true }];
  }
  if (pathname === '/api/login' && method === 'POST') {
    const username = String(body.username == null ? '' : body.username).trim().slice(0, 64), password = typeof body.password === 'string' ? body.password.slice(0, 300) : '';
    const k1 = `u:${ip}|${username.toLowerCase()}`, k2 = `ip:${ip}`;
    const wait = Math.max(lockedFor(k1), lockedFor(k2));
    if (wait) throw new HttpError(429, `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? 's' : ''}.`, { 'Retry-After': wait });
    const row = q.getUserAuth.get(username);
    if (!dummyHash) dummyHash = await hashPassword('not-a-real-password');
    const ok = await checkPassword(password, row ? row.pass_hash : dummyHash);
    if (!row || !ok) {
      noteFail(k1, 5); noteFail(k2, 20);
      audit(row ? row.id : null, 'login-failed', username, ip);
      throw new HttpError(401, 'Wrong username or password.');
    }
    fails.delete(k1);
    q.setLogin.run(row.id);
    await startSession(c.req, c.res, row.id);
    audit(row.id, 'login', '', ip);
    return [200, { ok: true }];
  }
  if (pathname === '/api/logout' && method === 'POST') {
    if (c.user) { q.delSession.run(c.user.session); audit(c.user.id, 'logout', '', ip); }
    c.res.cookieHeader = sessionCookie(c.req, '', 0);
    return [200, { ok: true }];
  }

  /* --- everything below needs an account --- */
  const user = needUser(c), uid = user.id;

  if (pathname === '/api/live' && method === 'PUT') {
    if (hit('live:' + uid, 600, 60e3)) throw new HttpError(429, 'Slow down.');
    const data = body && body.cleared ? null : body;
    if (data && !Array.isArray(data.combatants)) throw new HttpError(400, 'invalid snapshot');
    if (data && data.combatants.length > 200) throw new HttpError(400, 'too many combatants');
    const old = liveRooms.get(user.room) || { rev: 0 };
    liveRooms.set(user.room, { rev: old.rev + 1, at: Date.now(), data });
    return [200, { rev: old.rev + 1 }];
  }
  if (pathname === '/api/room/rotate' && method === 'POST') {
    const room = newRoom(); liveRooms.delete(user.room); q.setRoom.run(room, uid);
    audit(uid, 'room-rotated', '', ip);
    return [200, { room }];
  }
  if (pathname === '/api/password' && method === 'POST') {
    const full = q.getUserFull.get(uid);
    if (!(await checkPassword(String(body.current || ''), full.pass_hash))) { audit(uid, 'password-change-failed', '', ip); throw new HttpError(403, 'Your current password is wrong.'); }
    if (body.next === body.current) throw new HttpError(400, 'Choose a password different from the current one.');
    checkNewPassword(body.next, user.username);
    q.setPass.run(await hashPassword(body.next), uid);
    q.delOtherSessions.run(uid, user.session);
    audit(uid, 'password-changed', 'other sessions signed out', ip);
    return [200, { ok: true }];
  }
  if (pathname === '/api/audit' && method === 'GET') {
    return [200, (user.is_admin && query.get('all') === '1' ? q.listAuditAll.all() : q.listAudit.all(uid))];
  }

  /* combat state (autosaved from the DM page) */
  if (pathname === '/api/combat') {
    if (method === 'GET') { const r = q.getCombat.get(uid); return [200, r ? { state: JSON.parse(r.data), updated: r.updated } : { state: null, updated: 0 }]; }
    if (method === 'PUT') {
      const st = body && body.state;
      if (!st || typeof st !== 'object' || !Array.isArray(st.combatants) || st.combatants.length > 300) throw new HttpError(400, 'invalid fight state');
      const updated = Date.now();
      q.putCombat.run(uid, JSON.stringify(st), updated);
      return [200, { updated }];
    }
  }

  /* backup, restore */
  if (pathname === '/api/export' && method === 'GET') { audit(uid, 'export', '', ip); return [200, exportAccount(user), { 'Content-Disposition': `attachment; filename="dragonwatch-${user.username}-${new Date().toISOString().slice(0, 10)}.json"` }]; }
  if (pathname === '/api/import' && method === 'POST') {
    const r = importAccount(user, body); audit(uid, 'import', JSON.stringify(r), ip); return [200, r];
  }

  /* recycle bin */
  if (pathname === '/api/trash' && method === 'GET') {
    const items = [
      ...q.trashedCampaigns.all(uid).map(r => ({ type: 'campaign', id: r.id, name: r.name, deleted_at: r.deleted_at, detail: `${r.n} character${r.n === 1 ? '' : 's'}` })),
      ...q.trashedChars.all(uid).map(r => ({ type: 'character', id: r.id, name: r.name, deleted_at: r.deleted_at, detail: `in ${r.camp}` })),
      ...q.trashedFavs.all(uid).map(r => ({ type: 'favorite', id: r.id, name: r.name, deleted_at: r.deleted_at, detail: 'favorite monster' })),
      ...q.trashedEncs.all(uid).map(r => ({ type: 'encounter', id: r.id, name: r.name, deleted_at: r.deleted_at, detail: 'saved encounter' })),
    ].sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)));
    return [200, { days: TRASH_DAYS, items }];
  }
  if (pathname === '/api/trash/restore' && method === 'POST') {
    const type = String(body.type), id = Number(body.id), tbl = TRASH_TABLES[type];
    if (!tbl || !Number.isInteger(id)) throw new HttpError(400, 'bad request');
    let row;
    if (type === 'character') {
      row = db.prepare('SELECT ch.id, ch.name, c.deleted_at AS cd FROM characters ch JOIN campaigns c ON c.id = ch.campaign_id WHERE ch.id = ? AND c.user_id = ? AND ch.deleted_at IS NOT NULL').get(id, uid);
      if (row && row.cd) throw new HttpError(409, 'Restore its campaign first.');
    } else row = db.prepare(`SELECT id, name FROM ${tbl} WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`).get(id, uid);
    if (!row) throw new HttpError(404, 'not in the recycle bin');
    if (type === 'favorite' && q.getFavByName.get(uid, row.name)) throw new HttpError(409, 'A favorite with that name already exists.');
    db.prepare(`UPDATE ${tbl} SET deleted_at = NULL WHERE id = ?`).run(id);
    audit(uid, 'restored', `${type}: ${row.name}`, ip);
    return [200, { ok: true }];
  }
  if ((m = pathname.match(/^\/api\/trash\/(campaign|character|favorite|encounter)\/(\d+)$/)) && method === 'DELETE') {
    const type = m[1], id = +m[2], tbl = TRASH_TABLES[type];
    const own = type === 'character'
      ? db.prepare('SELECT ch.id, ch.name FROM characters ch JOIN campaigns c ON c.id = ch.campaign_id WHERE ch.id = ? AND c.user_id = ? AND ch.deleted_at IS NOT NULL').get(id, uid)
      : db.prepare(`SELECT id, name FROM ${tbl} WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`).get(id, uid);
    if (!own) throw new HttpError(404, 'not in the recycle bin');
    db.prepare(`DELETE FROM ${tbl} WHERE id = ?`).run(id);
    audit(uid, 'deleted-forever', `${type}: ${own.name}`, ip);
    return [200, { ok: true }];
  }
  if (pathname === '/api/trash' && method === 'DELETE') {
    db.prepare('DELETE FROM characters WHERE deleted_at IS NOT NULL AND campaign_id IN (SELECT id FROM campaigns WHERE user_id = ?)').run(uid);
    for (const t of ['campaigns', 'bestiary', 'encounters']) db.prepare(`DELETE FROM ${t} WHERE user_id = ? AND deleted_at IS NOT NULL`).run(uid);
    audit(uid, 'trash-emptied', '', ip);
    return [200, { ok: true }];
  }

  /* administration */
  if (pathname === '/api/users' && method === 'GET') { needAdmin(c); return [200, q.listUsers.all()]; }
  if (pathname === '/api/users' && method === 'POST') {
    needAdmin(c);
    const username = cleanUsername(body.username); checkNewPassword(body.password, username);
    if (q.getUserAuth.get(username)) throw new HttpError(409, 'That username is taken.');
    const id = Number(q.addUser.run(username, await hashPassword(body.password), body.admin ? 1 : 0, newRoom(), 1).lastInsertRowid);
    audit(uid, 'account-created', username, ip);
    return [201, q.getUser.get(id)];
  }
  if ((m = pathname.match(/^\/api\/users\/(\d+)$/)) && method === 'DELETE') {
    needAdmin(c);
    const id = +m[1], t = q.getUser.get(id);
    if (!t) throw new HttpError(404, 'account not found');
    if (id === uid) throw new HttpError(400, 'You cannot delete your own account here.');
    if (t.is_admin && q.countAdmins.get().n <= 1) throw new HttpError(400, 'That is the last administrator.');
    liveRooms.delete(t.room); q.delUser.run(id);
    audit(uid, 'account-deleted', t.username, ip);
    return [200, { ok: true }];
  }
  if ((m = pathname.match(/^\/api\/users\/(\d+)\/password$/)) && method === 'POST') {
    needAdmin(c);
    const id = +m[1], t = q.getUser.get(id);
    if (!t) throw new HttpError(404, 'account not found');
    checkNewPassword(body.password, t.username);
    q.setPassTemp.run(await hashPassword(body.password), id); q.delUserSessions.run(id);
    audit(uid, 'password-reset', t.username, ip);
    return [200, { ok: true }];
  }

  /* --- encounter generator: 2014 DMG budget maths over the bundled SRD monsters --- */
  if (pathname === '/api/encounter/envs' && method === 'GET') {          // which environments each SRD creature lives in (for the Encounter lab dialog)
    if (!encounterGen) throw new HttpError(503, 'The SRD monster data is not installed on this server.');
    const monsters = {};
    for (const a of encounterGen.loadMonsters()) monsters[String(a.m.name).toLowerCase()] = { any: !!a.anyEnv, keys: [...a.envKeys] };
    return [200, { environments: encounterGen.options().environments, monsters }];
  }
  if (pathname === '/api/encounter/lookup' && method === 'POST') {      // full SRD records for the creatures the Encounter lab picked
    if (!encounterGen) throw new HttpError(503, 'The SRD monster data is not installed on this server.');
    const want = new Set((Array.isArray((body || {}).names) ? body.names : []).slice(0, 60).map(n => String(n).toLowerCase()));
    return [200, srdRecords().filter(m => want.has(String(m.name).toLowerCase()))];
  }
  /* --- favorite monsters --- */
  if (pathname === '/api/bestiary') {
    if (method === 'GET') return [200, q.listFavs.all(uid).map(favRow)];
    if (method === 'POST') {
      const f = cleanFav(body || {});
      const old = q.getFavByName.get(uid, f.name);
      if (old) { q.updFav.run(f.name, JSON.stringify(f), old.id); return [200, favRow(q.getFav.get(old.id, uid))]; }
      if (q.countFavs.get(uid).n >= 500) throw new HttpError(400, 'bestiary is full');
      const id = Number(q.addFav.run(uid, f.name, JSON.stringify(f)).lastInsertRowid);
      return [201, favRow(q.getFav.get(id, uid))];
    }
  }
  if ((m = pathname.match(/^\/api\/bestiary\/(\d+)$/)) && method === 'DELETE') {
    const f = q.getFav.get(+m[1], uid); if (!f) throw new HttpError(404, 'not found');
    q.trashFav.run(f.id); audit(uid, 'favorite-removed', f.name, ip);
    return [200, { ok: true }];
  }

  /* --- saved encounters --- */
  if (pathname === '/api/encounters') {
    if (method === 'GET') {
      const cid = Number(query.get('campaign'));
      return [200, q.listEnc.all(uid, Number.isInteger(cid) && cid > 0 ? cid : null).map(encRow)];
    }
    if (method === 'POST') {
      const e = cleanEncounter(body || {});
      const cid = body && body.campaign_id != null ? Number(body.campaign_id) : null;
      if (cid != null) { if (!Number.isInteger(cid)) throw new HttpError(400, 'unknown campaign'); ownCampaign(cid, uid); }
      const old = q.findEnc.get(uid, e.name, cid);
      if (old) { q.updEnc.run(e.name, JSON.stringify(e), old.id); return [200, encRow(q.getEnc.get(old.id, uid))]; }
      if (q.countEnc.get(uid).n >= 300) throw new HttpError(400, 'too many saved encounters');
      const id = Number(q.addEnc.run(uid, cid, e.name, JSON.stringify(e)).lastInsertRowid);
      return [201, encRow(q.getEnc.get(id, uid))];
    }
  }
  if ((m = pathname.match(/^\/api\/encounters\/(\d+)$/))) {
    const row = q.getEnc.get(+m[1], uid);
    if (!row) throw new HttpError(404, 'encounter not found');
    if (method === 'DELETE') { q.trashEnc.run(row.id); audit(uid, 'encounter-deleted', row.name, ip); return [200, { ok: true }]; }
    if (method === 'PUT' || method === 'PATCH') {
      const name = str(body && body.name, 100, true, 'name');
      const d = JSON.parse(row.data || '{}'); d.name = name;
      if (name.toLowerCase() !== row.name.toLowerCase() && q.findEnc.get(uid, name, row.campaign_id)) throw new HttpError(409, 'that name is already used');
      q.updEnc.run(name, JSON.stringify(d), row.id);
      return [200, encRow(q.getEnc.get(row.id, uid))];
    }
  }

  /* --- campaigns and characters --- */
  if (pathname === '/api/campaigns') {
    if (method === 'GET') return [200, q.listCampaigns.all(uid)];
    if (method === 'POST') {
      const id = Number(q.addCampaign.run(str(body.name, 100, true, 'name'), uid).lastInsertRowid);
      return [201, q.getCampaign.get(id, uid)];
    }
  }
  if ((m = pathname.match(/^\/api\/campaigns\/(\d+)$/))) {
    const camp = ownCampaign(+m[1], uid);
    if (method === 'GET') return [200, camp];
    if (method === 'PATCH') { q.renameCampaign.run(str(body.name, 100, true, 'name'), camp.id); return [200, q.getCampaign.get(camp.id, uid)]; }
    if (method === 'DELETE') { q.trashCampaign.run(camp.id); audit(uid, 'campaign-deleted', camp.name, ip); return [204, null]; }
  }
  if ((m = pathname.match(/^\/api\/campaigns\/(\d+)\/characters$/))) {
    const camp = ownCampaign(+m[1], uid);
    if (method === 'GET') return [200, q.listChars.all(camp.id).map(hydrate)];
    if (method === 'POST') {
      const f = charFields(body);
      const r = q.addChar.run(camp.id, f.name, f.player, f.class, f.level, f.max_hp, f.current_hp, f.temp_hp, f.ac, f.init_mod, f.passive_perception, f.notes, JSON.stringify(f.resources), JSON.stringify(f.classes), JSON.stringify(f.combat));
      return [201, hydrate(db.prepare('SELECT * FROM characters WHERE id = ?').get(Number(r.lastInsertRowid)))];
    }
  }
  if ((m = pathname.match(/^\/api\/campaigns\/(\d+)\/(rest|short-rest)$/)) && method === 'POST') {
    const camp = ownCampaign(+m[1], uid), long = m[2] === 'rest';
    if (long) q.restCampaign.run(camp.id);            // long rest: everyone back to full HP
    for (const row of q.listChars.all(camp.id)) {     // ...and resources recharge
      const isHD = r => /^Hit Dice/.test(r.name);
      const pools = hydrate(row).resources;
      // Hit Dice: a long rest gives back half of the total (at least one), not all of them. Bigger dice come back first.
      let budget = long ? Math.max(1, Math.floor(pools.filter(isHD).reduce((a, r) => a + r.max, 0) / 2)) : 0;
      const back = new Map();
      if (long) pools.filter(isHD).sort((x, y) => (parseInt((y.name.match(/d(\d+)/) || [])[1], 10) || 0) - (parseInt((x.name.match(/d(\d+)/) || [])[1], 10) || 0))
        .forEach(r => { const n = Math.min(budget, r.max - r.cur); back.set(r, n); budget -= n; });
      const res = pools.map(r => {
        if (long && isHD(r)) return Object.assign({}, r, { cur: Math.min(r.max, r.cur + (back.get(r) || 0)) });
        return (r.rest === 'short' || (long && r.rest === 'long')) ? Object.assign({}, r, { cur: r.max }) : r;
      });
      q.setResources.run(JSON.stringify(res), row.id);
    }
    return [200, q.listChars.all(camp.id).map(hydrate)];
  }
  if ((m = pathname.match(/^\/api\/characters\/(\d+)$/))) {
    const row = q.getChar.get(+m[1], uid);
    if (!row) throw new HttpError(404, 'character not found');
    const cur = hydrate(row);
    if (method === 'GET') return [200, cur];
    if (method === 'PATCH') {
      const f = charFields(body, cur);
      q.updChar.run(f.name, f.player, f.class, f.level, f.max_hp, f.current_hp, f.temp_hp, f.ac, f.init_mod, f.passive_perception, f.notes, JSON.stringify(f.resources), JSON.stringify(f.classes), JSON.stringify(f.combat), row.id);
      return [200, hydrate(db.prepare('SELECT * FROM characters WHERE id = ?').get(row.id))];
    }
    if (method === 'DELETE') { q.trashChar.run(row.id); audit(uid, 'character-deleted', row.name, ip); return [204, null]; }
  }
  throw new HttpError(404, 'not found');
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}); }
      catch { reject(new HttpError(400, 'invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/* ---------- static files ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
const PRIVATE_PAGES = new Set(['/', '/index.html']);   // the DM page needs an account; the player view and login page are public
function send(res, req, status, headers, body) {
  const h = Object.assign(secHeaders(req), headers);
  if (res.cookieHeader) h['Set-Cookie'] = res.cookieHeader;
  res.writeHead(status, h);
  res.end(body);
}
function serveStatic(req, res, pathname, user) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, req, 400, {}, 'Bad request'); }
  if (rel.includes('\0') || rel.split('/').some(s => s.startsWith('.'))) return send(res, req, 403, {}, 'Forbidden');
  if (pathname === '/boot.js') {   // who is signed in, for the page scripts (never cached)
    const body = user && user.must_change ? "location.replace('/login.html');" : user ? `window.DW=${JSON.stringify({ uid: user.id, user: user.username, admin: !!user.is_admin, room: user.room })};` : "location.replace('/login.html');";
    return send(res, req, 200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }, body);
  }
  if (PRIVATE_PAGES.has(rel) && !user) { res.writeHead(302, Object.assign(secHeaders(req), { Location: 'login.html', 'Cache-Control': 'no-store' })); return res.end(); }
  if (rel === '/login.html' && user && !user.must_change) { res.writeHead(302, Object.assign(secHeaders(req), { Location: './', 'Cache-Control': 'no-store' })); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(STATIC_DIR, rel));
  const ext = path.extname(file).toLowerCase();
  if (!file.startsWith(STATIC_DIR + path.sep) || !MIME[ext]) return send(res, req, 404, {}, 'Not found');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, req, 404, {}, 'Not found');
    send(res, req, 200, {
      'Content-Type': MIME[ext],
      'Cache-Control': ext === '.woff2' ? 'public, max-age=604800' : (PRIVATE_PAGES.has(rel) ? 'no-store' : 'no-cache'),
    }, data);
  });
}

/* ---------- server ---------- */
const sameOrigin = req => {
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === String((TRUST_PROXY && req.headers['x-forwarded-host']) || req.headers.host || ''); } catch { return false; }
};
const BIG_BODY = new Set(['/api/combat', '/api/import']);
/* ---------- recovery commands (run inside the container; they never start the web server) ----------
     docker exec dragonwatch node --no-warnings server.js --list-users
     docker exec dragonwatch node --no-warnings server.js --reset-password <username>   */
const CLI_CMD = ['--list-users', '--reset-password'].includes(process.argv[2]) ? process.argv[2] : null;
{
  const argv = process.argv.slice(2), cmd = argv[0];
  if (cmd === '--list-users' || cmd === '--reset-password') {
    (async () => {
      if (cmd === '--list-users') {
        for (const u of q.listUsers.all()) console.log(`${u.username}${u.is_admin ? '  (administrator)' : ''}`);
      } else {
        const row = q.getUserAuth.get(String(argv[1] || '').trim());
        if (!row) { console.error('No such user. Use --list-users to see the names.'); process.exitCode = 1; }
        else {
          const words = ['amber', 'basalt', 'cinder', 'drake', 'ember', 'falcon', 'gale', 'harbor', 'ivory', 'juniper', 'kestrel', 'lantern', 'marble', 'nettle', 'onyx', 'pewter', 'quartz', 'raven', 'saffron', 'thistle'];
          const pick = () => words[crypto.randomInt(words.length)];
          const temp = `${pick()}-${pick()}-${pick()}-${crypto.randomInt(100, 1000)}`;
          q.setPassTemp.run(await hashPassword(temp), row.id); q.delUserSessions.run(row.id);
          audit(row.id, 'password-reset', 'from the server command line', 'local');
          console.log(`New temporary password for ${row.username}:  ${temp}\nThey must choose their own password when they sign in.`);
        }
      }
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { /* ignore */ }
      db.close(); process.exit(process.exitCode || 0);
    })();
  }
}

const server = http.createServer(async (req, res) => {
  const ip = clientIp(req);
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, req, 400, {}, 'Bad request'); }
  try {
    if (url.pathname.startsWith('/api/')) {
      if (!dbOk && url.pathname !== '/api/health') throw new HttpError(503, 'The database failed its safety check. Restore a backup (see the README).');
      const wait = hit('api:' + ip, url.pathname === '/api/live' ? 1500 : 900, 60e3);
      if (wait) throw new HttpError(429, 'Too many requests. Slow down.', { 'Retry-After': wait });
      const write = !['GET', 'HEAD'].includes(req.method);
      if (write) {
        if (req.headers['x-dw'] !== '1' || !sameOrigin(req)) throw new HttpError(403, 'Blocked: this request did not come from the app.');
        if (req.headers['content-length'] !== '0' && req.method !== 'DELETE' && !String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'JSON only.');
      }
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req, BIG_BODY.has(url.pathname) ? 5e6 : 1e6) : {};
      const user = authUser(req);
      const [status, data, extra] = await api({ req, res, method: req.method, pathname: url.pathname, body, query: url.searchParams, ip, user });
      if (data === null) return send(res, req, status, {}, undefined);
      return send(res, req, status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extra), JSON.stringify(data));
    }
    if (url.pathname === '/admin/backup') {   // full database copy, administrators only
      const user = authUser(req);
      if (!user || !user.is_admin) return send(res, req, 403, {}, 'Forbidden');
      const tmp = path.join(BACKUP_DIR, `download-${crypto.randomBytes(6).toString('hex')}.db`);
      db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
      audit(user.id, 'full-backup-downloaded', '', ip);
      res.writeHead(200, Object.assign(secHeaders(req), { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="dragonwatch-full-${new Date().toISOString().slice(0, 10)}.db"`, 'Cache-Control': 'no-store' }));
      const rs = fs.createReadStream(tmp); rs.pipe(res); rs.on('close', () => fs.unlink(tmp, () => {}));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, req, 405, {}, 'Method not allowed');
    serveStatic(req, res, url.pathname, authUser(req));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    send(res, req, status, Object.assign({ 'Content-Type': 'application/json' }, e.headers), JSON.stringify({ error: status === 500 ? 'internal error' : e.message }));
  }
});
server.requestTimeout = 30e3; server.headersTimeout = 15e3; server.keepAliveTimeout = 5e3;

/* ---------- housekeeping: backups, recycle bin, old sessions ---------- */
function backupFiles() { return fs.readdirSync(BACKUP_DIR).filter(f => /^dragonwatch-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.db$/.test(f)).sort(); }
function makeBackup() {
  const name = `dragonwatch-${new Date().toISOString().replace(/[T:]/g, '-').slice(0, 16)}.db`, file = path.join(BACKUP_DIR, name);
  if (fs.existsSync(file)) return name;
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const all = backupFiles(); while (all.length > BACKUP_KEEP) fs.unlinkSync(path.join(BACKUP_DIR, all.shift()));
  return name;
}
function housekeeping() {
  try {
    if (dbOk && persistent) {
      const last = backupFiles().pop();
      if (!last || Date.now() - fs.statSync(path.join(BACKUP_DIR, last)).mtimeMs > 22 * 3600e3) console.log('Backup written:', makeBackup());
    }
    const cut = `-${TRASH_DAYS} days`;
    db.prepare("DELETE FROM characters WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)").run(cut);
    for (const t of ['campaigns', 'bestiary', 'encounters']) db.prepare(`DELETE FROM ${t} WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)`).run(cut);
    q.purgeSessions.run(Date.now()); q.pruneAudit.run();
    db.exec('PRAGMA wal_checkpoint(PASSIVE)');
  } catch (e) { console.error('housekeeping failed:', e.message); }
}
if (!CLI_CMD) { housekeeping(); setInterval(housekeeping, 3600e3).unref(); }

if (!CLI_CMD) server.listen(PORT, '0.0.0.0', () => console.log(`Dragonwatch listening on :${PORT}  (database: ${DB_FILE}, accounts: ${q.countUsers.get().n}, sign-up ${ALLOW_SIGNUP ? 'open' : 'closed'})`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => { try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { /* ignore */ } db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 5000).unref(); });
