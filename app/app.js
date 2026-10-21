/* Dragonwatch — D&D Combat Tracker. Pure vanilla JS, state saved in localStorage. */
'use strict';

/** Inline SVG icon from the sprite in index.html */
const ic = (n, cls = '') => `<svg class="ic ${cls}"><use href="#i-${n}"/></svg>`;

/* =====================================================================
   Condition catalogue
   ===================================================================== */
const TIE_NAME = { mod: 'Highest modifier', pc: 'Players first', manual: 'Manual (drag)' };
const CONDITIONS = [
  // --- Core 5e conditions ---
  { key: 'blinded',       name: 'Blinded',       cat: 'Core',    color: '#8d8d9b', desc: "Can't see. Auto-fails sight-based checks. Attacks against it have advantage; its attacks have disadvantage." },
  { key: 'charmed',       name: 'Charmed',       cat: 'Core',    color: '#e46fa9', desc: "Can't attack the charmer or target them with harmful effects. The charmer has advantage on social checks against it." },
  { key: 'deafened',      name: 'Deafened',      cat: 'Core',    color: '#9a8f7c', desc: "Can't hear. Auto-fails hearing-based checks." },
  { key: 'exhaustion',    name: 'Exhaustion',    cat: 'Core',    color: '#a67c52', desc: "Levels 1–6. 2024 rules: −2 to d20 Tests and −5 ft speed per level; death at level 6. 2014: 1 disadv. checks, 2 half speed, 3 disadv. attacks/saves, 4 half HP max, 5 speed 0, 6 death.", levels: 6 },
  { key: 'frightened',    name: 'Frightened',    cat: 'Core',    color: '#9b59b6', desc: "Disadvantage on ability checks and attacks while the source of fear is in line of sight. Can't willingly move closer to it." },
  { key: 'grappled',      name: 'Grappled',      cat: 'Core',    color: '#d98c3b', desc: "Speed 0. Ends if the grappler is incapacitated or the creature is moved out of reach." },
  { key: 'incapacitated', name: 'Incapacitated', cat: 'Core',    color: '#c7a13a', desc: "Can't take actions, bonus actions or reactions." },
  { key: 'invisible',     name: 'Invisible',     cat: 'Core',    color: '#6fd0e8', desc: "Can't be seen without special senses. Attacks against it have disadvantage; its attacks have advantage." },
  { key: 'paralyzed',     name: 'Paralyzed',     cat: 'Core',    color: '#e8d34a', desc: "Incapacitated, can't move or speak. Auto-fails STR/DEX saves. Attacks have advantage; hits within 5 ft are critical hits." },
  { key: 'petrified',     name: 'Petrified',     cat: 'Core',    color: '#8a8f98', desc: "Turned to stone. Incapacitated, can't move or speak, unaware. Resistance to all damage, immune to poison and disease." },
  { key: 'poisoned',      name: 'Poisoned',      cat: 'Core',    color: '#4caf50', desc: "Disadvantage on attack rolls and ability checks." },
  { key: 'prone',         name: 'Prone',         cat: 'Core',    color: '#b08968', desc: "Only crawl (or stand using half speed). Disadvantage on its attacks. Melee attacks vs it have advantage, ranged have disadvantage." },
  { key: 'restrained',    name: 'Restrained',    cat: 'Core',    color: '#cf6a4c', desc: "Speed 0. Attacks against it have advantage, its attacks have disadvantage. Disadvantage on DEX saves." },
  { key: 'stunned',       name: 'Stunned',       cat: 'Core',    color: '#e6c229', desc: "Incapacitated, can't move, speaks falteringly. Auto-fails STR/DEX saves. Attacks against it have advantage." },
  { key: 'unconscious',   name: 'Unconscious',   cat: 'Core',    color: '#5c6bc0', desc: "Incapacitated, drops what it holds, falls prone. Auto-fails STR/DEX saves. Attacks have advantage; hits within 5 ft are critical hits." },

  // --- Weapon mastery effects (2024) ---
  { key: 'vexed',   name: 'Vexed',   cat: 'Mastery', color: '#e07b39', desc: "Vex mastery: the next attack roll against this creature (by the vexing attacker) has advantage, before the end of the attacker's next turn." },
  { key: 'sapped',  name: 'Sapped',  cat: 'Mastery', color: '#a1887f', desc: "Sap mastery: disadvantage on its next attack roll before the start of the attacker's next turn." },
  { key: 'slowed_m',name: 'Slowed (Mastery)', cat: 'Mastery', color: '#7fb3d5', desc: "Slow mastery: speed reduced by 10 ft until the start of the attacker's next turn." },
  { key: 'pushed',  name: 'Pushed',  cat: 'Mastery', color: '#90a4ae', desc: "Push mastery: pushed up to 10 ft straight away from the attacker (Large or smaller)." },
  { key: 'toppled', name: 'Toppled', cat: 'Mastery', color: '#b08968', desc: "Topple mastery: failed CON save → knocked Prone." },

  // --- Spell & magical effects ---
  { key: 'hexed',      name: 'Hexed',        cat: 'Magic', color: '#8e44ad', desc: "Hex: takes extra 1d6 necrotic from the caster's hits; disadvantage on checks with the chosen ability." },
  { key: 'marked',     name: "Hunter's Mark",cat: 'Magic', color: '#2e8b57', desc: "Marked by a ranger: takes extra 1d6 force/damage from the caster's weapon hits. Caster can track it." },
  { key: 'faerie',     name: 'Faerie Fire',  cat: 'Magic', color: '#e56bd0', desc: "Outlined in light. Attacks against it have advantage; can't benefit from invisibility." },
  { key: 'blessed',    name: 'Blessed',      cat: 'Magic', color: '#f1d87a', desc: "Bless: +1d4 to attack rolls and saving throws." },
  { key: 'baned',      name: 'Bane',         cat: 'Magic', color: '#7a1f3d', desc: "Bane: −1d4 to attack rolls and saving throws." },
  { key: 'hasted',     name: 'Hasted',       cat: 'Magic', color: '#ffb300', desc: "Haste: double speed, +2 AC, advantage on DEX saves, extra limited action. Lethargic when it ends." },
  { key: 'slowed',     name: 'Slowed',       cat: 'Magic', color: '#5dade2', desc: "Slow: half speed, −2 AC and DEX saves, no reactions, only an action or bonus action each turn." },
  { key: 'shielded',   name: 'Shielded',     cat: 'Magic', color: '#64b5f6', desc: "Magical protection (Shield of Faith, Shield, Mage Armor…): AC increased." },
  { key: 'enlarged',   name: 'Enlarged',     cat: 'Magic', color: '#ef9a9a', desc: "Enlarge: size up, advantage on STR checks/saves, +1d4 weapon damage." },
  { key: 'reduced',    name: 'Reduced',      cat: 'Magic', color: '#80cbc4', desc: "Reduce: size down, disadvantage on STR checks/saves, −1d4 weapon damage." },
  { key: 'silenced',   name: 'Silenced',     cat: 'Magic', color: '#78909c', desc: "Cannot speak or cast spells with verbal components." },
  { key: 'confused',   name: 'Confused',     cat: 'Magic', color: '#ba68c8', desc: "Confusion: behaves randomly (d10) — move, babble, attack nearest, or act normally." },
  { key: 'asleep',     name: 'Asleep',       cat: 'Magic', color: '#7986cb', desc: "Magically asleep: unconscious until damaged or shaken awake." },
  { key: 'entangled',  name: 'Entangled',    cat: 'Magic', color: '#689f38', desc: "Entangle/Web: restrained by plants or webbing until freed." },
  { key: 'banished',   name: 'Banished',     cat: 'Magic', color: '#512da8', desc: "Sent to another plane, incapacitated, until the spell ends." },
  { key: 'dominated',  name: 'Dominated',    cat: 'Magic', color: '#ad1457', desc: "Controlled by another creature's will (Dominate Person/Monster, Command)." },
  { key: 'raging',     name: 'Raging',       cat: 'Magic', color: '#e53935', desc: "Barbarian Rage: advantage on STR checks/saves, bonus melee damage, resistance to B/P/S. No spellcasting." },
  { key: 'wildshape',  name: 'Wild Shape',   cat: 'Magic', color: '#43a047', desc: "Transformed into a beast; beast HP absorbs damage first." },

  // --- Ongoing damage & situational ---
  { key: 'burning',    name: 'Burning',      cat: 'Status', color: '#ff7043', desc: "On fire: takes fire damage at the start/end of its turn until extinguished." },
  { key: 'bleeding',   name: 'Bleeding',     cat: 'Status', color: '#c62828', desc: "Takes ongoing damage until healed or stabilised." },
  { key: 'frozen',     name: 'Chilled',      cat: 'Status', color: '#4dd0e1', desc: "Chilled/frostbitten: reduced speed or ongoing cold damage." },
  { key: 'acid',       name: 'Acid',         cat: 'Status', color: '#aeea00', desc: "Covered in acid: ongoing acid damage." },
  { key: 'diseased',   name: 'Diseased',     cat: 'Status', color: '#9e9d24', desc: "Suffering from a disease with its own effects." },
  { key: 'cursed',     name: 'Cursed',       cat: 'Status', color: '#6a1b9a', desc: "Under a curse with lasting effects." },
  { key: 'dodging',    name: 'Dodging',      cat: 'Status', color: '#26c6da', desc: "Dodge action: attacks against it have disadvantage; advantage on DEX saves until start of its next turn." },
  { key: 'readied',    name: 'Readied',      cat: 'Status', color: '#ffa726', desc: "Has a readied action waiting on a trigger." },
  { key: 'hidden',     name: 'Hidden',       cat: 'Status', color: '#455a64', desc: "Hidden from enemies. Attacks from hiding have advantage." },
  { key: 'surprised',  name: 'Surprised',    cat: 'Status', color: '#ffee58', desc: "Surprised: disadvantage on initiative (2024) / can't act on first turn (2014)." },
  { key: 'flying',     name: 'Flying',       cat: 'Status', color: '#81d4fa', desc: "Airborne. May fall if knocked prone or speed reduced to 0." },
  { key: 'concentrating', name: 'Concentrating', cat: 'Status', color: '#ce93d8', desc: "Maintaining a concentration spell. CON save (DC 10 or half damage, max 30) when damaged." },
  { key: 'surprised',  name: 'Surprised',  cat: 'Status', color: '#e6a23c', desc: "Surprised at the start of combat: can't move or take actions or reactions on its first turn, which is skipped. Reactions return once that turn has ended." },
  { key: 'stable',     name: 'Stable',       cat: 'Status', color: '#66bb6a', desc: "Unconscious at 0 HP but no longer making death saves." },
  { key: 'dying',      name: 'Downed',        cat: 'Status', color: '#d32f2f', desc: "At 0 HP and making death saving throws." },
  { key: 'dead',       name: 'Dead',         cat: 'Status', color: '#616161', desc: "Dead. Skipped in the initiative order." },
];
const COND = Object.fromEntries(CONDITIONS.map(c => [c.key, c]));
const CATS = ['All', 'Core', 'Mastery', 'Magic', 'Status'];


/* =====================================================================
   State
   ===================================================================== */
/* Where this page lives ("/" or e.g. "/dragonwatch/"), so the app also works behind a reverse proxy under a path. */
const BASE = location.pathname.replace(/[^/]*$/, '');
const U = p => BASE + String(p).replace(/^\//, '');
if (!window.DW) { location.replace(U('login.html')); throw new Error('not signed in'); }
/** Browser storage is kept per account, so two people sharing one browser never see each other's data. */
const scoped = k => k.replace(/^dragonwatch\./, `dragonwatch.u${DW.uid}.`);
const STORE_KEY = scoped('dragonwatch.v1'), HIST_KEY = scoped('dragonwatch.hist'), DIRTY_KEY = scoped('dragonwatch.dirty');
const blank = () => ({ round: 1, turn: 0, started: false, combatants: [], log: [], nextId: 1, tie: 'mod', win: [] });
const WIN = { now: null, busy: false, key: '', timer: null, pop: null, fallback: 0, down: [], pHp: [0, 0], mHp: [0, 0] };
let state = load();
let history = loadHist();
let filter = 'all';
let modal = { id: null, cat: 'All', q: '' };

function load() {
  try {
    let raw = localStorage.getItem(STORE_KEY);
    if (raw == null && DW.admin && localStorage.getItem('dragonwatch.v1')) {   // a fight saved before accounts existed belongs to the first (admin) account
      raw = localStorage.getItem('dragonwatch.v1'); localStorage.removeItem('dragonwatch.v1');
    }
    const s = JSON.parse(raw);
    if (s && Array.isArray(s.combatants)) {
      const st = Object.assign(blank(), s);
      if (s.started === undefined && (st.round > 1 || st.turn > 0)) st.started = true;   // saved by an older version mid-fight
      return st;
    }
  } catch (e) { /* ignore */ }
  return blank();
}
function loadHist() { try { const h = JSON.parse(localStorage.getItem(HIST_KEY)); return Array.isArray(h) ? h.filter(x => typeof x === 'string').slice(-60) : []; } catch (e) { return []; } }
let histTimer = null;
function saveHist() {   // the undo history survives a page refresh (trimmed if the browser runs out of room)
  clearTimeout(histTimer);
  histTimer = setTimeout(() => {
    for (const n of [30, 12, 4, 0]) { try { localStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-n))); return; } catch (e) { /* too big: keep fewer */ } }
  }, 600);
}
/** Every change is saved in this browser at once and on the server a moment later, so a fight survives a cleared browser or another device. */
let saveTimer = null, saving = false;
const saveDot = cls => { const d = document.getElementById('saveDot'); if (d) { d.className = 'save-dot ' + cls; d.title = cls === 'error' ? 'Not saved to the server. Retrying…' : cls === 'pending' ? 'Saving…' : 'Saved to the server'; } };
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); localStorage.setItem(DIRTY_KEY, '1'); } catch (e) { /* ignore */ }
  queueServerSave();
}
function queueServerSave(delay = 1500) { clearTimeout(saveTimer); saveDot('pending'); saveTimer = setTimeout(serverSave, delay); }
async function serverSave() {
  if (saving) return queueServerSave(800);
  saving = true;
  try {
    const r = await api('PUT', '/api/combat', { state });
    state.sv = r.updated;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); localStorage.removeItem(DIRTY_KEY); } catch (e) { /* ignore */ }
    saveDot('');
  } catch (e) { saveDot('error'); saveTimer = setTimeout(serverSave, 8000); }
  finally { saving = false; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && localStorage.getItem(DIRTY_KEY) === '1') { clearTimeout(saveTimer); try { const j = JSON.stringify({ state }); if (j.length < 60000) fetch(U('/api/combat'), { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-DW': '1' }, body: j }); else serverSave(); } catch (e) { /* ignore */ } } });
/** On start-up, pick up a newer fight saved from another browser or device. */
async function syncCombat() {
  try {
    const r = await api('GET', '/api/combat');
    const blankLocal = !state.combatants.length && !state.log.length, dirty = localStorage.getItem(DIRTY_KEY) === '1';
    if (!r.state) { if (!blankLocal) serverSave(); else saveDot(''); return; }
    if (dirty) { serverSave(); return; }                                   // unsaved changes here win
    if ((state.sv || 0) < r.updated && (blankLocal || state.sv)) {          // the server has something newer
      state = Object.assign(blank(), r.state, { sv: r.updated }); history = []; saveHist();
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
      render(); publishLive(true); toast('Restored your fight from the server.');
    } else if (!state.sv) serverSave();
    saveDot('');
  } catch (e) { saveDot('error'); }
}

/** Run a state mutation with undo support, then re-render. */
function mutate(fn, opts = {}) {
  if (!opts.noUndo) {
    history.push(JSON.stringify(state));
    if (history.length > 60) history.shift();
    saveHist();
  }
  fn();
  persist();
  render();
  flushPrompts();
}

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const d20 = () => Math.floor(Math.random() * 20) + 1;
const byId = id => state.combatants.find(c => c.id === id);
const num = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const isDead = c => hasCond(c, 'dead');
const hasCond = (c, k) => c.conditions.some(x => x.key === k);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200);
}
function log(text, kind = '') {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.log.unshift({ text, kind, time, round: state.round });
  if (state.log.length > 200) state.log.pop();
}

/** Monster abilities: legendary resistance / actions, recharge powers and limited-use counters. */
const d6 = () => Math.floor(Math.random() * 6) + 1;
function mkAbil(spec) {
  const [kind, a, b] = spec;
  if (kind === 'recharge') return { kind, name: a, min: b, ready: true };
  if (kind === 'lr') return { kind, name: 'Legendary Resistance', cur: a, max: a };
  if (kind === 'la') return { kind, name: 'Legendary Actions', cur: a, max: a };
  return { kind: 'uses', name: a, cur: b, max: b };
}
function rollRecharge(c, a) {
  const r = d6(); a.ready = r >= a.min;
  log(`${c.name} rolls recharge for ${a.name} (${a.min}${a.min < 6 ? '–6' : ''}): ${r} — ${a.ready ? 'recharged!' : 'still spent.'}`, 'effect');
}
/** Start of a creature's turn: legendary actions refresh and spent recharge powers are rolled for. */
function startOfTurn(c) {
  c.reacted = false;                       // a new turn gives the reaction back
  (c.abil || []).forEach(a => {
    if (a.kind === 'la' && a.cur < a.max) { a.cur = a.max; log(`${c.name}'s legendary actions refresh.`, 'effect'); }
    if (a.kind === 'recharge' && !a.ready) rollRecharge(c, a);
  });
}

/* ----- damage defences: resistance / immunity / vulnerability per damage type ----- */
const DMG_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
const PHYSICAL = ['bludgeoning', 'piercing', 'slashing'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const blankDef = () => ({ res: [], imm: [], vul: [], nm: [] });
const defOf = c => c.def || blankDef();
const hasDef = d => !!(d && (d.res.length || d.imm.length || d.vul.length));
const cloneDef = d => ({ res: [...(d && d.res || [])], imm: [...(d && d.imm || [])], vul: [...(d && d.vul || [])], nm: [...(d && d.nm || [])] });
/** Pull damage types out of free text ("fire, cold; bludgeoning from nonmagical attacks"). */
function parseTypes(txt) {
  const t = String(txt || '').toLowerCase();
  return { found: DMG_TYPES.filter(x => new RegExp('\\b' + x + '\\b').test(t)), nm: /non-?magical|\bnm\b/.test(t) };
}
function defFromText(res, imm, vul) {
  const d = blankDef();
  const add = (txt, key) => String(txt || '').split(';').forEach(seg => {
    const { found, nm } = parseTypes(seg);
    found.forEach(t => { if (!d[key].includes(t)) d[key].push(t); if (nm && PHYSICAL.includes(t) && !d.nm.includes(t)) d.nm.push(t); });
  });
  add(res, 'res'); add(imm, 'imm'); add(vul, 'vul');
  return d;
}
/** Damage after the target's defences. Immune = 0, resistant = half, vulnerable = double. */
function adjustDamage(c, amt, type, magical) {
  if (!type) return { n: amt, note: '' };
  const d = defOf(c), ignore = magical && d.nm.includes(type);
  if (!ignore && d.imm.includes(type)) return { n: 0, note: `immune to ${type}` };
  let n = amt; const parts = [];
  // Rage: resistance to bludgeoning, piercing and slashing, magical or not (resistances never stack)
  const rage = hasCond(c, 'raging') && PHYSICAL.includes(type);
  if ((!ignore && d.res.includes(type)) || rage) { n = Math.floor(n / 2); parts.push(rage ? 'resisted (raging)' : 'resisted'); }
  if (d.vul.includes(type)) { n *= 2; parts.push('vulnerable'); }
  return { n, note: parts.length ? `${parts.join(' & ')} ${type}: ${amt}→${n}` : '' };
}
const parseDt = v => [String(v || '').replace('+m', ''), String(v || '').endsWith('+m')];
const dtLabel = k => k ? (k.endsWith('+m') ? cap(k.slice(0, -2)) + ' (magic)' : cap(k)) : '';
const dtOptions = sel => `<option value="">Type…</option>${DMG_TYPES.map(t => `<option value="${t}"${sel === t ? ' selected' : ''}>${cap(t)}</option>`).join('')}${PHYSICAL.map(t => `<option value="${t}+m"${sel === t + '+m' ? ' selected' : ''}>${cap(t)} (magic)</option>`).join('')}`;
function defChips(c) {
  const d = defOf(c), mark = t => (d.nm.includes(t) ? t + '*' : t);
  const chip = (cls, label, list) => list.length ? `<button class="defchip ${cls}" data-action="openDef" data-id="${c.id}" title="${label}: ${list.join(', ')}${list.some(t => d.nm.includes(t)) ? ' (* nonmagical attacks only)' : ''}">${label} ${list.map(mark).join(', ')}</button>` : '';
  return chip('imm', 'Immune', d.imm) + chip('res', 'Resist', d.res) + chip('vul', 'Vulnerable', d.vul);
}

/* favourites list (filled from the server later; declared early because cards read it) */
const FAV_KEY = 'dragonwatch.favs';
let favs = [], favQuery = '';
const ENC_KEY = 'dragonwatch.encounters';
let encs = [], encPending = null, encRenaming = null;
const baseName = n => String(n || '').replace(/\s\d+$/, '').trim();
const isFav = n => favs.some(f => f.name.toLowerCase() === baseName(n).toLowerCase());


/* ----- markers: a short note (and an optional colour) that tells identical monsters apart on the mat ----- */
const LEGO_COLORS = [['red', '#d32f2f'], ['blue', '#1976d2'], ['yellow', '#f9c22e'], ['green', '#2e9e4f'], ['orange', '#f57c00'], ['white', '#f5f5f0'],
  ['black', '#222'], ['purple', '#7b1fa2'], ['pink', '#ec6fa5'], ['tan', '#d2b48c'], ['lime', '#a4cf2f'], ['brown', '#6d4c41']];
const EXTRA_COLORS = [['grey', '#8a8f94'], ['gray', '#8a8f94'], ['teal', '#1aa3a3'], ['gold', '#d4af37'], ['silver', '#b8bcc2']];
/** The first colour word in a marker ("red hat", "holding a blue flag"), or '' when there is none. */
const lookColor = t => { const m = String(t || '').toLowerCase().match(/\b[a-z]+\b/g) || []; for (const w of m) { const c = LEGO_COLORS.concat(EXTRA_COLORS).find(x => x[0] === w); if (c) return c[1]; } return ''; };
/** One marker per copy: Lego colours first, then pairs once the colours run out. */
const autoLooks = n => Array.from({ length: n }, (_, i) => { const a = LEGO_COLORS[i % 12][0], cap1 = x => x[0].toUpperCase() + x.slice(1); return i < 12 ? cap1(a) : `${cap1(a)} / ${cap1(LEGO_COLORS[(i + 5) % 12][0])}`; });
const lookPill = c => {
  const col = lookColor(c.look), len = Math.max(5, Math.min(18, (c.look || '').length + 1));
  return `<span class="look-pill ${c.look ? '' : 'empty'}" title="Marker: how to tell this one apart on the mat">${col ? `<i class="look-dot" style="background:${col}"></i>` : ''}<input class="look" type="text" maxlength="40" size="${c.look ? len : 8}" value="${esc(c.look || '')}" placeholder="+ marker" data-field="look" data-id="${c.id}" aria-label="Marker for ${esc(c.name)}"></span>`;
};
function syncLookField() {
  const n = Math.max(1, num($('#fCount').value, 1));
  $('#fLook').placeholder = n > 1 ? 'red, blue, green…' : 'e.g. red hat';
  $('[data-action="autoLook"]').hidden = n < 2;
  $('#fLook').classList.toggle('has-auto', n > 1);
}

function makeCombatant(o) {
  return {
    id: state.nextId++,
    name: o.name, type: o.type,
    init: o.init, mod: o.mod || 0,
    hp: o.hp, maxHp: o.hp, temp: o.temp || 0, ac: o.ac,
    conditions: [], effects: [], concentrating: false,
    saves: { s: 0, f: 0 }, notes: '',
    abil: (o.abil || []).map(mkAbil),
    def: cloneDef(o.def),
    look: String(o.look || '').slice(0, 40),
    ...(o.notes ? { notes: String(o.notes) } : {}),
  };
}

/** Sort by initiative (desc), then modifier, then name. Keeps the current turn on the same creature. */
function sortInit(keepTurn = true) {
  const activeId = state.combatants[state.turn] && state.combatants[state.turn].id;
  const ord = c => (c.ord == null ? 1e9 : c.ord); // manual drag order wins ties
  const mode = state.tie || 'mod';
  const pcFirst = (a, b) => (a.type === 'pc' ? 0 : 1) - (b.type === 'pc' ? 0 : 1);
  const rule = mode === 'pc' ? (a, b) => pcFirst(a, b) || (b.mod - a.mod)
             : mode === 'mod' ? (a, b) => (b.mod - a.mod) || pcFirst(a, b)
             : () => 0;                                   // manual: keep whatever order is there
  state.combatants.sort((a, b) => (b.init - a.init) || (ord(a) - ord(b)) || rule(a, b) || (mode === 'manual' ? 0 : a.name.localeCompare(b.name)));
  if (keepTurn && activeId != null) {
    const i = state.combatants.findIndex(c => c.id === activeId);
    state.turn = i >= 0 ? i : 0;
  }
  if (!state.started) state.turn = 0;   // before the first turn ends, the highest initiative is up
}

/* =====================================================================
   Actions
   ===================================================================== */
function addCombatants(f) {
  const count = Math.max(1, Math.min(30, f.count));
  const groupRoll = f.init == null ? d20() + f.mod : f.init;
  const base = f.name.trim();
  mutate(() => {
    for (let i = 1; i <= count; i++) {
      const name = count > 1 ? `${base} ${i}` : base;
      let init = f.init;
      const look = (f.looks || [])[i - 1] || '';
      if (init == null) init = (f.group && count > 1) ? groupRoll : d20() + f.mod;
      const c = makeCombatant({ ...f, name, init, look });
      state.combatants.push(c);
    }
    sortInit();
    log(`Added ${count > 1 ? count + '× ' : ''}${base} to combat.`);
  });
}

function nextTurn() {
  if (!state.combatants.length) return;
  mutate(() => {
    state.started = true;
    const cur = state.combatants[state.turn];
    if (cur) { tickConditions(cur); tickEffects(cur, 'turn'); }
    const n = state.combatants.length;
    for (let step = 0; step < n; step++) {
      state.turn++;
      if (state.turn >= n) { state.turn = 0; state.round++; log(`— Round ${state.round} begins —`, 'turn'); state.combatants.forEach(x => tickEffects(x, 'round')); }
      const t = state.combatants[state.turn];
      if (isDead(t)) continue;
      if (hasCond(t, 'surprised')) {          // surprise round: this creature loses its first turn
        log(`${t.name} is surprised and loses its turn.`, 'effect');
        tickConditions(t); setCond(t, 'surprised', null, false);
        continue;
      }
      break;
    }
    const a = state.combatants[state.turn];
    if (a) {
      log(`${a.name}'s turn.`, 'turn');
      if (!isDead(a)) startOfTurn(a);
      if (a.hp === 0 && a.type === 'pc' && !isDead(a) && !hasCond(a, 'stable')) log(`${a.name} must make a death saving throw.`, 'turn');
    }
  });
  announceTurn();
  $('.stage').scrollTo({ top: 0, behavior: 'smooth' });   // back to the top so the next few turns are in view (the combat area scrolls by itself on desktop)
  window.scrollTo({ top: 0, behavior: 'smooth' });          // ...and the whole page on narrow screens
}
/** When someone's turn begins, remind the DM of what is affecting them. Closed with "Read". */
function announceTurn() {
  const c = state.combatants[state.turn];
  if (!c || isDead(c) || $$('.modal:not([hidden])').length) return;
  if (c.type === 'pc' && c.hp === 0 && hasCond(c, 'dying') && !hasCond(c, 'stable')) return showDeathSave(c);
  const conds = c.conditions.filter(x => COND[x.key] && x.key !== 'dead'), effs = c.effects || [];
  if (!conds.length && !effs.length) return;
  const left = n => `${n} round${n === 1 ? '' : 's'} left`;
  $('#turnTitle').textContent = `${c.name} has ${conds.length ? 'these conditions' : 'these effects'}`;
  $('#turnKicker').textContent = effs.length && conds.length ? 'On turn · plus active effects' : 'On turn';
  $('#turnSeal').dataset.n = conds.length + effs.length;
  $('#turnSeal').style.setProperty('--n', `"${conds.length + effs.length}"`);
  $('#turnList').innerHTML =
    conds.map(x => `<div class="tc-item" style="--c:${COND[x.key].color}"><div class="tc-top"><b>${esc(COND[x.key].name)}</b>${x.dur ? `<span class="tc-dur">${left(x.dur)}</span>` : ''}</div><p>${esc(COND[x.key].desc)}</p></div>`).join('') +
    effs.map(e => `<div class="tc-item effect" style="--c:#c9a24a"><div class="tc-top"><b>${esc(e.name)}</b><span class="tc-dur">${left(e.left)}</span></div></div>`).join('');
  $('#turnModal').hidden = false;
  $('#turnRead').focus();
}
/* ----- Prompts that need an answer: death saves on a downed hero's turn, concentration checks after damage ----- */
let concQueue = [], curPrompt = null;
const modalOpen = () => $$('.modal:not([hidden])').some(m => m.id !== 'promptModal');
function openPrompt({ kind, id, seal, icon, kicker, title, body, acts }) {
  curPrompt = { kind, id };
  const sl = $('#promptSeal'); sl.className = 'turn-seal ' + seal; sl.innerHTML = ic(icon);
  $('#promptKicker').textContent = kicker; $('#promptTitle').textContent = title;
  $('#promptBody').innerHTML = body; $('#promptActs').innerHTML = acts;
  $('#promptLater').textContent = kind === 'death' ? 'Skip for now' : 'Decide later';
  $('#promptModal').hidden = false;
  const first = $('#promptActs .btn'); if (first) first.focus();
}
const dsPips = (n, cls) => `<div class="ds-pips">${[0, 1, 2].map(i => `<i class="ds-pip ${i < n ? 'on ' + cls : ''}"></i>`).join('')}</div>`;
function showDeathSave(c) {
  const sv = c.saves || { s: 0, f: 0 };
  openPrompt({
    kind: 'death', id: c.id, seal: 'dark', icon: 'hp', kicker: 'On turn · Downed', title: `${c.name} must make a death saving throw`,
    body: `<div class="tc-item" style="--c:#2e9e4f"><div class="tc-top"><b>Successes</b><span class="tc-dur">${sv.s} of 3</span></div>${dsPips(sv.s, 's')}</div>
           <div class="tc-item" style="--c:#c62828"><div class="tc-top"><b>Failures</b><span class="tc-dur">${sv.f} of 3</span></div>${dsPips(sv.f, 'f')}</div>`,
    acts: `<button type="button" class="btn" data-action="dsAnswer" data-r="s">Success (10+)</button>
           <button type="button" class="btn btn-danger" data-action="dsAnswer" data-r="f">Failure (9 or less)</button>
           <button type="button" class="btn" data-action="dsAnswer" data-r="20">Natural 20 · back up at 1 HP</button>
           <button type="button" class="btn" data-action="dsAnswer" data-r="1">Natural 1 · two failures</button>`,
  });
}
function dsAnswer(r) {
  const c = curPrompt && byId(curPrompt.id); if (!c) return closeAllModals();
  $('#promptModal').hidden = true; curPrompt = null;
  mutate(() => {
    if (r === '20') { applyHeal(c, 1); log(`${c.name} rolls a natural 20 on a death save and regains 1 HP!`, 'heal'); return; }
    if (r === '1') c.saves.f = Math.min(3, c.saves.f + 2); else if (r === 's') c.saves.s = Math.min(3, c.saves.s + 1); else c.saves.f = Math.min(3, c.saves.f + 1);
    log(`${c.name} death save: ${r === '1' ? 'natural 1 (two failures)' : r === 's' ? 'success' : 'failure'}.`, r === 's' ? 'heal' : 'dmg');
    deathCheck(c);
  });
}
function queueConc(c, dmg) {
  const dc = Math.min(30, Math.max(10, Math.floor(dmg / 2))), q = concQueue.find(x => x.id === c.id);
  if (q) { q.dc = Math.max(q.dc, dc); q.dmg += dmg; } else concQueue.push({ id: c.id, dc, dmg });
}
function flushPrompts() {
  if (curPrompt && !$('#promptModal').hidden) return;
  if (modalOpen()) return;
  while (concQueue.length) {
    const q = concQueue.shift(), c = byId(q.id);
    if (!c || !c.concentrating || isDead(c)) continue;
    openPrompt({
      kind: 'conc', id: c.id, seal: 'blue', icon: 'eye', kicker: 'Concentration check', title: `${c.name} is concentrating`,
      body: `<div class="tc-item" style="--c:#4f8fc0"><div class="tc-top"><b>Constitution save</b><span class="tc-dur">DC ${q.dc}</span></div><p>${esc(c.name)} took ${q.dmg} damage. DC is 10 or half the damage, whichever is higher (max 30).</p></div>`,
      acts: `<button type="button" class="btn btn-primary" data-action="concAnswer" data-r="ok">Passed · keeps concentrating</button>
             <button type="button" class="btn btn-danger" data-action="concAnswer" data-r="lost">Failed · concentration ends</button>`,
    });
    return;
  }
}
function concAnswer(r) {
  const c = curPrompt && byId(curPrompt.id); $('#promptModal').hidden = true; curPrompt = null;
  if (!c) return flushPrompts();
  mutate(() => {
    if (r === 'ok') log(`${c.name} keeps concentrating.`, 'effect');
    else { setCond(c, 'concentrating', null, false); log(`${c.name} loses concentration.`, 'effect'); }
  });
}
function prevTurn() {
  if (!state.combatants.length) return;
  mutate(() => {
    const n = state.combatants.length;
    for (let step = 0; step < n; step++) {
      state.turn--;
      if (state.turn < 0) {
        if (state.round <= 1) { state.turn = 0; break; }
        state.turn = n - 1; state.round--;
      }
      if (!isDead(state.combatants[state.turn])) break;
    }
  });
}

/** Called when a creature's turn ends: decrement timed conditions. */
function tickConditions(c) {
  c.conditions = c.conditions.filter(x => {
    if (x.dur == null) return true;
    x.dur -= 1;
    if (x.dur <= 0) { log(`${COND[x.key].name} on ${c.name} has ended.`, 'effect'); return false; }
    return true;
  });
}

/** Timed effects (Bless, Haste, Hold Person…): `left` counts rounds down, either every new round or at the end of the bearer's turn. */
function tickEffects(c, mode) {
  if (!c.effects || !c.effects.length) return;
  c.effects = c.effects.filter(e => {
    if ((e.tick || 'round') !== mode) return true;
    e.left -= 1;
    if (e.left <= 0) { log(`${e.name} on ${c.name} has ended.`, 'effect'); toast(`${e.name} on ${c.name} has ended.`); return false; }
    return true;
  });
}

function setCond(c, key, dur, add) {
  const i = c.conditions.findIndex(x => x.key === key);
  if (add === undefined) add = i < 0;
  if (!add) {
    if (i >= 0) { c.conditions.splice(i, 1); log(`${c.name} is no longer ${COND[key].name}.`, 'effect'); }
    if (key === 'concentrating') c.concentrating = false;
    return;
  }
  if (i >= 0) { c.conditions[i].dur = dur; return; }
  const entry = { key, dur: dur || null };
  if (COND[key].levels) entry.level = 1;
  c.conditions.push(entry);
  if (key === 'concentrating') c.concentrating = true;
  log(`${c.name} is now ${COND[key].name}${dur ? ' (' + dur + ' rounds)' : ''}.`, 'effect');
  if (key === 'dead') { c.hp = 0; c.effects = []; }
}

function applyDamage(c, amt, type = '', magical = false) {
  const adj = adjustDamage(c, amt, type, magical);
  if (adj.n <= 0) { log(`${c.name} is ${adj.note || 'unaffected'} — no damage.`, 'effect'); return; }
  amt = adj.n;
  let left = amt, absorbed = 0;
  if (c.temp > 0) { absorbed = Math.min(c.temp, left); c.temp -= absorbed; left -= absorbed; }
  const before = c.hp;
  c.hp = Math.max(0, c.hp - left);
  log(`${c.name} takes ${amt}${type ? ' ' + type : ''} damage${adj.note ? ` (${adj.note})` : ''}${absorbed ? ` (${absorbed} absorbed by temp HP)` : ''}. [${c.hp}/${c.maxHp}]`, 'dmg');

  if (c.hp === 0 && before > 0) {
    if (c.type === 'pc') {
      c.saves = { s: 0, f: 0 };
      setCond(c, 'unconscious', null, true);
      setCond(c, 'prone', null, true);
      setCond(c, 'dying', null, true);
      log(`${c.name} drops to 0 HP and is downed!`, 'dmg');
    } else {
      setCond(c, 'dead', null, true);
      log(`${c.name} is slain.`, 'dmg');
    }
    c.concentrating = false; setCond(c, 'concentrating', null, false);
  } else if (c.hp === 0 && c.type === 'pc' && !hasCond(c, 'dead')) {
    c.saves.f = Math.min(3, c.saves.f + 1); // damage at 0 HP = failed death save
    if (c.saves.f >= 3) setCond(c, 'dead', null, true);
  } else if (c.concentrating && amt > 0) {
    log(`${c.name} must make a CON save (DC ${Math.min(30, Math.max(10, Math.floor(amt / 2)))}) to keep concentrating.`, 'effect');
    queueConc(c, amt);
  }
}
function applyHeal(c, amt) {
  const before = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + amt);
  log(`${c.name} heals ${c.hp - before} HP. [${c.hp}/${c.maxHp}]`, 'heal');
  if (before === 0 && c.hp > 0) {
    ['unconscious', 'dying', 'stable', 'dead'].forEach(k => setCond(c, k, null, false));
    c.saves = { s: 0, f: 0 };
  }
}

/* =====================================================================
   Rendering
   ===================================================================== */
function condChip(c, x) {
  const d = COND[x.key];
  const lvl = d.levels ? `<span class="lvl" data-action="exLevel" data-id="${c.id}" title="Click to change level">Lv ${x.level}</span>` : '';
  const dur = x.dur ? `<span class="dur">${x.dur} R</span>` : '';
  return `<span class="cond" style="--c:${d.color}" title="${esc(d.name)} — ${esc(d.desc)}">
    ${esc(d.name)} ${lvl}${dur}
    <button class="rm" data-action="rmCond" data-id="${c.id}" data-key="${x.key}" title="Remove">${ic('x')}</button></span>`;
}

const effChip = (c, e) => `<span class="cond eff ${e.left <= 1 ? 'low' : ''}" style="--c:#d9a441" title="${esc(e.name)} — ${e.left} round${e.left === 1 ? '' : 's'} left, counts down ${e.tick === 'turn' ? 'at the end of its turn' : 'every round'}${e.secret ? ' · hidden from players' : ''}">
    ${esc(e.name)}${e.secret ? ' <span class="lvl" title="Hidden from players">hidden</span>' : ''}<span class="dur" data-action="effPlus" data-id="${c.id}" data-eff="${esc(e.id)}" title="Click to add a round">${e.left} R</span>
    <button class="rm" data-action="rmEff" data-id="${c.id}" data-eff="${esc(e.id)}" title="Remove">${ic('x')}</button></span>`;

function card(c, idx) {
  const pct = c.maxHp ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 0;
  const tempPct = c.maxHp ? Math.min(100, (c.temp / c.maxHp) * 100) : 0;
  const fillCls = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '';
  const active = idx === state.turn;
  const dead = isDead(c);
  const down = c.hp === 0;
  const bloodied = c.hp > 0 && c.hp <= c.maxHp / 2;
  const typeLabel = { pc: 'PC', monster: 'Monster', npc: 'NPC' }[c.type];

  const deathSaves = (c.type === 'pc' && down && !dead && !hasCond(c, 'stable')) ? `
    <div class="deathsaves">
      <b>Death saves</b>
      <span class="pips">Success ${[1,2,3].map(i => `<button class="pip s ${c.saves.s >= i ? 'on' : ''}" data-action="save" data-id="${c.id}" data-kind="s" data-n="${i}"></button>`).join('')}</span>
      <span class="pips">Fail ${[1,2,3].map(i => `<button class="pip f ${c.saves.f >= i ? 'on' : ''}" data-action="save" data-id="${c.id}" data-kind="f" data-n="${i}"></button>`).join('')}</span>
      <button class="btn sm" data-action="rollSave" data-id="${c.id}">${ic('dice')}Roll</button>
      <button class="btn sm" data-action="stabilize" data-id="${c.id}">Stabilize</button>
    </div>` : '';

  return `
  <article class="card ${c.type} ${c.secret ? 'secret' : ''} ${active ? 'active' : ''} ${dead ? 'dead' : ''} ${down ? 'down' : ''}" data-id="${c.id}">
    <div class="init">
      <span class="grip" title="Drag to reorder">${ic('grip', 'fill')}</span>
      <small>Init</small>
      <input class="init-num" type="number" value="${c.init}" data-field="init" data-id="${c.id}" title="Initiative">
      <button class="roll" data-action="rollInit" data-id="${c.id}" title="Re-roll initiative (d20 ${c.mod >= 0 ? '+' : ''}${c.mod})">${ic('dice')}</button>
      ${state.combatants.some(o => o !== c && o.init === c.init) ? '<span class="tie" title="Tied initiative — order set by the tie-break rule">tie</span>' : ''}
      ${dead ? '' : `<button type="button" class="react ${c.reacted ? 'used' : ''}" data-action="toggleReact" data-id="${c.id}" aria-pressed="${!!c.reacted}" title="${c.reacted ? 'Reaction used. Click to mark it ready again' : 'Reaction ready. Click when it uses one. It resets at the start of its turn'}"><i></i>${c.reacted ? 'Used' : 'Ready'}</button>`}
    </div>
    <div class="body">
      <div class="head">
        <input class="name" value="${esc(c.name)}" data-field="name" data-id="${c.id}">
        ${lookPill(c)}
        <span class="tag">${typeLabel}</span>
        <span class="badge ac" title="Armor Class">${ic('ac','stat')} <input type="number" value="${c.ac}" data-field="ac" data-id="${c.id}"></span>
        <span class="badge plain" title="Initiative modifier">Mod <input type="number" value="${c.mod}" data-field="mod" data-id="${c.id}"></span>
        ${c.pp != null ? `<span class="badge" title="Passive Perception">${ic('pp','stat')} ${c.pp}</span>` : ''}
        ${bloodied ? '<span class="badge bloodied">Bloodied</span>' : ''}
        <div class="icon-btns">
          <button class="ibtn ${c.secret ? 'on' : ''}" data-action="toggleSecret" data-id="${c.id}" title="${c.secret ? 'Hidden from players — click to reveal' : 'Visible to players — click to hide from the player view'}">${ic(c.secret ? 'eye-off' : 'eye')}</button>
          ${c.type !== 'pc' ? `<button class="ibtn ${isFav(c.name) ? 'on' : ''}" data-action="favCard" data-id="${c.id}" title="${isFav(c.name) ? 'Favourited — click to update the saved version' : 'Save to your Favorited monsters'}">${ic('star')}</button>` : ''}
          <button class="ibtn" data-action="setTurn" data-id="${c.id}" title="Make this the active turn">${ic('play')}</button>
          <button class="ibtn" data-action="dup" data-id="${c.id}" title="Duplicate">${ic('copy')}</button>
          <button class="ibtn del" data-action="del" data-id="${c.id}" title="Remove from combat">${ic('trash')}</button>
        </div>
      </div>

      <div class="hp-row">
        <div class="hpbar" title="${c.hp}/${c.maxHp} HP${c.temp ? ' + ' + c.temp + ' temp' : ''}">
          <div class="hpfill ${fillCls}" style="width:${pct}%"></div>
          ${c.temp ? `<div class="hptemp" style="width:${tempPct}%"></div>` : ''}
          <div class="hptext">
            <span class="hpico">${ic('hp','stat')}</span>
            <input type="number" value="${c.hp}" data-field="hp" data-id="${c.id}"> /
            <input type="number" value="${c.maxHp}" data-field="maxHp" data-id="${c.id}">
            ${c.temp ? `<span class="tmp">${ic('temp','stat')} +${c.temp}</span>` : ''}
          </div>
        </div>
        <div class="hpctl">
          <input class="amt" type="number" min="0" placeholder="amt" data-amt="${c.id}">
          <input type="text" class="dtype" data-combo="dtype" data-dtype="${c.id}" data-key="${esc(c.dt || '')}" value="${esc(dtLabel(c.dt || ''))}" placeholder="Type…" autocomplete="off" title="Damage type: type to search. Resistances, immunities and vulnerabilities apply" aria-label="Damage type">
          <button class="btn sm dmg" data-action="dmg" data-id="${c.id}">Damage</button>
          <button class="btn sm heal" data-action="heal" data-id="${c.id}">Heal</button>
          <button class="btn sm temp" data-action="temp" data-id="${c.id}">Temp HP</button>
        </div>
      </div>

      ${deathSaves}

      <div class="conds">
        ${c.conditions.map(x => condChip(c, x)).join('')}
        ${(c.effects || []).map(e => effChip(c, e)).join('')}
        ${defChips(c)}
        <button class="add-cond" data-action="openConds" data-id="${c.id}">${ic('plus')}Condition</button>
        <button class="add-cond" data-action="openEff" data-id="${c.id}" title="A spell or effect that lasts a number of rounds (Bless, Haste, Hold Person…)">${ic('plus')}Effect</button>
        ${c.type !== 'pc' ? `<button class="add-cond" data-action="openAbil" data-id="${c.id}" title="Legendary resistance, recharge powers, limited uses">${ic('plus')}Ability</button>` : ''}
        <button class="add-cond" data-action="openDef" data-id="${c.id}" title="Resistances, immunities and vulnerabilities">${ic('plus')}Defences</button>
        ${c.concentrating ? '' : `<button class="add-cond" data-action="toggleConc" data-id="${c.id}" title="Mark as concentrating on a spell">Concentrating</button>`}
      </div>

      ${abilHtml(c)}
      ${(() => { const pc = c.pcId != null && typeof party !== 'undefined' ? party.find(x => x.id === c.pcId) : null; return pc ? resHtml(pc) : ''; })()}

      <textarea class="notes" placeholder="Notes (resistances, legendary actions, spell slots…)" data-field="notes" data-id="${c.id}">${esc(c.notes)}</textarea>
    </div>
  </article>`;
}

/** Replace the list's HTML; if only the order changed (a turn ended), slide the cards to their new places. */
function flipList(list, html) {
  const first = {}, before = [];
  list.querySelectorAll(':scope > .card[data-id]').forEach(el => { first[el.dataset.id] = el.getBoundingClientRect().top; before.push(el.dataset.id); });
  list.innerHTML = html;
  const cards = [...list.querySelectorAll(':scope > .card[data-id]')];
  const after = cards.map(el => el.dataset.id);
  if (before.length < 2 || before.join() === after.join() || before.slice().sort().join() !== after.slice().sort().join()) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  cards.forEach(el => {
    const dy = first[el.dataset.id] - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 2) return;
    el.style.zIndex = dy < 0 ? 1 : 2;   // a card sinking to the bottom passes BEHIND the cards rising past it
    const base = getComputedStyle(el).transform, b = base === 'none' ? '' : ' ' + base;
    const a = el.animate([{ transform: `translateY(${dy}px)${b}` }, { transform: base }], { duration: 520, easing: 'cubic-bezier(.22,.8,.24,1)' });
    a.onfinish = a.oncancel = () => { el.style.zIndex = ''; };
  });
}

function render() {
  $('#roundNum').textContent = state.round;
  $('#tieLabel').textContent = TIE_NAME[state.tie || 'mod'];
  const list = $('#list');
  // Once combat has started the list cycles: whoever is on turn sits on top, whoever just finished drops to the bottom.
  const n = state.combatants.length, t = state.started && n ? state.turn % n : 0;
  const shown = state.combatants.map((c, i) => ({ c, i }));
  const cycled = shown.slice(t).concat(shown.slice(0, t)).filter(({ c }) => filter === 'all' || c.type === filter);

  // Preserve focus & caret across re-renders
  const ae = document.activeElement;
  const focus = ae && ae.dataset && (ae.dataset.field || ae.dataset.amt) ? { f: ae.dataset.field, a: ae.dataset.amt, id: ae.dataset.id || ae.dataset.amt, s: ae.selectionStart, e: ae.selectionEnd } : null;

  flipList(list, cycled.map(({ c, i }) => card(c, i)).join(''));
  $('#empty').hidden = state.combatants.length > 0;

  if (focus) {
    const sel = focus.f ? `[data-field="${focus.f}"][data-id="${focus.id}"]` : `[data-amt="${focus.id}"]`;
    const el = $(sel, list);
    if (el) { el.focus(); try { el.setSelectionRange(focus.s, focus.e); } catch (e) { /* number inputs */ } }
  }

  publishLive();
  scheduleWin();
  const alive = state.combatants.filter(c => !isDead(c));
  $('#stats').innerHTML = `
    <span><b>${state.combatants.length}</b> combatants</span>
    <span><b>${alive.filter(c => c.type === 'pc').length}</b> PCs up</span>
    <span><b>${alive.filter(c => c.type === 'monster').length}</b> foes up</span>`;

  $('#log').innerHTML = state.log.slice(0, 80).map(e => `<div class="e ${e.kind === 'cond' ? 'effect' : e.kind}"><small>R${e.round} ${e.time}</small>${esc(e.text)}</div>`).join('') || '<div class="e">The chronicle is empty.</div>';

  document.title = state.combatants.length ? `R${state.round} · ${(state.combatants[state.turn] || {}).name || ''} — Dragonwatch` : 'Dragonwatch — D&D Combat Tracker';
  if (!$('#condModal').hidden) renderModal();
  syncParty();
  renderParty();
}

/* ----- Condition modal ----- */
function openConds(id) {
  modal = { id, cat: 'All', q: '' };
  $('#condSearch').value = ''; $('#condDur').value = '';
  $('#condModal').hidden = false;
  $('#condGrid').scrollTop = 0;
  renderModal();
  $('#condSearch').focus();
}
function closeModal() { $('#condModal').hidden = true; modal.id = null; }
function renderModal() {
  const c = byId(modal.id);
  if (!c) return closeModal();
  $('#condTitle').textContent = `Conditions — ${c.name}`;
  $('#condTabs').innerHTML = CATS.map(k => `<button class="chip-btn ${modal.cat === k ? 'active' : ''}" data-action="modalCat" data-cat="${k}">${k}</button>`).join('');
  const q = modal.q.toLowerCase();
  const items = CONDITIONS.filter(d => (modal.cat === 'All' || d.cat === modal.cat) && (!q || d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q)));
  $('#condGrid').innerHTML = items.map(d => `
    <button class="opt ${hasCond(c, d.key) ? 'on' : ''}" style="--c:${d.color}" data-action="pickCond" data-key="${d.key}">
      <b>${esc(d.name)}${hasCond(c, d.key) ? '<em class="on-mark">Active</em>' : ''}</b><span>${esc(d.desc)}</span>
    </button>`).join('') || '<p style="color:var(--muted)">No matches.</p>';
}

function renderStatic() {
  renderLegend('');
}
function renderLegend(q) {
  q = q.toLowerCase();
  $('#legend').innerHTML = CONDITIONS.filter(d => !q || d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q))
    .map(d => `<div class="li" style="--c:${d.color}"><b>${esc(d.name)}</b><span>${esc(d.desc)}</span></div>`).join('');
}

/* =====================================================================
   Events
   ===================================================================== */
document.addEventListener('click', e => {
  const bestBtn = e.target.closest('[data-best]');
  if (bestBtn) { pickMonster(bestResults[+bestBtn.dataset.best]); return; }
  const fbtn = e.target.closest('[data-filter]');
  if (fbtn) {
    filter = fbtn.dataset.filter;
    $$('[data-filter]').forEach(b => b.classList.toggle('active', b === fbtn));
    render(); return;
  }
  if (e.target.classList && e.target.classList.contains('modal')) return closeAllModals();

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const charId = btn.dataset.char ? +btn.dataset.char : null;
  const id = btn.dataset.id ? +btn.dataset.id : null;
  const c = id != null ? byId(id) : null;
  const amtEl = id != null ? $(`[data-amt="${id}"]`) : null;
  const amt = amtEl ? num(amtEl.value) : 0;

  switch (btn.dataset.action) {
    case 'nextTurn': return nextTurn();
    case 'prevTurn': return prevTurn();
    case 'undo': return undo();
    case 'sortInit': return mutate(() => { sortInit(); log('Initiative re-sorted.'); });
    case 'rollAll': return mutate(() => { state.combatants.forEach(x => x.init = d20() + x.mod); sortInit(false); state.turn = 0; state.round = 1; state.started = false; log('Initiative rolled for everyone.', 'turn'); });
    case 'newEncounter':
      askConfirm({ title: 'New encounter', message: 'Clear all combatants and start a fresh encounter? You can still undo this.', yes: 'Clear Encounter', icon: 'swords' })
        .then(ok => { if (ok) mutate(() => { state = Object.assign(blank(), { nextId: state.nextId }); }); });
      return;
    case 'rollOff': closeTie(); return rollOff();
    case 'openAoe': return openAoe();
    case 'toggleSurprise': { const m = $('#surpriseMenu'); m.hidden = !m.hidden; $('#surpriseBtn').setAttribute('aria-expanded', String(!m.hidden)); return; }
    case 'toggleTie': { const m = $('#tieMenu'); m.hidden = !m.hidden; $('#tieBtn').setAttribute('aria-expanded', String(!m.hidden)); return; }
    case 'setTie': closeTie(); return setTie(btn.dataset.v);
    case 'surprise': closeSurprise(); return applySurprise(btn.dataset.who);
    case 'aoePick': return aoePick(btn.dataset.pick);
    case 'openDef': return openDef(+btn.dataset.id);
    case 'openAcct': return openAcct();
    case 'acctTab': return acctTab(btn.dataset.tab);
    case 'acctSignOut': return signOut();
    case 'acctRotate': return rotateRoom();
    case 'trashRestore': return trashAct('restore', btn.dataset.type, +btn.dataset.id);
    case 'trashDelete': return trashAct('delete', btn.dataset.type, +btn.dataset.id);
    case 'trashEmpty': return trashEmpty();
    case 'userDelete': return userDelete(+btn.dataset.id);
    case 'userReset': return userReset(+btn.dataset.id);
    case 'openSaveEnc': return openSaveEnc();
    case 'loadEnc': return loadEncClick(+btn.dataset.id);
    case 'encLoadAdd': return doLoadEnc(false);
    case 'encLoadReplace': return doLoadEnc(true);
    case 'renameEnc': return renameEnc(+btn.dataset.id);
    case 'delEnc': return delEnc(+btn.dataset.id);
    case 'quickEff': { $('#effName').value = btn.dataset.n; $('#effDur').value = btn.dataset.d; $('#effUnit').value = 'r'; $('#effName').focus(); break; }
            case 'favCard': return favFromCard(+btn.dataset.id);
    case 'favBest': return favFromSearch(+btn.dataset.i);
    case 'rmFav': return removeFav(+btn.dataset.id);
    case 'openImport': return openImport();
    case 'openLab': return openLab();
    case 'atkFav': return openAtk(+btn.dataset.id);
    case 'toggleSecret': { const sc = byId(id); if (sc) mutate(() => { sc.secret = !sc.secret; log(`${sc.name} is now ${sc.secret ? 'hidden from' : 'visible to'} the player view.`, 'effect'); }); return; }
    case 'openLive': return openLive();
    case 'downloadRecap': return downloadRecap();
    case 'clearLog': return mutate(() => { state.log = []; }, { noUndo: true });
    case 'rmAbil': { const ac = byId(abilFor); if (ac && ac.abil) { const [gone] = ac.abil.splice(+btn.dataset.a, 1); mutate(() => log(`${ac.name} loses ${gone.name}.`, 'effect')); renderAbilList(); } return; }
    case 'closeModal': return closeModal();
    case 'closeModals': { const was = curPrompt; closeAllModals(); if (was && was.kind === 'conc') flushPrompts(); return; }
    case 'spawnAuto': { const l = autoLooks($$('#spawnRows .spawn-row').length); $$('#spawnRows .sp-look').forEach((inp, i) => { inp.value = l[i]; spawnDot(inp.closest('.spawn-row')); }); return; }
    case 'spawnRoll': { const r = $(`#spawnRows [data-sp="${btn.dataset.sp}"].spawn-row, #spawnRows .spawn-row[data-sp="${btn.dataset.sp}"]`); if (r && spawnForm) r.querySelector('[data-sp="init"]').value = d20() + spawnForm.mod; return; }
    case 'dsAnswer': return dsAnswer(btn.dataset.r);
    case 'concAnswer': return concAnswer(btn.dataset.r);
    case 'toggleWin': return toggleWin();
    case 'rollRow': return rollRow(charId);
    case 'newCampaign': return openNameModal('create');
    case 'renameCampaign': return openNameModal('rename');
    case 'deleteCampaign': return deleteCampaign();
    case 'addChar': return openCharModal();
    case 'levelUp': return openLevelUp();
    case 'addClass': editCls = formClasses().concat([{ name: '', level: 1 }]); renderClsRows(); { const n = $$('#clsRows .c-name'); n[n.length - 1].focus(); } return;
    case 'rmClass': editCls = formClasses().filter((c, i) => i !== +btn.dataset.ci); renderClsRows(); return;
    case 'longRest': return longRest();
    case 'shortRest': return shortRest();
    case 'resPip': return resPip(charId, +btn.dataset.r, +btn.dataset.i);
    case 'resAdj': return resAdj(charId, +btn.dataset.r, +btn.dataset.d);
    case 'fillSlots': return fillSlots();
    case 'addClassRes': return addClassRes();
    case 'autoLook': $('#fLook').value = autoLooks(Math.max(1, Math.min(30, num($('#fCount').value, 1)))).join(', '); return;
    case 'rmRes': editRes.splice(+btn.dataset.r, 1); return renderResRows();
    case 'editChar': return openCharModal(charId);
    case 'delChar': return deleteChar(charId);
    case 'toCombat': return addCharsToCombat([charId]);
    case 'addParty': return addCharsToCombat(party.map(p => p.id));
    case 'modalCat': modal.cat = btn.dataset.cat; return renderModal();
    case 'pickCond': {
      const mc = byId(modal.id); if (!mc) return;
      const dur = num($('#condDur').value, 0) || null;
      return mutate(() => setCond(mc, btn.dataset.key, dur));
    }
  }
  if (!c) return;
  switch (btn.dataset.action) {
    case 'dmg':  if (amt > 0) {
      const dtEl = $(`[data-dtype="${c.id}"]`), dtv = dtEl ? (dtEl.dataset.key || '') : '', [dt, mag] = parseDt(dtv);
      mutate(() => { applyDamage(c, amt, dt, mag); c.dt = ''; });   // the type goes back to the default after every hit
    } else toast('Enter an amount first.'); break;
    case 'heal': if (amt > 0) mutate(() => applyHeal(c, amt)); else toast('Enter an amount first.'); break;
    case 'temp': if (amt > 0) mutate(() => { c.temp = amt; log(`${c.name} gains ${amt} temp HP.`, 'heal'); }); else toast('Enter an amount first.'); break;
    case 'del':  mutate(() => {
      const idx = state.combatants.indexOf(c);
      state.combatants.splice(idx, 1);
      if (idx < state.turn) state.turn--;
      if (state.turn >= state.combatants.length) state.turn = 0;
      log(`${c.name} removed from combat.`);
    }); break;
    case 'dup': mutate(() => {
      const copy = JSON.parse(JSON.stringify(c)); copy.id = state.nextId++;
      copy.name = c.name.replace(/\s\d+$/, '') + ' ' + (state.combatants.filter(x => x.name.startsWith(c.name.replace(/\s\d+$/, ''))).length + 1);
      copy.hp = copy.maxHp; (copy.abil || []).forEach(x => { x.cur = x.max; x.ready = true; }); copy.conditions = []; copy.effects = []; copy.saves = { s: 0, f: 0 }; delete copy.pcId; copy.look = '';   // a copy needs its own marker
      const act = state.combatants[state.turn]; state.combatants.push(copy); sortInit(false);
      state.turn = state.started ? Math.max(0, state.combatants.indexOf(act)) : 0;
    }); break;
    case 'setTurn': mutate(() => { state.started = true; state.turn = state.combatants.indexOf(c); log(`${c.name}'s turn.`, 'turn'); c.reacted = false; }); announceTurn(); break;
    case 'rollInit': mutate(() => { c.init = d20() + c.mod; sortInit(); log(`${c.name} rolls initiative: ${c.init}.`); }); break;
    case 'openConds': openConds(id); break;
    case 'openEff': openEff(id); break;
    case 'rmEff': mutate(() => { const e = (c.effects || []).find(x => x.id === btn.dataset.eff); if (e) { c.effects = c.effects.filter(x => x !== e); log(`${e.name} ended early on ${c.name}.`, 'effect'); } }); break;
    case 'effPlus': mutate(() => { const e = (c.effects || []).find(x => x.id === btn.dataset.eff); if (e) e.left += 1; }); break;
    case 'openAbil': openAbil(id); break;
    case 'abilPip':  { const a = (c.abil || [])[+btn.dataset.a]; if (a) abilSet(c, a, +btn.dataset.i < a.cur ? a.cur - 1 : a.cur + 1); break; }
    case 'abilStep': { const a = (c.abil || [])[+btn.dataset.a]; if (a) abilSet(c, a, a.cur + +btn.dataset.d); break; }
    case 'abilToggle': { const a = (c.abil || [])[+btn.dataset.a]; if (a) mutate(() => { a.ready = !a.ready; log(a.ready ? `${c.name}'s ${a.name} is ready again.` : `${c.name} uses ${a.name} (recharge ${a.min}${a.min < 6 ? '–6' : ''}).`, 'effect'); }); break; }
    case 'abilRoll': { const a = (c.abil || [])[+btn.dataset.a]; if (a) mutate(() => rollRecharge(c, a)); break; }
    case 'toggleReact': mutate(() => { c.reacted = !c.reacted; if (c.reacted) log(`${c.name} uses its reaction.`, 'effect'); }); break;
    case 'toggleConc': mutate(() => setCond(c, 'concentrating', null, !c.concentrating)); break;
    case 'rmCond': mutate(() => setCond(c, btn.dataset.key, null, false)); break;
    case 'exLevel': mutate(() => { const x = c.conditions.find(k => k.key === 'exhaustion'); x.level = x.level % 6 + 1; if (x.level === 6) log(`${c.name} reaches exhaustion level 6 — death.`, 'dmg'); }); break;
    case 'save': mutate(() => {
      const k = btn.dataset.kind, n = +btn.dataset.n;
      c.saves[k] = c.saves[k] === n ? n - 1 : n;
      deathCheck(c);
    }); break;
    case 'rollSave': mutate(() => {
      const r = d20();
      if (r === 20) { applyHeal(c, 1); log(`${c.name} rolls a natural 20 on a death save and regains 1 HP!`, 'heal'); return; }
      if (r === 1) c.saves.f = Math.min(3, c.saves.f + 2); else if (r >= 10) c.saves.s = Math.min(3, c.saves.s + 1); else c.saves.f = Math.min(3, c.saves.f + 1);
      log(`${c.name} death save: ${r} (${r >= 10 ? 'success' : 'failure'}).`, r >= 10 ? 'heal' : 'dmg');
      deathCheck(c);
    }); break;
    case 'stabilize': mutate(() => { c.saves = { s: 0, f: 0 }; setCond(c, 'dying', null, false); setCond(c, 'stable', null, true); }); break;
  }
});

function deathCheck(c) {
  if (c.saves.f >= 3) { setCond(c, 'dying', null, false); setCond(c, 'dead', null, true); log(`${c.name} has died.`, 'dmg'); }
  else if (c.saves.s >= 3) { c.saves = { s: 0, f: 0 }; setCond(c, 'dying', null, false); setCond(c, 'stable', null, true); log(`${c.name} stabilises.`, 'heal'); }
}

/* inline field edits */
document.addEventListener('change', e => {
  const el = e.target;
  const f = el.dataset && el.dataset.field;
  if (!f) return;
  const c = byId(+el.dataset.id); if (!c) return;
  mutate(() => {
    if (f === 'name' || f === 'notes') c[f] = el.value;
    else if (f === 'look') c.look = el.value.trim().slice(0, 40);
    else if (f === 'init') { c.init = num(el.value); sortInit(); }
    else if (f === 'hp') {
      const v = Math.max(0, Math.min(c.maxHp, num(el.value)));
      if (v === 0 && c.hp > 0) applyDamage(c, c.hp); else if (v > c.hp && c.hp === 0) applyHeal(c, v); else c.hp = v;
    }
    else if (f === 'maxHp') { c.maxHp = Math.max(1, num(el.value, 1)); c.hp = Math.min(c.hp, c.maxHp); }
    else c[f] = num(el.value);
  });
});

/* keyboard */
document.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Escape' && $$('.modal:not([hidden])').length) return closeAllModals();
  if (t.dataset && t.dataset.amt && e.key === 'Enter') {
    e.preventDefault();
    const btn = $(`[data-action="${e.shiftKey ? 'heal' : 'dmg'}"][data-id="${t.dataset.amt}"]`);
    if (btn) btn.click();
    return;
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); return undo(); }
  if (typing || $$('.modal:not([hidden])').length) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); nextTurn(); }
  if (e.key === 'p' || e.key === 'P') prevTurn();
});

$('#condSearch').addEventListener('input', e => { modal.q = e.target.value; renderModal(); });
$('#legendSearch').addEventListener('input', e => renderLegend(e.target.value));

let pendingAbil = null, pendingName = '', pendingDef = null, pendingNotes = '';
$('#fCount').addEventListener('input', syncLookField);
syncLookField();
$('#fName').addEventListener('input', e => { if (pendingAbil && !e.target.value.toLowerCase().startsWith(pendingName.toLowerCase())) pendingAbil = null; pendingDef = null; pendingNotes = ''; });
$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  const initRaw = $('#fInit').value.trim();
  const form = {
    name: $('#fName').value || 'Unnamed',
    type: $('#fType').value,
    count: num($('#fCount').value, 1),
    mod: num($('#fMod').value),
    init: initRaw === '' ? null : num(initRaw),
    ac: num($('#fAC').value, 10),
    hp: Math.max(1, num($('#fHP').value, 1)),
    temp: Math.max(0, num($('#fTemp').value)),
    group: false,
    looks: (() => { const t = $('#fLook').value.trim(), n = Math.max(1, num($('#fCount').value, 1)); return n > 1 ? t.split(',').map(x => x.trim()) : [t]; })(),
    abil: pendingAbil, def: pendingDef, notes: pendingNotes,
  };
  openSpawn(form);     // marker, initiative, AC and HP are filled in per creature in the dialog
});

/* ----- Summon several monsters / NPCs: per-creature marker, initiative, AC and HP ----- */
let spawnForm = null;
function openSpawn(f) {
  spawnForm = f;
  const n = Math.max(1, Math.min(30, f.count)), nm = f.name.trim() || 'Unnamed';
  $('#spawnTitle').textContent = n > 1 ? `Summon ${n} × ${nm}` : `Summon ${nm}`;
  $('[data-action="spawnAuto"]').hidden = n < 2;
  $('#spawnRows').innerHTML = Array.from({ length: n }, (_, i) => `
    <div class="spawn-row ${f.type}" data-sp="${i}">
      <div class="spawn-who"><i class="spawn-dot"></i><b>${esc(nm)}${n > 1 ? ' ' + (i + 1) : ''}</b></div>
      <input class="sp-look" type="text" maxlength="40" data-sp="look" value="${esc((f.looks || [])[i] || '')}" placeholder="e.g. red hat" aria-label="Marker for ${esc(f.name)} ${i + 1}">
      <input type="number" data-sp="init" value="${f.init == null ? '' : f.init}" placeholder="roll" aria-label="Initiative">
      <input type="number" data-sp="ac" value="${f.ac}" min="0" aria-label="AC">
      <input type="number" data-sp="hp" value="${f.hp}" min="1" aria-label="Max HP">
      <input type="number" data-sp="temp" value="${f.temp || 0}" min="0" aria-label="Temp HP">
      <button type="button" class="ibtn" data-action="spawnRoll" data-sp="${i}" title="Roll d20 ${f.mod >= 0 ? '+' : '−'} ${Math.abs(f.mod)}">${ic('dice')}</button>
    </div>`).join('');
  $$('#spawnRows .spawn-row').forEach(spawnDot);
  $('#spawnModal').hidden = false;
  const first = $('#spawnRows .sp-look'); if (first) first.focus();
}
function spawnDot(row) { const d = row.querySelector('.spawn-dot'), col = lookColor(row.querySelector('.sp-look').value); d.style.background = col || 'transparent'; d.style.borderStyle = col ? 'solid' : 'dashed'; }
$('#spawnRows').addEventListener('input', e => { if (e.target.classList.contains('sp-look')) spawnDot(e.target.closest('.spawn-row')); });
$('#spawnForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = spawnForm; if (!f) return;
  const rows = $$('#spawnRows .spawn-row').map(r => {
    const v = k => r.querySelector(`[data-sp="${k}"]`).value.trim();
    return { look: v('look'), init: v('init') === '' ? null : num(v('init')), ac: num(v('ac'), f.ac), hp: Math.max(1, num(v('hp'), f.hp)), temp: Math.max(0, num(v('temp'), 0)) };
  });
  const base = f.name.trim() || 'Unnamed';
  closeAllModals();
  mutate(() => {
    rows.forEach((r, i) => {
      const c = makeCombatant({ ...f, name: rows.length > 1 ? `${base} ${i + 1}` : base, init: r.init == null ? d20() + f.mod : r.init, ac: r.ac, hp: r.hp, temp: r.temp, look: r.look });
      state.combatants.push(c);
    });
    sortInit();
    log(rows.length > 1 ? `Added ${rows.length}× ${base} to combat.` : `Added ${base} to combat.`);
  });
  spawnForm = null; pendingAbil = null; pendingDef = null; pendingNotes = '';
  $('#fName').value = ''; $('#fInit').value = ''; $('#fCount').value = 1; $('#fLook').value = ''; $('#fAC').value = 12; $('#fHP').value = 10; $('#fTemp').value = 0; syncLookField(); $('#fName').focus();
});

/* =====================================================================
   Undo
   ===================================================================== */
function undo() {
  const prev = history.pop(); saveHist();
  if (!prev) return toast('Nothing to undo.');
  state = JSON.parse(prev); persist(); render(); toast('Undone.');
}

/* =====================================================================
   Drag & drop reordering (drag the ⠿ handle)
   ===================================================================== */
let dragId = null;
const listEl = $('#list');

function clearDropMarks() { $$('.drop-before, .drop-after', listEl).forEach(el => el.classList.remove('drop-before', 'drop-after')); }

listEl.addEventListener('mousedown', e => {
  const grip = e.target.closest('.grip');
  if (grip) grip.closest('.card').draggable = true;
});
document.addEventListener('mouseup', () => $$('.card[draggable="true"]', listEl).forEach(el => { if (dragId == null) el.draggable = false; }));

listEl.addEventListener('dragstart', e => {
  const cardEl = e.target.closest && e.target.closest('.card');
  if (!cardEl || !cardEl.draggable) return;
  dragId = +cardEl.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(dragId));
  setTimeout(() => cardEl.classList.add('dragging'), 0);
});
listEl.addEventListener('dragover', e => {
  if (dragId == null) return;
  const over = e.target.closest('.card');
  e.preventDefault();
  clearDropMarks();
  if (!over || +over.dataset.id === dragId) return;
  const r = over.getBoundingClientRect();
  over.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
});
listEl.addEventListener('drop', e => {
  if (dragId == null) return;
  e.preventDefault();
  const over = e.target.closest('.card');
  const movedId = dragId;
  if (over && +over.dataset.id !== movedId) {
    const r = over.getBoundingClientRect();
    moveCombatant(movedId, +over.dataset.id, e.clientY < r.top + r.height / 2);
  }
});
listEl.addEventListener('dragend', () => {
  dragId = null; clearDropMarks();
  $$('.card', listEl).forEach(el => { el.classList.remove('dragging'); el.draggable = false; });
});

/** Move one combatant before/after another, adjusting its initiative so the order stays consistent. */
function abilHtml(c) {
  const ab = c.abil || [];
  if (!ab.length) return '';
  return '<div class="res abil">' + ab.map((a, i) => {
    const at = `data-id="${c.id}" data-a="${i}"`;
    if (a.kind === 'recharge') {
      return `<div class="res-row"><span class="res-lbl">${esc(a.name)} <small>(recharge ${a.min}${a.min < 6 ? '–6' : ''})</small></span>
        <button class="rchg ${a.ready ? 'ready' : 'spent'}" data-action="abilToggle" ${at} title="${a.ready ? 'Click when used' : 'Click to mark ready again'}">${a.ready ? 'Ready' : 'Spent'}</button>
        ${a.ready ? '' : `<button class="btn sm" data-action="abilRoll" ${at}>${ic('dice')}Roll d6</button>`}</div>`;
    }
    const pips = a.max <= 12
      ? `<span class="rpips">${Array.from({ length: a.max }, (_, k) => `<button class="rpip ${k < a.cur ? 'on' : ''}" data-action="abilPip" ${at} data-i="${k}" title="${esc(a.name)}: ${a.cur}/${a.max} — click to ${k < a.cur ? 'spend one' : 'restore one'}"></button>`).join('')}</span>`
      : `<span class="rcount"><button class="rstep" data-action="abilStep" ${at} data-d="-1">−</button><b>${a.cur}<small>/${a.max}</small></b><button class="rstep" data-action="abilStep" ${at} data-d="1">+</button></span>`;
    const note = a.kind === 'la' ? ' <small>(refresh each turn)</small>' : '';
    return `<div class="res-row"><span class="res-lbl">${esc(a.name)}${note}</span>${pips}</div>`;
  }).join('') + '</div>';
}
function abilSet(c, a, to) {
  to = Math.max(0, Math.min(a.max, to));
  if (to === a.cur) return;
  const spend = to < a.cur;
  const text = a.kind === 'lr' ? (spend ? `${c.name} uses a Legendary Resistance (${to}/${a.max} left).` : `${c.name} regains a Legendary Resistance (${to}/${a.max}).`)
    : a.kind === 'la' ? (spend ? `${c.name} takes a legendary action (${to}/${a.max} left).` : `${c.name} regains a legendary action (${to}/${a.max}).`)
    : (spend ? `${c.name} uses ${a.name} (${to}/${a.max} left).` : `${c.name} regains ${a.name} (${to}/${a.max}).`);
  mutate(() => { a.cur = to; log(text, 'effect'); });
}
let abilFor = null;
const ABIL_FORM = {
  lr:       { label: 'Uses per day', def: 3, name: 'Legendary Resistance' },
  la:       { label: 'Per round', def: 3, name: 'Legendary Actions' },
  recharge: { label: 'Recharges on d6 ≥', def: 5, name: '' },
  uses:     { label: 'Uses', def: 3, name: '' },
};
function openAbil(id) {
  abilFor = id; $('#abilKind').value = 'lr'; syncAbilForm();
  renderAbilList();
  $('#abilModal').hidden = false;
}
function syncAbilForm() {
  const f = ABIL_FORM[$('#abilKind').value];
  $('#abilNumLabel').firstChild.textContent = f.label;
  $('#abilNum').value = f.def;
  $('#abilName').value = f.name;
  $('#abilName').disabled = !!f.name;
  $('#abilName').placeholder = f.name ? '' : ($('#abilKind').value === 'recharge' ? 'Fire Breath' : 'Spellcasting (3/day)');
  $('#abilNum').min = $('#abilKind').value === 'recharge' ? 2 : 1;
  $('#abilNum').max = $('#abilKind').value === 'recharge' ? 6 : 99;
}
function renderAbilList() {
  const c = byId(abilFor);
  const ab = (c && c.abil) || [];
  $('#abilTitle').textContent = c ? `${c.name} — abilities` : 'Abilities';
  $('#abilList').innerHTML = ab.length ? ab.map((a, i) => `
    <div class="abil-item"><span><b>${esc(a.name)}</b> <small>${a.kind === 'recharge' ? `recharge ${a.min}${a.min < 6 ? '–6' : ''}` : a.kind === 'la' ? `${a.max} per round` : `${a.max} uses`}</small></span>
    <button type="button" class="ibtn del" data-action="rmAbil" data-a="${i}" title="Remove">${ic('x')}</button></div>`).join('')
    : '<p class="res-none">No abilities yet.</p>';
}
$('#abilKind').addEventListener('change', syncAbilForm);
$('#abilForm').addEventListener('submit', e => {
  e.preventDefault();
  const c = byId(abilFor); if (!c) return;
  const kind = $('#abilKind').value, f = ABIL_FORM[kind];
  const name = (f.name || $('#abilName').value).trim().slice(0, 40);
  if (!name) { $('#abilName').focus(); return; }
  const n = Math.max(1, num($('#abilNum').value, f.def));
  const spec = kind === 'recharge' ? ['recharge', name, Math.min(6, Math.max(2, n))] : kind === 'uses' ? ['uses', name, n] : [kind, n];
  mutate(() => { c.abil = c.abil || []; c.abil.push(mkAbil(spec)); log(`${c.name} gains ${name}.`, 'effect'); });
  renderAbilList(); syncAbilForm();
});

/* =====================================================================
   Surprise round, area effects, encounter import
   ===================================================================== */
function applySurprise(v) {
  const hit = c => !isDead(c) && (v === 'monsters' ? c.type === 'monster' : c.type !== 'monster');
  mutate(() => {
    if (v === 'clear') {
      state.combatants.forEach(c => setCond(c, 'surprised', null, false));
      log('Surprise cleared.', 'effect');
    } else {
      const who = state.combatants.filter(hit);
      who.forEach(c => setCond(c, 'surprised', 1, true));
      log(`${v === 'monsters' ? 'The monsters are' : 'The party is'} surprised (${who.length}). They lose their first turn.`, 'effect');
    }
  });
}
const closeSurprise = () => { $('#surpriseMenu').hidden = true; $('#surpriseBtn').setAttribute('aria-expanded', 'false'); };
const closeTie = () => { $('#tieMenu').hidden = true; $('#tieBtn').setAttribute('aria-expanded', 'false'); };
document.addEventListener('click', e => { if (!e.target.closest('.surprise-wrap')) closeSurprise(); if (!e.target.closest('.tie-wrap')) closeTie(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSurprise(); closeTie(); } });

const parseDmg = txt => {
  const t = String(txt).trim();
  const m = t.match(/^(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
  if (m) {
    const n = Math.min(100, +m[1]), sides = Math.max(1, +m[2]), bonus = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
    let total = bonus; for (let i = 0; i < n; i++) total += Math.floor(Math.random() * sides) + 1;
    return { total: Math.max(0, total), label: `${t.replace(/\s/g, '')} = ${Math.max(0, total)}` };
  }
  const v = parseInt(t, 10);
  return Number.isFinite(v) && v > 0 ? { total: v, label: String(v) } : null;
};
function openAoe() {
  const list = state.combatants.filter(c => !isDead(c));
  if (!list.length) return toast('Nobody in the fight.');
  $('#aoeRows').innerHTML = list.map(c => `
    <label class="aoe-row ${c.type}">
      <input type="checkbox" data-aoe="${c.id}">
      <span class="aoe-name">${esc(c.name)}</span><small>${c.hp}/${c.maxHp}${c.temp ? ' +' + c.temp : ''}</small>
      <select data-aoesave="${c.id}" aria-label="Saving throw result for ${esc(c.name)}"><option value="fail">Failed save</option><option value="save">Saved</option></select>
    </label>`).join('');
  $('#aoeAmt').value = '';
  document.querySelector('input[name=aoeMode][value=damage]').checked = true; aoeMode();
  if (!$('#aoeType').options.length) $('#aoeType').innerHTML = dtOptions('').replace('Type…', 'Untyped');
  $('#aoeModal').hidden = false; $('#aoeAmt').focus();
}
const aoeModeVal = () => (document.querySelector('input[name=aoeMode]:checked') || {}).value || 'damage';
function aoeMode() {
  const m = aoeModeVal(), dmg = m === 'damage';
  $$('#aoeModal [data-aoefor="damage"]').forEach(el => el.hidden = !dmg);
  $$('#aoeRows [data-aoesave]').forEach(el => el.hidden = !dmg);
  $('#aoeAmtLbl').textContent = { damage: 'Damage', heal: 'Healing', temp: 'Temp HP' }[m];
  $('#aoeAmt').placeholder = m === 'damage' ? '28 or 8d6' : m === 'heal' ? '10 or 2d4+2' : '8 or 1d8+4';
  $('#aoeGo').textContent = { damage: 'Apply damage', heal: 'Apply healing', temp: 'Give temp HP' }[m];
  $('#aoeGo').className = 'btn ' + (dmg ? 'btn-danger' : 'btn-primary');
}
$('#aoeModal').addEventListener('change', e => { if (e.target.name === 'aoeMode') aoeMode(); });
function aoePick(kind) {
  const types = { monster: c => c.type === 'monster', party: c => c.type !== 'monster', all: () => true, none: () => false };
  $$('#aoeRows [data-aoe]').forEach(cb => { const c = byId(+cb.dataset.aoe); cb.checked = !!(c && types[kind](c)); });
}
$('#aoeForm').addEventListener('submit', e => {
  e.preventDefault();
  const mode = aoeModeVal(), dmg = parseDmg($('#aoeAmt').value);
  if (!dmg) { toast(mode === 'damage' ? 'Enter damage: a number or dice like 8d6.' : 'Enter an amount: a number or dice like 2d4+2.'); $('#aoeAmt').focus(); return; }
  const half = $('#aoeSaved').value === 'half', [aoeT, aoeM] = parseDt($('#aoeType').value);
  const hits = $$('#aoeRows [data-aoe]:checked').map(cb => {
    const c = byId(+cb.dataset.aoe), saved = $(`[data-aoesave="${cb.dataset.aoe}"]`).value === 'save';
    return c && { c, saved, n: mode !== 'damage' ? dmg.total : saved ? (half ? Math.floor(dmg.total / 2) : 0) : dmg.total };
  }).filter(Boolean);
  if (!hits.length) { toast('Tick at least one target.'); return; }
  closeAllModals();
  const s = hits.length > 1 ? 's' : '';
  mutate(() => {
    if (mode === 'heal') {
      log(`Area healing ${dmg.label} on ${hits.length} target${s}.`, 'heal');
      hits.forEach(h => applyHeal(h.c, h.n));
    } else if (mode === 'temp') {
      log(`Area temp HP ${dmg.label} on ${hits.length} target${s}.`, 'heal');
      hits.forEach(h => { h.c.temp = h.n; log(`${h.c.name} gains ${h.n} temp HP.`, 'heal'); });
    } else {
      log(`Area damage ${dmg.label}${aoeT ? ' ' + aoeT : ''} on ${hits.length} target${s}.`, 'dmg');
      hits.forEach(h => {
        if (h.n > 0) applyDamage(h.c, h.n, aoeT, aoeM);
        else log(`${h.c.name} saves and takes no damage.`, 'effect');
      });
    }
  });
});

/* ----- encounter import: plain text, JSON or a file ----- */
function parseEncounter(text) {
  const out = { title: '', creatures: [], errors: [] };
  const t = String(text || '').trim();
  const add = (c, where) => {
    if (!c.name) return out.errors.push(`${where}: missing name`);
    if (!(c.hp > 0)) return out.errors.push(`${where}: “${c.name}” needs hp`);
    out.creatures.push(c);
  };
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const j = JSON.parse(t), arr = Array.isArray(j) ? j : (j.creatures || j.monsters || []);
      out.title = Array.isArray(j) ? '' : (j.name || j.title || '');
      arr.forEach((o, i) => {
        const abil = [];
        if (o.lr) abil.push(['lr', +o.lr]); if (o.la) abil.push(['la', +o.la]);
        (o.recharge || []).forEach(r => abil.push(['recharge', r[0] || r.name, +(r[1] || r.min || 5)]));
        (o.uses || []).forEach(r => abil.push(['uses', r[0] || r.name, +(r[1] || r.max || 1)]));
        const def = defFromText([].concat(o.resist || o.resistances || []).join(';'), [].concat(o.immune || o.immunities || []).join(';'), [].concat(o.vuln || o.vulnerable || o.vulnerabilities || []).join(';'));
        add({ def, name: String(o.name || '').trim(), count: Math.max(1, Math.min(30, +o.count || 1)), type: ['pc', 'npc', 'monster'].includes(o.type) ? o.type : 'monster',
          hp: +o.hp, ac: +o.ac || 10, mod: +(o.init ?? o.mod) || 0, roll: o.roll != null && o.roll !== '' ? +o.roll : null, temp: +o.temp || 0, abil, note: o.note ? String(o.note) : '' }, `#${i + 1}`);
      });
    } catch (e) { out.errors.push('That is not valid JSON.'); }
    return out;
  }
  t.split(/\r?\n/).forEach((raw, ln) => {
    const line = raw.trim(); if (!line) return;
    if (line.startsWith('#')) { if (!out.title) out.title = line.replace(/^#+\s*/, ''); return; }
    const where = `Line ${ln + 1}`, parts = line.split('|').map(p => p.trim()).filter(Boolean);
    const head = parts.shift().match(/^(?:(\d+)\s*[x×]\s*)?(.+)$/i);
    const c = { def: blankDef(), roll: null, name: head[2].trim(), count: head[1] ? Math.max(1, Math.min(30, +head[1])) : 1, type: 'monster', hp: 0, ac: 10, mod: 0, temp: 0, abil: [], note: '' };
    let bad = false;
    parts.forEach(p => {
      let m;
      if ((m = p.match(/^hp\s*:?\s*(\d+)$/i))) c.hp = +m[1];
      else if ((m = p.match(/^ac\s*:?\s*(\d+)$/i))) c.ac = +m[1];
      else if ((m = p.match(/^(?:init|mod)\s*:?\s*([+-]?\d+)$/i))) c.mod = +m[1];
      else if ((m = p.match(/^temp\s*:?\s*(\d+)$/i))) c.temp = +m[1];
      else if ((m = p.match(/^(?:roll|initiative|total)\s*:?\s*(-?\d+)$/i))) c.roll = +m[1];
      else if ((m = p.match(/^type\s*:?\s*(pc|monster|npc)$/i))) c.type = m[1].toLowerCase();
      else if ((m = p.match(/^(?:lr|legendary resistances?)\s*:?\s*(\d+)$/i))) c.abil.push(['lr', +m[1]]);
      else if ((m = p.match(/^(?:la|legendary actions?)\s*:?\s*(\d+)$/i))) c.abil.push(['la', +m[1]]);
      else if ((m = p.match(/^recharge\s+(.+?)\s+([2-6])(?:\s*[-–]\s*6)?$/i))) c.abil.push(['recharge', m[1].trim(), +m[2]]);
      else if ((m = p.match(/^uses?\s+(.+?)\s+(\d+)(?:\s*\/\s*day)?$/i))) c.abil.push(['uses', m[1].trim(), +m[2]]);
      else if ((m = p.match(/^(resist\w*|res|immun\w*|imm|vuln\w*|vul)\s*:?\s*(.+)$/i))) {
        const k = /^res/i.test(m[1]) ? 'res' : /^imm/i.test(m[1]) ? 'imm' : 'vul';
        const d = defFromText(k === 'res' ? m[2] : '', k === 'imm' ? m[2] : '', k === 'vul' ? m[2] : '');
        if (!hasDef(d)) { out.errors.push(`${where}: no damage type found in “${p}”`); bad = true; } else c.def = mergeDef(c.def, d);
      }
      else if ((m = p.match(/^note\s*:?\s*(.+)$/i))) c.note = m[1];
      else { out.errors.push(`${where}: don't understand “${p}”`); bad = true; }
    });
    if (!bad) add(c, where);
  });
  return out;
}
const mergeDef = (a, b) => { const d = cloneDef(a); ['res', 'imm', 'vul', 'nm'].forEach(k => b[k].forEach(t => { if (!d[k].includes(t)) d[k].push(t); })); return d; };
const defSummary = d => hasDef(d) ? [['immune', d.imm], ['resist', d.res], ['vuln', d.vul]].filter(x => x[1].length).map(x => x[0] + ' ' + x[1].join('/')).join('; ') : '';
let impParsed = null;
function renderImportPreview() {
  impParsed = parseEncounter($('#impText').value);
  const p = impParsed, total = p.creatures.reduce((a, c) => a + c.count, 0);
  $('#impPreview').innerHTML = (p.creatures.length
    ? `<div class="imp-title">${esc(p.title || 'Encounter')} <small>${total} creature${total === 1 ? '' : 's'}</small></div>` + p.creatures.map(c =>
        `<div class="imp-row"><b>${c.count > 1 ? c.count + '× ' : ''}${esc(c.name)}</b><span>HP ${c.hp} · AC ${c.ac} · init ${c.roll != null ? 'rolled ' + c.roll : (c.mod >= 0 ? '+' : '') + c.mod}${c.abil.length ? ' · ' + c.abil.map(a => a[0] === 'lr' ? 'Leg. Res. ' + a[1] : a[0] === 'la' ? 'Leg. Actions ' + a[1] : a[1]).join(', ') : ''}${defSummary(c.def) ? ' · ' + esc(defSummary(c.def)) : ''}</span></div>`).join('')
    : '<div class="imp-empty">Nothing to import yet. Paste an encounter or load a file.</div>')
    + p.errors.map(e => `<div class="imp-err">${esc(e)}</div>`).join('');
  $('#impGo').disabled = !p.creatures.length;
}
function openImport() {
  $('#impText').value = ''; $('#impClear').checked = false; $('#impFile').value = '';
  renderImportPreview();
  $('#importModal').hidden = false; $('#impText').focus();
}
$('#impText').addEventListener('input', renderImportPreview);
$('#impFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 500000) return toast('That file is too big.');
  f.text().then(t => { $('#impText').value = t; renderImportPreview(); });
});
$('#impForm').addEventListener('submit', e => {
  e.preventDefault();
  const p = impParsed; if (!p || !p.creatures.length) return;
  const group = $('#impGroup').checked, fresh = $('#impClear').checked;
  closeAllModals();
  mutate(() => {
    if (fresh) state = Object.assign(blank(), { nextId: state.nextId, tie: state.tie });
    p.creatures.forEach(f => {
      const groupRoll = d20() + f.mod;
      for (let i = 1; i <= f.count; i++) {
        const init = f.roll != null ? f.roll : (group && f.count > 1) ? groupRoll : d20() + f.mod;
        const c = makeCombatant({ name: f.count > 1 ? `${f.name} ${i}` : f.name, type: f.type, init, mod: f.mod, hp: f.hp, ac: f.ac, temp: f.temp, abil: f.abil, def: f.def });
        if (f.note) c.notes = f.note;
        state.combatants.push(c);
      }
    });
    sortInit();
    log(`Imported “${p.title || 'encounter'}” (${p.creatures.reduce((a, c) => a + c.count, 0)} creatures).`);
  });
  toast('Encounter added to combat.');
});

/* =====================================================================
   Attack numbers for favourites, and the Encounter lab dialog
   (the lab's engine and trained model are bundled in encounter/ next to this page, so Dragonwatch works on its own)
   ===================================================================== */
const CR_XP_TABLE = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000,
  '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000 };
const crNum = s => { const t = String(s || '').trim(); if (t.includes('/')) { const [x, y] = t.split('/').map(Number); return x / y; } return Number(t); };
let atkTarget = null;
function openAtk(id) {
  const f = favs.find(x => x.id === id); if (!f) return;
  atkTarget = f.id;
  $('#atkTitle').textContent = `Attack numbers: ${f.name}`;
  const a = f.atk || { n: 1, hit: 4, dmg: 7 };
  $('#atkN').value = a.n; $('#atkHit').value = a.hit; $('#atkDmg').value = a.dmg; $('#atkCr').value = f.cr || '';
  atkFromLab = !$('#labModal').hidden; $('#labModal').hidden = true;      // the attack dialog sits on top of the lab dialog
  $('#atkErr').hidden = true; $('#atkModal').hidden = false; $('#atkN').focus();
}
$('#atkForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = favs.find(x => x.id === atkTarget); if (!f) return closeAllModals();
  const cr = $('#atkCr').value.trim(), n = parseInt($('#atkN').value, 10), hit = parseInt($('#atkHit').value, 10), dmg = parseFloat($('#atkDmg').value);
  const err = msg => { const b = $('#atkErr'); b.textContent = msg; b.hidden = false; };
  if (!(cr in CR_XP_TABLE)) return err('Enter a challenge rating such as 1/4, 1/2, 3 or 10.');
  if (!(n >= 1 && n <= 10)) return err('Attacks per round must be between 1 and 10.');
  if (!(hit >= -5 && hit <= 30)) return err('To-hit bonus must be between -5 and 30.');
  if (!(dmg > 0 && dmg <= 500)) return err('Damage per hit must be more than 0.');
  const { id, ...rest } = f;
  closeAllModals();
  await saveFav({ ...rest, cr, atk: { n, hit, dmg } });
  if (atkFromLab) openLab();      // back to the lab dialog, now with this monster ready
});
let atkFromLab = false;

const LAB = { E: null, model: null, mons: [], by: {}, envs: [], env: {}, ready: false };
const LAB_KEY = 'dragonwatch.lab', LAB_ROLE_KEY = 'dragonwatch.labRoles';
let labPicked = new Set(), labBuilt = false, labSeq = 0, labRoles = {}, labTarget = 70;
async function ensureLab() {
  if (LAB.ready) return LAB;
  if (!window.Engine) await new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = U('encounter/engine.js'); s.onload = res; s.onerror = () => rej(new Error('engine.js')); document.head.appendChild(s);
  });
  const get = f => fetch(U('encounter/' + f), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
  const [model, mons] = await Promise.all([get('model.json'), get('lab-monsters.json')]);
  try { const e = await api('GET', '/api/encounter/envs'); LAB.envs = e.environments; LAB.env = e.monsters; } catch (x) { LAB.envs = []; LAB.env = {}; }
  try { labRoles = JSON.parse(lsGet(LAB_ROLE_KEY) || '{}') || {}; } catch (x) { labRoles = {}; }
  LAB.E = window.Engine; LAB.model = model; LAB.mons = mons.sort((x, y) => x.cr - y.cr || x.name.localeCompare(y.name));
  LAB.by = Object.fromEntries(LAB.mons.map(m => [m.name, m])); LAB.ready = true; return LAB;
}
const labFavsReady = () => favs.filter(f => f.atk && f.cr && CR_XP_TABLE[f.cr] != null);
const labFavToMon = f => ({ name: f.name, cr: crNum(f.cr), xp: CR_XP_TABLE[f.cr], hp: f.hp, ac: f.ac, n_atk: f.atk.n, to_hit: f.atk.hit, dmg: f.atk.dmg, kind: String(f.kind || '').toLowerCase(), fav: f });
/** The simulator's version of a campaign character: class, level, real HP / AC / initiative, the spell slots and class features still unspent,
    and the attack numbers typed on the character (when there are any). `own` swaps in a different class, which the lab dialog allows. */
function labClassOf(c) { const o = labRoles[c.id]; return o && LAB.E.CLASS_NAMES.includes(o) ? o : null; }
function labHeroFor(c, over) {
  const o = over === undefined ? labClassOf(c) : over, level = Math.max(1, Math.min(20, Math.round(+c.level || 1)));
  return LAB.E.fromCharacter(Object.assign({}, c, o ? { classes: [{ name: o, level }] } : {}));
}
function labHeroes() {
  if (party.length) return party.map(c => labHeroFor(c));
  const n = Math.max(1, Math.min(10, parseInt($('#labSize').value, 10) || 4)), lv = Math.max(1, Math.min(20, parseInt($('#labLevel').value, 10) || 3));
  return Array.from({ length: n }, (_, i) => LAB.E.pcStats(lv, ['Fighter', 'Cleric', 'Rogue', 'Wizard'][i % 4]));
}
function labLevel() {
  if (party.length) return Math.max(1, Math.min(20, Math.round(party.reduce((s, c) => s + (+c.level || 1), 0) / party.length)));
  return Math.max(1, Math.min(20, parseInt($('#labLevel').value, 10) || 3));
}
const labEnvOk = m => { const env = $('#labEnv').value; if (!env) return true; const i = LAB.env[m.name.toLowerCase()]; return !!i && (i.any || i.keys.includes(env)); };
function labPool() {
  const level = labLevel(), type = $('#labType').value;
  const favMons = $('#labFavs').checked ? labFavsReady().map(labFavToMon).filter(m => !type || m.kind === type) : [];
  let srd = [];
  if ($('#labSrd').checked) {
    srd = labPicked.size ? LAB.mons.filter(m => labPicked.has(m.name))
      : LAB.mons.filter(m => (!$('#labCap').checked || m.cr <= level + 3) && (!type || m.type === type) && labEnvOk(m));
  }
  const mine = new Set(favMons.map(m => m.name.toLowerCase()));
  return [...favMons, ...srd.filter(m => !mine.has(m.name.toLowerCase()))];
}
function labSaveSettings() {
  lsSet(LAB_KEY, JSON.stringify({ target: labTarget, max: +$('#labMax').value, srd: $('#labSrd').checked, cap: $('#labCap').checked, favs: $('#labFavs').checked, type: $('#labType').value, env: $('#labEnv').value }));
}
function labSetTarget(v) {
  labTarget = v; $('#labTarget').value = v; $('#labTargetOut').textContent = v + '%';
  $$('#labChips .btn').forEach(b => b.classList.toggle('on', +b.dataset.v === v));
}
function labBuild() {
  labBuilt = true;
  $('#labChips').innerHTML = [['Easy', 90], ['Medium', 75], ['Hard', 55], ['Deadly', 30]].map(([n, v]) => `<button type="button" class="btn sm" data-v="${v}">${n} · ${v}%</button>`).join('');
  $('#labType').innerHTML = '<option value="">Any</option>' + [...new Set(LAB.mons.map(m => m.type).filter(Boolean))].sort().map(t => `<option value="${esc(t)}">${esc(t[0].toUpperCase() + t.slice(1))}</option>`).join('');
  $('#labEnv').innerHTML = '<option value="">Any</option>' + LAB.envs.map(x => `<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('');
  $('#labChips').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { labSetTarget(+b.dataset.v); labSaveSettings(); } });
  $('#labTarget').addEventListener('input', e => { labSetTarget(+e.target.value); labSaveSettings(); });
  for (const id of ['#labSrd', '#labCap', '#labFavs', '#labType', '#labEnv', '#labMax']) $(id).addEventListener('change', () => { labSaveSettings(); labRenderPool(); });
  for (const id of ['#labSize', '#labLevel']) $(id).addEventListener('input', () => { labRenderPool(); labNote(); });
  $('#labQ').addEventListener('input', labRenderPool);
  $('#labAll').addEventListener('click', () => { labShown().forEach(m => labPicked.add(m.name)); labRenderPool(); });
  $('#labNone').addEventListener('click', () => { labPicked.clear(); labRenderPool(); });
  $('#labParty').addEventListener('change', e => {
    const s = e.target.closest('select[data-cid]'); if (!s) return;
    { const ch = party.find(p => String(p.id) === s.dataset.cid); if (ch && s.value === LAB.E.roleForClass(mainClass(ch))) delete labRoles[s.dataset.cid]; else labRoles[s.dataset.cid] = s.value; }
    try { lsSet(LAB_ROLE_KEY, JSON.stringify(labRoles)); } catch (x) { /* ignore */ }
    labNote();
  });
}
function labShown() {
  const q = $('#labQ').value.trim().toLowerCase(), level = labLevel(), type = $('#labType').value;
  return LAB.mons.filter(m => (!q || m.name.toLowerCase().includes(q)) && (!$('#labCap').checked || m.cr <= level + 3) && (!type || m.type === type) && labEnvOk(m));
}
function labRenderPool() {
  const ul = $('#labPool'), rows = labShown(); ul.textContent = '';
  for (const m of rows.slice(0, 120)) {
    const li = document.createElement('li'), id = 'lp-' + m.name.replace(/\W+/g, '_');
    li.innerHTML = `<input type="checkbox" id="${id}" ${labPicked.has(m.name) ? 'checked' : ''}><label for="${id}">${esc(m.name)}</label><span class="cr">CR ${esc(m.cr === .125 ? '1/8' : m.cr === .25 ? '1/4' : m.cr === .5 ? '1/2' : m.cr)}</span>`;
    li.querySelector('input').addEventListener('change', e => { if (e.target.checked) labPicked.add(m.name); else labPicked.delete(m.name); labRenderInfo(); });
    ul.appendChild(li);
  }
  if (rows.length > 120) { const li = document.createElement('li'); li.textContent = `${rows.length - 120} more. Filter to narrow the list.`; ul.appendChild(li); }
  if (!rows.length) { const li = document.createElement('li'); li.textContent = 'No SRD monsters match.'; ul.appendChild(li); }
  labRenderInfo(); labRenderNeed();
}
function labRenderInfo() {
  const n = labPool().length;
  $('#labPoolInfo').textContent = `${labPicked.size ? labPicked.size + ' picked · ' : ''}${n} monster${n === 1 ? '' : 's'} in the pool`;
}
function labRenderNeed() {
  const ready = labFavsReady().length, need = favs.filter(f => !(f.atk && f.cr && CR_XP_TABLE[f.cr] != null));
  $('#labFavCount').textContent = `(${ready} of ${favs.length} ready)`;
  const box = $('#labNeed'); box.hidden = !need.length;
  box.innerHTML = need.length ? 'Needs attack numbers: ' + need.slice(0, 6).map(f => `${esc(f.name)}<button type="button" class="btn sm" data-action="atkFav" data-id="${f.id}">Set</button>`).join(' ') + (need.length > 6 ? ` and ${need.length - 6} more (open Favorited and press the swords).` : '') : '';
}
function labNote() {
  const hs = labHeroes(), level = labLevel(), warn = LAB.E.outOfRange(LAB.model, level, hs.length, []);
  $('#labPartyNote').textContent = (party.length ? `From your campaign: ${party.length} character${party.length === 1 ? '' : 's'}. Their real HP, AC, initiative, spell slots and class features are used, and attacks and damage come from the class table unless you typed your own numbers on the character. Change a class here to try a different build.` : 'No characters in this campaign, so a standard party of this size and level is used.')
    + (warn.length ? ' Careful: ' + warn.join('; ') + '. The model is unreliable there.' : '');
}
async function openLab() {
  $('#labModal').hidden = false; $('#labMain').hidden = true; $('#labGo').disabled = true; $('#labErr').hidden = true; $('#labOut').textContent = '';
  const st = $('#labStatus'); st.hidden = false; st.textContent = 'Loading the Encounter lab…';
  try { await ensureLab(); }
  catch (err) { st.textContent = `The Encounter lab could not be loaded (${err.message}). The files in the encounter folder next to this page may be missing.`; return; }
  st.hidden = true;
  if (!labBuilt) labBuild();
  let saved = {}; try { saved = JSON.parse(lsGet(LAB_KEY) || '{}') || {}; } catch (e) { saved = {}; }
  try { labRoles = JSON.parse(lsGet(LAB_ROLE_KEY) || '{}') || {}; } catch (e) { labRoles = {}; }
  labSetTarget(saved.target >= 5 && saved.target <= 99 ? saved.target : 70);
  $('#labMax').value = saved.max >= 1 && saved.max <= 20 ? saved.max : 8;
  $('#labSrd').checked = saved.srd !== false; $('#labCap').checked = saved.cap !== false; $('#labFavs').checked = saved.favs !== false;
  $('#labType').value = saved.type || ''; if ($('#labType').value !== (saved.type || '')) $('#labType').value = '';
  $('#labEnv').value = saved.env || ''; if ($('#labEnv').value !== (saved.env || '')) $('#labEnv').value = '';
  const box = $('#labParty'); $('#labManual').hidden = party.length > 0;
  box.innerHTML = party.map(c => {
    const role = labClassOf(c) || LAB.E.roleForClass(mainClass(c));
    return `<div class="lab-hero"><div><b>${esc(c.name)}</b><span>${esc(classShort(c))} · level ${c.level} · ${c.max_hp} HP · AC ${c.ac}</span></div>
      <select data-cid="${c.id}" aria-label="Class of ${esc(c.name)}">${LAB.E.CLASS_NAMES.map(k => `<option value="${esc(k)}" ${k === role ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>`;
  }).join('');
  labNote(); labRenderPool(); $('#labMain').hidden = false; $('#labGo').disabled = false; $('#labGo').focus();
}
const labNames = c => Object.entries(c).map(([n, k]) => (k > 1 ? k + ' × ' : '') + n).join(' + ');
$('#labForm').addEventListener('submit', async e => {
  e.preventDefault();
  const go = $('#labGo'), out = $('#labOut'), err = $('#labErr'); err.hidden = true; out.textContent = '';
  const heroes = labHeroes(), level = labLevel(), pool = labPool(), maxMon = Math.max(1, Math.min(20, parseInt($('#labMax').value, 10) || 8)), target = labTarget / 100;
  if (!pool.length) { err.textContent = 'The pool is empty. Turn on SRD monsters or favourites with attack numbers, or loosen the filters.'; err.hidden = false; return; }
  const seq = ++labSeq; go.disabled = true; go.textContent = 'Searching…';
  try {
    const r = await LAB.E.generate(LAB.model, level, heroes, pool, { target, maxMon, want: 6, onProgress: f => { if (seq === labSeq) go.textContent = `Searching… ${Math.round(f * 100)}%`; } });
    if (seq !== labSeq) return;
    if (!r.results.length) {
      const t = Math.round(target * 100), c = r.closest == null ? null : Math.round(r.closest * 100);
      out.appendChild(Object.assign(document.createElement('div'), { className: 'lab-msg', textContent: r.reason === 'too_easy' ? `This pool is too weak for a ${t}% fight: even ${maxMon} of its monsters leave the party at about ${c}%. Add stronger monsters or allow more creatures.`
        : r.reason === 'too_hard' ? `This pool is too strong for a ${t}% fight: even one of its monsters is a ${c}% win for the party. Add weaker monsters.` : `No combination from this pool lands near ${t}%. Try a wider pool or a different target.` }));
      return;
    }
    for (const x of r.results) {
      const row = document.createElement('div'), pc = v => Math.round(v * 100) + '%'; row.className = 'lab-res';
      row.innerHTML = `<div><b>${esc(labNames(x.counts))}</b><span>Model ${pc(x.model.p_win)} · simulation ${pc(x.sim.p_win)} · party HP lost ${pc(x.sim.hp_lost)} · heroes down ${x.sim.deaths.toFixed(1)}</span></div><button type="button" class="btn sm btn-primary">Add to combat</button>${x.gap > .1 ? '<div class="warnline">The model and the simulation disagree by more than 10 points here, so treat this one as a rough fit.</div>' : ''}`;
      row.querySelector('button').addEventListener('click', () => addLab(x, pool, heroes.length, target));
      out.appendChild(row);
    }
  } catch (ex) { err.textContent = 'Something went wrong: ' + ex.message; err.hidden = false; }
  finally { go.disabled = false; go.textContent = 'Generate'; }
});
async function addLab(x, pool, heroCount, target) {
  const favBy = new Map(pool.filter(m => m.fav).map(m => [m.name.toLowerCase(), m.fav]));
  const srdNames = Object.keys(x.counts).filter(n => !favBy.has(n.toLowerCase()));
  let recs = []; if (srdNames.length) { try { recs = await api('POST', '/api/encounter/lookup', { names: srdNames }); } catch (e) { recs = []; } }
  const rec = new Map(recs.map(r => [r.name.toLowerCase(), r]));
  const items = Object.entries(x.counts).map(([name, count]) => {
    const fav = favBy.get(name.toLowerCase()); let form;
    if (fav) form = { name: fav.name, type: fav.type || 'monster', hp: fav.hp, ac: fav.ac, mod: fav.mod || 0, abil: fav.abil && fav.abil.length ? fav.abil : null, def: fav.def, notes: fav.notes };
    else if (rec.has(name.toLowerCase())) form = monsterToForm(rec.get(name.toLowerCase()));
    else { const m = LAB.by[name]; form = { name, type: 'monster', hp: m.hp, ac: m.ac, mod: 0, abil: null, def: blankDef() }; }
    return { form, count };
  });
  const clear = $('#labClear').checked; let total = 0;
  mutate(() => {
    if (clear) { state.combatants = state.combatants.filter(c => c.type === 'pc'); if (state.turn >= state.combatants.length) state.turn = 0; }
    items.forEach(it => {
      const f = it.form, base = f.name, same = state.combatants.filter(c => baseName(c.name).toLowerCase() === base.toLowerCase()).length, numbered = it.count > 1 || same > 0;
      for (let i = 1; i <= it.count; i++) { state.combatants.push(makeCombatant({ ...f, name: numbered ? `${base} ${same + i}` : base, init: d20() + f.mod })); total++; }
      if (same === 1) { const first = state.combatants.find(c => c.name === base); if (first) first.name = `${base} 1`; }
    });
    sortInit();
    log(`Generated with the Encounter lab for ${heroCount} character${heroCount === 1 ? '' : 's'}, aiming for a ${Math.round(target * 100)}% win chance (model ${Math.round(x.model.p_win * 100)}%, simulation ${Math.round(x.sim.p_win * 100)}%): ${labNames(x.counts)}.`);
  });
  closeAllModals();
  toast(`${total} creature${total === 1 ? '' : 's'} added: ${labNames(x.counts)}.`);
}

const TIE_TEXT = { mod: 'higher initiative modifier first, then players', pc: 'players first, then higher modifier', manual: 'the order you set by dragging' };
function setTie(v) {
  mutate(() => {
    state.tie = v;
    if (v !== 'manual') state.combatants.forEach(c => { delete c.ord; });   // let the rule decide again
    sortInit();
    log(`Initiative ties are now broken by: ${TIE_TEXT[v]}.`);
  });
}
/** Everyone tied on the same initiative rolls d20 + modifier; highest goes first (re-rolled while still tied). */
function rollOff() {
  const groups = {};
  state.combatants.forEach(c => { (groups[c.init] = groups[c.init] || []).push(c); });
  const tied = Object.entries(groups).filter(([, g]) => g.length > 1);
  if (!tied.length) return toast('No tied initiatives.');
  mutate(() => {
    tied.forEach(([init, group]) => {
      let rolls, tries = 0;
      do { rolls = group.map(c => ({ c, r: d20() + c.mod })); tries++; }
      while (tries < 10 && new Set(rolls.map(x => x.r)).size < rolls.length);
      rolls.sort((a, b) => b.r - a.r);
      rolls.forEach((x, i) => { x.c.ord = i; });
      log(`Roll-off for initiative ${init}: ${rolls.map(x => `${x.c.name} ${x.r}`).join(', ')}.`, 'turn');
    });
    sortInit();
  });
}

function moveCombatant(movedId, targetId, before) {
  mutate(() => {
    const arr = state.combatants;
    const activeId = arr[state.turn] && arr[state.turn].id;
    const moved = byId(movedId);
    arr.splice(arr.indexOf(moved), 1);
    let at = arr.findIndex(c => c.id === targetId);
    if (!before) at++;
    arr.splice(at, 0, moved);

    const above = arr[at - 1], below = arr[at + 1];
    if (above && moved.init > above.init) moved.init = above.init;
    if (below && moved.init < below.init) moved.init = below.init;

    arr.forEach((c, i) => { c.ord = i; });
    state.turn = state.started ? Math.max(0, arr.findIndex(c => c.id === activeId)) : 0;
    log(`${moved.name} moved in the initiative order (init ${moved.init}).`);
  });
}

/* =====================================================================
   Campaigns & party (stored in SQLite via the server API)
   ===================================================================== */
const CAMP_KEY = 'dragonwatch.campaign';
let campaigns = [], campId = null, party = [], partyReady = false, dbError = null;
let dragCharId = null, editingChar = null, nameMode = 'create';

const lsGet = k => { try { return localStorage.getItem(scoped(k)); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(scoped(k), v); } catch (e) { /* ignore */ } };

async function api(method, url, body) {
  const r = await fetch(U(url), {
    method,
    headers: Object.assign({ 'X-DW': '1' }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { location.replace(U('login.html')); throw new Error('Please sign in again.'); }
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).error || msg; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  return r.status === 204 ? null : r.json();
}

async function loadCampaigns(preferId) {
  try { campaigns = await api('GET', '/api/campaigns'); dbError = null; }
  catch (e) { campaigns = []; dbError = 'Cannot reach the database. Open the app through the server (e.g. http://localhost:8080), not as a plain file.'; }
  const saved = parseInt(lsGet(CAMP_KEY), 10);
  const pick = [preferId, saved].find(id => id != null && campaigns.some(c => c.id === id));
  campId = pick != null ? pick : (campaigns[0] ? campaigns[0].id : null);
  if (campId != null) lsSet(CAMP_KEY, campId);
  await loadParty();
}
async function loadParty() {
  party = [];
  if (campId != null) {
    try { party = await api('GET', `/api/campaigns/${campId}/characters`); }
    catch (e) { toast(e.message); }
  }
  party.forEach(p => { synced[p.id] = hpKey(p.current_hp, p.temp_hp); });
  partyReady = true;
  loadEncs();
  syncParty();
  render();            // redraws the roster and the combat cards (which show PC resources)
}

/* While a PC is in combat, the combat tracker is the source of truth for their HP:
   every change is saved to the database (debounced) so the party panel and the next
   session always show the real current HP. */
const synced = {};   // characterId -> 'hp:temp' the database is known to hold
const hpKey = (hp, temp) => `${hp}:${temp || 0}`;
const hpTimers = {};
function syncParty() {
  if (!partyReady) return;
  state.combatants.forEach(c => {
    if (c.pcId == null || synced[c.pcId] === hpKey(c.hp, c.temp)) return;
    const id = c.pcId, hp = c.hp, temp = c.temp || 0;
    synced[id] = hpKey(hp, temp);
    const p = party.find(x => x.id === id);
    if (p) { p.current_hp = hp; p.temp_hp = temp; }
    clearTimeout(hpTimers[id]);
    hpTimers[id] = setTimeout(() => { api('PATCH', `/api/characters/${id}`, { current_hp: hp, temp_hp: temp }).catch(() => {}); }, 300);
  });
}
const liveOf = p => state.combatants.find(c => c.pcId === p.id);

/* =====================================================================
   Class resources: spell slots, focus points, rage, ...
   Stored per character in the database: [{ name, cur, max, rest, slot? }]
   ===================================================================== */
const FULL_SLOTS = [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],
  [4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const HALF_SLOTS = [[],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
const pactFor = l => ({ n: l < 2 ? 1 : l < 11 ? 2 : l < 17 ? 3 : 4, lvl: l < 3 ? 1 : l < 5 ? 2 : l < 7 ? 3 : l < 9 ? 4 : 5 });
const RES_PRESETS = [
  // class features
  { g: 'Class features', name: 'Rage',               rest: 'long',  max: l => l < 3 ? 2 : l < 6 ? 3 : l < 12 ? 4 : l < 17 ? 5 : 6 },
  { g: 'Class features', name: 'Focus Points',       rest: 'short', max: l => Math.max(2, l) },
  { g: 'Class features', name: 'Uncanny Metabolism', rest: 'long',  max: () => 1 },
  { g: 'Class features', name: 'Sorcery Points',     rest: 'long',  max: l => Math.max(2, l) },
  { g: 'Class features', name: 'Innate Sorcery',     rest: 'long',  max: () => 2 },
  { g: 'Class features', name: 'Bardic Inspiration', rest: 'long',  max: () => 3 },
  { g: 'Class features', name: 'Superior Inspiration', rest: 'long', max: () => 1 },
  { g: 'Class features', name: 'Channel Divinity',   rest: 'short', max: l => l < 6 ? 1 : l < 18 ? 2 : 3 },
  { g: 'Class features', name: 'Divine Intervention', rest: 'long', max: () => 1 },
  { g: 'Class features', name: 'Divine Sense',       rest: 'long',  max: () => 3 },
  { g: 'Class features', name: 'Cleansing Touch',    rest: 'long',  max: () => 3 },
  { g: 'Class features', name: 'Lay on Hands',       rest: 'long',  max: l => l * 5 },
  { g: 'Class features', name: 'Wild Shape',         rest: 'short', max: () => 2 },
  { g: 'Class features', name: 'Favored Foe',        rest: 'long',  max: l => l < 5 ? 2 : l < 9 ? 3 : l < 13 ? 4 : l < 17 ? 5 : 6 },
  { g: 'Class features', name: 'Action Surge',       rest: 'short', max: l => l < 17 ? 1 : 2 },
  { g: 'Class features', name: 'Second Wind',        rest: 'short', max: () => 1 },
  { g: 'Class features', name: 'Indomitable',        rest: 'long',  max: l => l < 13 ? 1 : l < 17 ? 2 : 3 },
  { g: 'Class features', name: 'Superiority Dice',   rest: 'short', max: l => l < 7 ? 4 : l < 15 ? 5 : 6 },
  { g: 'Class features', name: 'Stroke of Luck',     rest: 'short', max: () => 1 },
  { g: 'Class features', name: 'Arcane Recovery',    rest: 'long',  max: () => 1 },
  { g: 'Class features', name: 'Flash of Genius',    rest: 'long',  max: () => 3 },
  // everyone
  { g: 'Hit dice, inspiration & more', name: 'Hit Dice',            rest: 'long', max: l => l },
  { g: 'Hit dice, inspiration & more', name: 'Heroic Inspiration',  rest: 'none', max: () => 1 },
  { g: 'Hit dice, inspiration & more', name: 'Lucky',               rest: 'long', max: () => 3 },
  { g: 'Hit dice, inspiration & more', name: 'Breath Weapon',       rest: 'long', max: () => 2 },
  { g: 'Hit dice, inspiration & more', name: 'Relentless Endurance',rest: 'long', max: () => 1 },
  { g: 'Hit dice, inspiration & more', name: 'Item charges',        rest: 'long', max: () => 3, custom: true },
  { g: 'Hit dice, inspiration & more', name: 'Custom resource',     rest: 'long', max: () => 1, custom: true },
];
const ord = n => n + (['th','st','nd','rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

/* ----- classes and multiclassing ----- */
const THIRD_SLOTS = [[],[],[2],[3],[3],[3],[4,2],[4,2],[4,2],[4,3],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1]];
const clsList = p => (Array.isArray(p.classes) && p.classes.length ? p.classes : [{ name: p.class || '', level: +p.level || 1 }]).map(c => ({ name: c.name || '', level: +c.level || 1 }));
const clsTotal = a => a.reduce((t, c) => t + c.level, 0);
const hasClassName = p => clsList(p).some(c => c.name);
/** "Fighter 3 / Wizard 2" for a multiclass character, the plain class name otherwise. */
const classShort = p => { const a = clsList(p).filter(c => c.name); return a.length > 1 ? a.map(c => `${c.name} ${c.level}`).join(' / ') : (a[0] ? a[0].name : 'No class set'); };
const classLine = p => { const a = clsList(p).filter(c => c.name); return !a.length ? `Level ${p.level}` : a.length > 1 ? `${classShort(p)} (level ${p.level})` : `${a[0].name} level ${p.level}`; };
/** The class with the most levels (the first one on a tie): it decides the role used by the Encounter lab. */
const mainClass = p => clsList(p).reduce((b, c) => (c.level > b.level ? c : b)).name;
const hitDieFor = cls => (classInfo(cls) || { die: 8 }).die;       // unknown (homebrew) classes: d8
const slotKind = name => (classInfo(name) || {}).cast || '';
/** Spell slots by the multiclass rules: one casting class uses its own table; several add up into one caster level. Pact Magic stays separate. */
function slotPlan(classes) {
  const cast = classes.map(c => ({ k: slotKind(c.name), l: Math.min(20, c.level) })).filter(c => c.k && c.k !== 'pact');
  const lock = Math.min(20, classes.filter(c => slotKind(c.name) === 'pact').reduce((t, c) => t + c.level, 0));
  let table = [];
  if (cast.length === 1) {
    const { k, l } = cast[0];
    table = k === 'full' ? FULL_SLOTS[l - 1] : k === 'third' ? THIRD_SLOTS[l - 1] : k === 'halfup' ? HALF_SLOTS[Math.min(19, l)] : HALF_SLOTS[l - 1];
  } else if (cast.length > 1) {
    const cl = cast.reduce((t, c) => t + (c.k === 'full' ? c.l : c.k === 'half' ? Math.floor(c.l / 2) : c.k === 'halfup' ? Math.ceil(c.l / 2) : Math.floor(c.l / 3)), 0);
    table = cl > 0 ? FULL_SLOTS[Math.min(20, cl) - 1] : [];
  }
  return { table: table || [], pact: lock ? pactFor(lock) : null, arcanum: [[11, 6], [13, 7], [15, 8], [17, 9]].filter(([from]) => lock >= from).map(x => x[1]) };
}
const planHasSlots = pl => pl.table.length > 0 || !!pl.pact;
/** Rebuild the spell-slot resources. With oldClasses (a level up) spent slots stay spent and new ones arrive full; without it, current slots are only capped. */
function rebuildSlots(res, classes, oldClasses) {
  const plan = slotPlan(classes), prev = n => (res || []).find(r => r.name === n);
  const out = (res || []).filter(r => !r.slot && !/^(Pact Slots|Mystic Arcanum)/.test(r.name));
  const put = (name, max, rest, slot) => {
    const o = prev(name), r = { name, max, rest, cur: !o ? max : Math.min(max, o.cur + (oldClasses ? Math.max(0, max - o.max) : 0)) };
    if (slot) r.slot = true; out.push(r);
  };
  plan.table.forEach((n, i) => put(`Level ${i + 1}`, n, 'long', true));
  if (plan.pact) put(`Pact Slots (level ${plan.pact.lvl})`, plan.pact.n, 'short');
  plan.arcanum.forEach(sp => put(`Mystic Arcanum (${ord(sp)})`, 1, 'long'));
  return out;
}
/** One Hit Dice pool per die size: a single "Hit Dice" for one die size, "Hit Dice (d10)" and "Hit Dice (d6)" for a mix. */
function rebuildHitDice(res, oldClasses, newClasses) {
  const isHD = r => /^Hit Dice/.test(r.name), olds = res.filter(isHD);
  if (!olds.length) return res;
  const dieOf = r => { const m = r.name.match(/d(\d+)/); return m ? +m[1] : hitDieFor(((oldClasses || [])[0] || {}).name); };
  const oldBy = {}; olds.forEach(r => { oldBy[dieOf(r)] = r; });
  const newBy = {}; newClasses.forEach(c => { const d = hitDieFor(c.name); newBy[d] = (newBy[d] || 0) + c.level; });
  const dies = Object.keys(newBy).map(Number).sort((a, b) => b - a), multi = dies.length > 1;
  const pools = dies.map(d => { const max = newBy[d], o = oldBy[d]; return { name: multi ? `Hit Dice (d${d})` : 'Hit Dice', max, rest: 'long', cur: o ? Math.min(max, o.cur + Math.max(0, max - o.max)) : max }; });
  const at = res.findIndex(isHD), rest = res.filter(r => !isHD(r));
  rest.splice(Math.min(at, rest.length), 0, ...pools);
  return rest;
}
/** Class features scale with the level in the class that grants them, not the total level. */
const presetLevel = (name, classes) => {
  const hit = classes.reduce((t, c) => { const i = classInfo(c.name); return t + (i && (i.res[name] != null || (i.scales || []).includes(name)) ? c.level : 0); }, 0);
  return hit > 0 ? hit : clsTotal(classes);
};
/** Class resources a class gets from the levels it has. With oldClasses, only the ones that unlocked in this level up. */
function grantResources(res, newClasses, oldClasses) {
  const out = (res || []).map(r => Object.assign({}, r)), added = [];
  newClasses.forEach(c => {
    const info = classInfo(c.name); if (!info) return;
    const before = oldClasses ? ((oldClasses.find(o => o.name.toLowerCase() === c.name.toLowerCase()) || {}).level || 0) : 0;
    Object.entries(info.res).forEach(([name, at]) => {
      if (c.level < at || before >= at || out.some(r => r.name.toLowerCase() === name.toLowerCase())) return;
      const pre = RES_PRESETS.find(x => x.name === name); if (!pre) return;
      const max = pre.max(presetLevel(name, newClasses));
      out.push({ name, cur: max, max, rest: pre.rest }); added.push(name);
    });
  });
  return { res: out, added };
}
const resTimers = {};
function saveRes(p) {
  clearTimeout(resTimers[p.id]);
  resTimers[p.id] = setTimeout(() => {
    api('PATCH', `/api/characters/${p.id}`, { resources: p.resources }).catch(e => toast(e.message));
  }, 300);
}

/** Clickable pips for one character's resources (used in the roster and on combat cards). */
function resHtml(p) {
  const rs = p.resources || [];
  if (!rs.length) return '';
  const act = (a, r, i, extra = '') => `data-action="${a}" data-char="${p.id}" data-r="${i}" ${extra}`;
  const pips = (r, i) => r.max <= 12
    ? `<span class="rpips">${Array.from({ length: r.max }, (_, k) =>
        `<button class="rpip ${k < r.cur ? 'on' : ''}" ${act('resPip', r, i, `data-i="${k}"`)} title="${esc(r.name)}: ${r.cur}/${r.max} — click to ${k < r.cur ? 'spend one' : 'restore one'}"></button>`).join('')}</span>`
    : `<span class="rcount"><button class="rstep" ${act('resAdj', r, i, 'data-d="-1"')} title="Spend one">−</button><b>${r.cur}<small>/${r.max}</small></b><button class="rstep" ${act('resAdj', r, i, 'data-d="1"')} title="Restore one">+</button></span>`;
  const idx = rs.map((r, i) => i);
  const slots = idx.filter(i => rs[i].slot), others = idx.filter(i => !rs[i].slot);
  const rest = r => r.rest === 'short' ? 'short rest' : r.rest === 'long' ? 'long rest' : 'manual';
  return `<div class="res">` +
    (slots.length ? `<div class="res-row slots"><span class="res-lbl">Spell slots</span>${slots.map(i => {
      const r = rs[i], lv = parseInt(r.name.replace(/\D/g, ''), 10);
      return `<span class="slot" title="${esc(r.name)} slots — ${r.cur}/${r.max}"><i>${lv ? ord(lv) : esc(r.name)}</i>${pips(r, i)}</span>`;
    }).join('')}</div>` : '') +
    others.map(i => { const r = rs[i];
      return `<div class="res-row"><span class="res-lbl" title="Recharges on ${rest(r)}">${esc(r.name)}</span>${pips(r, i)}</div>`; }).join('') +
    `</div>`;
}
/** Change a resource and write it to the Battle Chronicle. */
function setRes(p, r, to) {
  const from = r.cur; to = Math.max(0, Math.min(r.max, to));
  if (to === from) return;
  const n = Math.abs(to - from), lv = parseInt(r.name.replace(/\D/g, ''), 10);
  const what = r.slot && lv ? `${ord(lv)}-level spell slot${n > 1 ? 's' : ''}` : r.name;
  const text = to < from
    ? `${p.name} spends ${r.slot ? (n > 1 ? n + ' ' : 'a ') : (n > 1 ? n + '× ' : '')}${what} (${to}/${r.max} left).`
    : `${p.name} regains ${r.slot ? (n > 1 ? n + ' ' : 'a ') : (n > 1 ? n + '× ' : '')}${what} (${to}/${r.max}).`;
  r.cur = to;
  saveRes(p);
  mutate(() => log(text, 'effect'), { noUndo: true });
}
function resPip(charId, ri, i) {
  const p = party.find(x => x.id === charId), r = p && p.resources[ri];
  if (r) setRes(p, r, i < r.cur ? r.cur - 1 : r.cur + 1);   // one at a time: filled pip spends one, empty pip restores one
}
function resAdj(charId, ri, d) {
  const p = party.find(x => x.id === charId), r = p && p.resources[ri];
  if (r) setRes(p, r, r.cur + d);
}

/* ----- resource editor inside the character form ----- */
let editRes = [];
function renderResRows() {
  $('#resRows').innerHTML = editRes.length ? editRes.map((r, i) => `
    <div class="res-erow" data-ri="${i}">
      <input class="r-name" value="${esc(r.name)}" maxlength="40" aria-label="Resource name">
      <input class="r-cur" type="number" min="0" max="999" value="${r.cur}" aria-label="Current">
      <span>/</span>
      <input class="r-max" type="number" min="0" max="999" value="${r.max}" aria-label="Maximum">
      <select class="r-rest" aria-label="Recharges on">
        <option value="long" ${r.rest === 'long' ? 'selected' : ''}>Long rest</option>
        <option value="short" ${r.rest === 'short' ? 'selected' : ''}>Short rest</option>
        <option value="none" ${r.rest === 'none' ? 'selected' : ''}>Manual</option>
      </select>
      <button type="button" class="ibtn del" data-action="rmRes" data-r="${i}" title="Remove">${ic('x')}</button>
    </div>`).join('') : '<p class="res-none">No resources yet. Add one below or fill in spell slots.</p>';
}
$('#resRows').addEventListener('input', e => {
  const row = e.target.closest('.res-erow'); if (!row) return;
  const r = editRes[+row.dataset.ri]; if (!r) return;
  if (e.target.classList.contains('r-name')) r.name = e.target.value;
  if (e.target.classList.contains('r-cur')) r.cur = Math.max(0, num(e.target.value));
  if (e.target.classList.contains('r-max')) r.max = Math.max(0, num(e.target.value));
  if (e.target.classList.contains('r-rest')) r.rest = e.target.value;
});
$('#resPreset').innerHTML = '<option value="">Choose…</option>' + [...new Set(RES_PRESETS.map(p => p.g))].map(g =>
  `<optgroup label="${g}">${RES_PRESETS.map((p, i) => p.g === g ? `<option value="${i}">${p.name}</option>` : '').join('')}</optgroup>`).join('');
$('#resPreset').addEventListener('change', e => {
  const p = RES_PRESETS[+e.target.value]; e.target.value = '';
  if (!p) return;
  if (p.name === 'Hit Dice') {                      // one pool per die size when multiclassing
    if (editRes.some(r => /^Hit Dice/.test(r.name))) return toast('Hit Dice are already listed.');
    const cls = formClasses(); editRes.push({ name: 'Hit Dice', cur: 1, max: 1, rest: 'long' });
    editRes = rebuildHitDice(editRes, cls, cls); editRes.forEach(r => { if (/^Hit Dice/.test(r.name)) r.cur = r.max; });
    return renderResRows();
  }
  const max = p.max(presetLevel(p.name, formClasses()));
  editRes.push({ name: p.name, cur: max, max, rest: p.rest });
  renderResRows();
  if (p.custom) { const n = $$('#resRows .r-name'); n[n.length - 1].focus(); n[n.length - 1].select(); }
});
/** One click for a new character: Hit Dice, the features its classes have unlocked, and spell slots. */
function addClassRes() {
  const cls = formClasses();
  if (!cls.some(c => classInfo(c.name))) return toast('Name a class first (Fighter, Wizard…).');
  const had = editRes.length, notes = [];
  const g = grantResources(editRes, cls, null); editRes = g.res; notes.push(...g.added);
  if (!editRes.some(r => /^Hit Dice/.test(r.name))) { editRes.push({ name: 'Hit Dice', cur: 1, max: 1, rest: 'long' }); editRes = rebuildHitDice(editRes, cls, cls); editRes.forEach(r => { if (/^Hit Dice/.test(r.name)) r.cur = r.max; }); notes.push('Hit Dice'); }
  if (planHasSlots(slotPlan(cls)) && !editRes.some(r => r.slot || /^Pact Slots/.test(r.name))) { editRes = rebuildSlots(editRes, cls); notes.push('spell slots'); }
  renderResRows();
  toast(notes.length ? `Added ${notes.join(', ')}.` : (had ? 'Nothing new to add for these classes.' : 'These classes have no resources to add.'));
}
function fillSlots() {
  const type = $('#slotType').value, total = Math.min(20, clsTotal(formClasses()));
  const fake = { full: 'Wizard', half: 'Paladin', third: 'Eldritch Knight', pact: 'Warlock' };
  const classes = type === 'auto' ? formClasses() : [{ name: fake[type], level: total }];   // a type picked by hand covers every level
  if (!planHasSlots(slotPlan(classes))) { editRes = rebuildSlots(editRes, classes); renderResRows(); return toast(type === 'auto' ? 'None of these classes has spell slots at this level. Pick a caster type to override.' : 'That caster type has no spell slots at this level.'); }
  editRes = rebuildSlots(editRes, classes);
  renderResRows();
  toast('Spell slots filled in.');
}

/* ----- level up the party ----- */
/** Rescale a character's resources after a level up: class features, Hit Dice pools and spell slots. */
function scaleResources(res, oldC, newC) {
  let out = (res || []).map(r => Object.assign({}, r));
  out.forEach(r => {
    const pre = RES_PRESETS.find(x => x.name === r.name && !x.custom);
    if (!pre || r.slot || /^Hit Dice/.test(r.name) || pre.max(presetLevel(r.name, oldC)) !== r.max) return;   // only touch ones still at their default
    const max = pre.max(presetLevel(r.name, newC));
    if (max !== r.max) { r.cur = Math.max(0, Math.min(max, r.cur + Math.max(0, max - r.max))); r.max = max; }
  });
  out = grantResources(out, newC, oldC).res;      // features a new class (or a new level) unlocks
  out = rebuildHitDice(out, oldC, newC);
  const had = out.some(r => r.slot || /^Pact Slots/.test(r.name));
  // existing slots are rescaled; a character who has none only gets slots when they start casting (a new caster class, or a half caster's first slots)
  if (had || (planHasSlots(slotPlan(newC)) && !planHasSlots(slotPlan(oldC)))) out = rebuildSlots(out, newC, oldC);
  return out;
}
const lvAvg = die => die / 2 + 1;
function lvHpFill(row) {
  const hp = row.querySelector('[data-lvhp]'); if (!hp || hp.dataset.touched) return;
  const p = party.find(x => x.id === +row.dataset.lvrow), sel = row.querySelector('[data-lvcls]'), n = Math.max(1, num(row.querySelector('[data-lvn]').value, 1));
  const name = sel.value === 'new' ? row.querySelector('[data-lvnewcls]').value : (clsList(p)[+sel.value] || {}).name;
  hp.value = Math.round(lvAvg(hitDieFor(name)) * n);
}
function openLevelUp() {
  if (campId == null || !party.length) return toast('No characters to level up.');
  $('#lvlRows').innerHTML = party.map(p => {
    const cl = clsList(p), main = cl.reduce((b, c, i) => (c.level > cl[b].level ? i : b), 0), full = p.level >= 20, die = hitDieFor(cl[main].name);
    const off = full ? 'disabled' : '';
    return `<div class="lvl-row ${full ? 'muted' : ''}" data-lvrow="${p.id}">
      <input type="checkbox" data-lv="${p.id}" ${full ? 'disabled' : 'checked'} aria-label="Level up ${esc(p.name)}">
      <span class="lvl-name"><b>${esc(p.name)}</b><small>${esc(classShort(p))} · level ${p.level}</small></span>
      <span class="lvl-cls">
        <select data-lvcls="${p.id}" ${off} aria-label="Class that advances for ${esc(p.name)}">${cl.map((c, i) => `<option value="${i}" ${i === main ? 'selected' : ''}>${esc(c.name || 'Class')} ${c.level} → ${c.level + 1}</option>`).join('')}<option value="new">New class…</option></select>
        <input type="text" data-combo="class" autocomplete="off" maxlength="60" data-lvnewcls="${p.id}" placeholder="Class name" hidden aria-label="New class for ${esc(p.name)}">
      </span>
      <input type="number" min="1" max="${Math.max(1, 20 - p.level)}" value="1" data-lvn="${p.id}" ${off} aria-label="Levels gained by ${esc(p.name)}">
      <input type="number" min="0" max="999" value="${full ? 0 : Math.round(lvAvg(die))}" data-lvhp="${p.id}" ${off} aria-label="HP gained by ${esc(p.name)}">
    </div>`;
  }).join('');
  $('#lvlModal').hidden = false;
}
$('#lvlRows').addEventListener('input', e => {
  const row = e.target.closest('[data-lvrow]'); if (!row) return;
  if (e.target.hasAttribute('data-lvhp')) { e.target.dataset.touched = '1'; return; }
  lvHpFill(row);
});
$('#lvlRows').addEventListener('change', e => {
  const row = e.target.closest('[data-lvrow]'); if (!row) return;
  if (e.target.hasAttribute('data-lvcls')) {
    const nw = row.querySelector('[data-lvnewcls]'); nw.hidden = e.target.value !== 'new';
    if (!nw.hidden) nw.focus();
  }
  lvHpFill(row);
});
$('#lvlForm').addEventListener('submit', async e => {
  e.preventDefault();
  const picks = [];
  for (const cb of $$('#lvlRows [data-lv]:checked')) {
    const id = +cb.dataset.lv, p = party.find(x => x.id === id); if (!p) continue;
    const oldC = clsList(p), newC = oldC.map(c => Object.assign({}, c)), sel = $(`[data-lvcls="${id}"]`).value;
    const n = Math.max(1, Math.min(20 - p.level, num($(`[data-lvn="${id}"]`).value, 1))), hp = Math.max(0, num($(`[data-lvhp="${id}"]`).value, 0));
    let cname;
    if (sel === 'new') {
      cname = $(`[data-lvnewcls="${id}"]`).value.trim();
      if (!cname) { toast(`Name the new class for ${p.name}.`); return; }
      const at = newC.findIndex(c => c.name.toLowerCase() === cname.toLowerCase());
      if (at >= 0) { newC[at].level += n; cname = newC[at].name; } else if (newC.length === 1 && !newC[0].name) { newC[0].name = cname; newC[0].level += n; } else newC.push({ name: cname, level: n });
    } else { newC[+sel].level += n; cname = newC[+sel].name; }
    picks.push({ p, oldC, newC, hp, cname, clevel: newC.find(c => c.name === cname).level });
  }
  if (!picks.length) return toast('Tick at least one character.');
  const scale = $('#lvlRes').checked;
  try {
    Object.values(resTimers).forEach(clearTimeout);
    const saved = await Promise.all(picks.map(({ p, oldC, newC, hp }) => {
      const live = liveOf(p), base = live ? live.hp : p.current_hp, curHp = base > 0 ? base + hp : 0;   // a character at 0 HP gets the max HP but isn't revived
      const body = { classes: newC, max_hp: p.max_hp + hp, current_hp: Math.min(p.max_hp + hp, curHp) };
      if (scale) body.resources = scaleResources(p.resources, oldC, newC);
      return api('PATCH', `/api/characters/${p.id}`, body);
    }));
    const lines = [];
    saved.forEach((sv, i) => {
      const { hp, cname, clevel } = picks[i], k = party.findIndex(x => x.id === sv.id);
      if (k >= 0) party[k] = sv;
      synced[sv.id] = hpKey(sv.current_hp, sv.temp_hp);
      lines.push(`${sv.name} reaches level ${sv.level}${cname && clsList(sv).length > 1 ? ` (${cname} ${clevel})` : ''}${hp ? ` (+${hp} max HP)` : ''}`);
    });
    mutate(() => {
      saved.forEach(sv => {
        const live = liveOf(sv); if (!live) return;
        live.maxHp = sv.max_hp; live.hp = Math.min(sv.max_hp, sv.current_hp);
      });
      log(`Level up! ${lines.join('; ')}.`, 'heal');
    }, { noUndo: true });
    closeAllModals(); await loadParty(); toast(picks.length > 1 ? 'The party levelled up.' : `${saved[0].name} levelled up.`);
  } catch (err) { toast(err.message); }
});

function renderParty() {
  const sel = $('#campSelect');
  if (!sel) return;
  sel.innerHTML = campaigns.length
    ? campaigns.map(c => `<option value="${c.id}" ${c.id === campId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')
    : '<option>No campaigns yet</option>';
  sel.disabled = !campaigns.length;
  $$('[data-action="renameCampaign"], [data-action="deleteCampaign"]').forEach(b => { b.disabled = campId == null; });

  // Party-at-a-glance stats
  const n = party.length;
  const sum = k => party.reduce((a, p) => a + p[k], 0);
  // HP and AC come from the live combatant while a character is fighting
  const curHp = party.reduce((a, p) => a + (liveOf(p) ? liveOf(p).hp : p.current_hp), 0);
  const maxHp = party.reduce((a, p) => a + (liveOf(p) ? liveOf(p).maxHp : p.max_hp), 0);
  const sumAc = party.reduce((a, p) => a + (liveOf(p) ? liveOf(p).ac : p.ac), 0);
  $('#partyStats').innerHTML = n ? `
    <div><b>${n}</b><span>heroes</span></div>
    <div><b>${(sum('level') / n).toFixed(1).replace(/\.0$/, '')}</b><span>avg lvl</span></div>
    <div class="hpt"><b>${curHp}/${maxHp}</b><span>party HP</span></div>
    <div><b>${(sumAc / n).toFixed(1).replace(/\.0$/, '')}</b><span>avg AC</span></div>` : '';

  const listEl2 = $('#partyList');
  if (dbError) { listEl2.innerHTML = `<div class="party-empty err">${esc(dbError)}</div>`; return; }
  if (!partyReady) { listEl2.innerHTML = '<div class="party-empty">Loading…</div>'; return; }
  if (campId == null) {
    listEl2.innerHTML = '<div class="party-empty">No campaign yet.<br><button class="btn btn-primary sm" data-action="newCampaign">Create your first campaign</button></div>';
    return;
  }
  if (!n) { listEl2.innerHTML = '<div class="party-empty">No characters yet.<br>Add your first hero below.</div>'; return; }

  listEl2.innerHTML = party.map(p => {
    const live = liveOf(p);
    const inCombat = !!live;
    const hp = live ? live.hp : p.current_hp;
    const maxHp2 = live ? live.maxHp : p.max_hp;
    const temp = live ? live.temp : (p.temp_hp || 0);
    const ac = live ? live.ac : p.ac;
    const pct = maxHp2 ? Math.max(0, Math.min(100, hp / maxHp2 * 100)) : 0;
    const fill = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '';
    const dead = live && isDead(live);
    const conds = live ? live.conditions : [];
    const condHtml = conds.slice(0, 4).map(x => `<span class="pc-cond" style="--c:${COND[x.key].color}" title="${esc(COND[x.key].desc)}${x.dur ? ' (' + x.dur + ' rounds left)' : ''}">${esc(COND[x.key].name)}</span>`).join('') + (conds.length > 4 ? `<span class="pc-cond more" title="${esc(conds.slice(4).map(x => COND[x.key].name).join(', '))}">+${conds.length - 4} more</span>` : '');
    const sub = [classLine(p), p.player && `(${p.player})`].filter(Boolean).join(' ');
    return `
    <div class="pc-card ${inCombat ? 'in' : ''} ${hp === 0 ? 'down' : ''} ${dead ? 'dead' : ''}" draggable="true" data-char="${p.id}" title="${esc(p.notes || '')}">
      <span class="grip">${ic('grip', 'fill')}</span>
      <div class="pc-main">
        <div class="pc-name"><span class="pc-nm">${esc(p.name)}</span></div>
        <div class="pc-sub"><span class="pc-sub-t">${esc(sub)}</span>${inCombat ? '<span class="pc-badge">In combat</span>' : ''}</div>
        <div class="pc-hp" title="${hp}/${maxHp2} HP${temp ? ' + ' + temp + ' temp' : ''}">
          <div class="pc-hpfill ${fill}" style="width:${pct}%"></div>
          <span>${ic('hp','stat')} ${hp}/${maxHp2}${temp ? ` <i>${ic('temp','stat')} ${temp}</i>` : ''}</span>
        </div>
        <div class="pc-stats">
          <span title="Armor Class">${ic('ac','stat')} ${ac}</span>
          <span title="Passive Perception">${ic('pp','stat')} ${p.passive_perception}</span>
          <span title="Initiative modifier">Init ${p.init_mod >= 0 ? '+' : ''}${p.init_mod}</span>
        </div>
        ${condHtml ? `<div class="pc-conds">${condHtml}</div>` : ''}
        ${resHtml(p)}
      </div>
      <div class="pc-btns">
        <button class="ibtn" data-action="toCombat" data-char="${p.id}" title="Add to combat">${ic('arrow-right')}</button>
        <button class="ibtn" data-action="editChar" data-char="${p.id}" title="Edit">${ic('edit')}</button>
        <button class="ibtn del" data-action="delChar" data-char="${p.id}" title="Delete">${ic('trash')}</button>
      </div>
    </div>`;
  }).join('');
}

/** Put characters from the party into the combat tracker (skips ones already in combat). */
function addCharsToCombat(ids) {
  const chars = ids.map(id => party.find(p => p.id === id)).filter(Boolean);
  const fresh = chars.filter(ch => !state.combatants.some(c => c.pcId === ch.id));
  if (!fresh.length) {
    return toast(chars.length > 1 ? 'The whole party is already in combat.' : `${chars[0] ? chars[0].name : 'That character'} is already in combat.`);
  }
  openInitModal(fresh);
}

/** Actually add the characters, using the initiative totals the DM typed in (blank = auto-roll). */
function commitChars(fresh, inits) {
  mutate(() => {
    fresh.forEach(ch => {
      const given = inits[ch.id];
      const c = makeCombatant({ name: ch.name, type: 'pc', init: given != null ? given : d20() + ch.init_mod, mod: ch.init_mod, hp: ch.max_hp, ac: ch.ac });
      c.pcId = ch.id;
      c.pp = ch.passive_perception;
      c.temp = ch.temp_hp || 0;
      c.hp = ch.current_hp;          // they enter the fight at whatever HP they really have
      if (c.hp === 0) ['unconscious', 'prone', 'dying'].forEach(k => setCond(c, k, null, true));
      c.notes = [ch.player && `Player: ${ch.player}`, hasClassName(ch) && classLine(ch), ch.notes].filter(Boolean).join(' · ');
      state.combatants.push(c);
      log(`${ch.name} joins the fight (initiative ${c.init}).`);
    });
    sortInit();
  });
  toast(fresh.length === 1 ? `${fresh[0].name} joins the fight.` : `${fresh.length} heroes join the fight.`);
}

/* ----- ask for the players' initiative rolls ----- */
let pendingInit = [];
function openInitModal(chars) {
  pendingInit = chars;
  $('#initRows').innerHTML = chars.map(ch => `
    <div class="init-row">
      <div class="init-who"><b>${esc(ch.name)}</b><small>${esc(ch.player || 'Player')} · mod ${ch.init_mod >= 0 ? '+' : ''}${ch.init_mod}</small></div>
      <input type="number" data-initfor="${ch.id}" placeholder="roll" aria-label="Initiative for ${esc(ch.name)}">
      <button type="button" class="ibtn" data-action="rollRow" data-char="${ch.id}" title="Roll d20 + ${ch.init_mod} for them">${ic('dice')}</button>
    </div>`).join('');
  $('#initModal').hidden = false;
  const first = $('#initRows input'); if (first) first.focus();
}
$('#initForm').addEventListener('submit', e => {
  e.preventDefault();
  const inits = {};
  $$('#initRows input').forEach(inp => {
    const v = inp.value.trim();
    if (v !== '') inits[+inp.dataset.initfor] = num(v);
  });
  const chars = pendingInit;
  closeAllModals();
  commitChars(chars, inits);
});
function rollRow(id) {
  const ch = party.find(p => p.id === id);
  const inp = $(`#initRows [data-initfor="${id}"]`);
  if (ch && inp) inp.value = d20() + ch.init_mod;
}

/* ----- drag a character from the party into the combat area ----- */
const partyListEl = $('#partyList');
const stageEl = $('.stage');
partyListEl.addEventListener('dragstart', e => {
  const cardEl = e.target.closest && e.target.closest('.pc-card');
  if (!cardEl) return;
  dragCharId = +cardEl.dataset.char;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', 'character:' + dragCharId);
  setTimeout(() => cardEl.classList.add('dragging'), 0);
});
partyListEl.addEventListener('dragend', () => {
  dragCharId = null; stageEl.classList.remove('drop-hot');
  $$('.pc-card.dragging', partyListEl).forEach(el => el.classList.remove('dragging'));
});
stageEl.addEventListener('dragover', e => {
  if (dragCharId == null) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  stageEl.classList.add('drop-hot');
});
stageEl.addEventListener('dragleave', e => {
  if (!stageEl.contains(e.relatedTarget)) stageEl.classList.remove('drop-hot');
});
stageEl.addEventListener('drop', e => {
  if (dragCharId == null) return;
  e.preventDefault(); stageEl.classList.remove('drop-hot');
  const id = dragCharId; dragCharId = null;
  addCharsToCombat([id]);
});

/* ----- campaign picker / name modal ----- */
$('#campSelect').addEventListener('change', e => {
  campId = parseInt(e.target.value, 10);
  lsSet(CAMP_KEY, campId);
  loadParty();
});
function closeAllModals() {
  $$('.modal').forEach(m => { m.hidden = true; }); modal.id = null; curPrompt = null;
  if (confirmDone) { const f = confirmDone; confirmDone = null; f(false); }   // dismissed = cancelled
  if (textDone) textDone(null);
}

/* Themed replacement for window.confirm(). Resolves true/false. */
let confirmDone = null, textDone = null;
function askConfirm({ title = 'Are you sure?', message = '', yes = 'Confirm', no = 'Cancel', danger = true, icon = 'trash' } = {}) {
  if (confirmDone) { const f = confirmDone; confirmDone = null; f(false); }
  return new Promise(resolve => {
    $('#confirmTitle').textContent = title;
    $('#confirmMsg').textContent = message;
    $('#confirmSeal').innerHTML = ic(icon);
    $('#confirmSeal').classList.toggle('safe', !danger);
    const y = $('#confirmYes');
    y.textContent = yes; $('#confirmNo').textContent = no;
    y.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    const finish = v => () => { if (!confirmDone) return; confirmDone = null; $('#confirmModal').hidden = true; resolve(v); };
    confirmDone = resolve;
    y.onclick = finish(true); $('#confirmNo').onclick = finish(false);
    $('#confirmModal').hidden = false;
    $('#confirmNo').focus();   // safe default: Enter won't destroy anything
  });
}

/* Themed replacement for window.prompt(). Resolves the text, or null if cancelled. */
function askText(title, message, { secret = false } = {}) {
  return new Promise(resolve => {
    if (textDone) textDone(null);
    $('#textTitle').textContent = title; $('#textMsg').textContent = message || '';
    const inp = $('#textInput'); inp.value = ''; inp.type = secret ? 'password' : 'text';
    const done = v => { if (!textDone) return; textDone = null; $('#textModal').hidden = true; resolve(v); };
    textDone = done;
    $('#textForm').onsubmit = e => { e.preventDefault(); done(inp.value); };
    $('#textModal').hidden = false; inp.focus();
  });
}

function openNameModal(mode) {
  if (mode === 'rename' && campId == null) return;
  nameMode = mode;
  $('#nameTitle').textContent = mode === 'rename' ? 'Rename Campaign' : 'New Campaign';
  $('#nameInput').value = mode === 'rename' ? campaigns.find(c => c.id === campId).name : '';
  $('#nameModal').hidden = false;
  $('#nameInput').focus(); $('#nameInput').select();
}
$('#nameForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#nameInput').value.trim();
  if (!name) return;
  try {
    if (nameMode === 'create') {
      const c = await api('POST', '/api/campaigns', { name });
      closeAllModals(); await loadCampaigns(c.id); toast(`Campaign “${name}” created.`);
    } else {
      await api('PATCH', `/api/campaigns/${campId}`, { name });
      closeAllModals(); await loadCampaigns(campId); toast('Campaign renamed.');
    }
  } catch (err) { toast(err.message); }
});
async function deleteCampaign() {
  const c = campaigns.find(x => x.id === campId);
  if (!c) return;
  if (!await askConfirm({ title: 'Delete campaign', message: `Delete “${c.name}” and its ${party.length} character${party.length === 1 ? '' : 's'}? This cannot be undone.`, yes: 'Delete Campaign' })) return;
  try { await api('DELETE', `/api/campaigns/${campId}`); await loadCampaigns(); toast('Campaign deleted.'); }
  catch (err) { toast(err.message); }
}

/** Save the fight as a Markdown file: who took part and how it ended, then the chronicle in order. */
function downloadRecap() {
  if (!state.combatants.length && !state.log.length) return toast('Nothing to recap yet.');
  const camp = campaigns.find(c => c.id === campId);
  const day = new Date();
  const dateLong = day.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  const typeName = { pc: 'Hero', monster: 'Monster', ally: 'Ally' };
  const out = [`# Session recap${camp ? ' — ' + camp.name : ''}`, '', `${dateLong} · ${state.started ? `Round ${state.round}` : 'Combat not started'} · ${state.combatants.length} combatant${state.combatants.length === 1 ? '' : 's'}`, ''];
  if (state.combatants.length) {
    out.push('## Combatants', '');
    for (const c of state.combatants.slice().sort((a, b) => b.init - a.init)) {
      const status = isDead(c) ? 'dead' : c.hp <= 0 ? 'down' : `${c.hp}/${c.maxHp} HP`;
      const conds = c.conditions.map(x => COND[x.key].name + (x.level ? ' ' + x.level : '')).concat((c.effects || []).map(e => e.name));
      out.push(`- **${c.name}** (${typeName[c.type] || c.type}, initiative ${c.init}) — ${status}${conds.length ? ' · ' + conds.join(', ') : ''}`);
    }
    out.push('');
  }
  if (state.log.length) {
    out.push('## Chronicle', '');
    let round = null;
    for (const e of state.log.slice().reverse()) {   // the log is newest-first; a recap reads oldest-first
      if (e.round !== round) { if (round !== null) out.push(''); round = e.round; out.push(`### Round ${round}`, ''); }
      out.push(`- ${e.time} · ${e.text}`);
    }
    out.push('');
  }
  const name = `dragonwatch-recap-${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}.md`;
  const url = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Recap downloaded.');
}

/* ----- character modal ----- */
let editCls = [{ name: '', level: 1 }];
const formClasses = () => editCls.map(c => ({ name: c.name.trim(), level: Math.max(1, Math.min(20, Math.round(+c.level) || 1)) }));
function clsTotalText() { const t = clsTotal(formClasses()); $('#clsTotal').textContent = editCls.length > 1 ? `Level ${t} · multiclass` : `Level ${t}`; }
function renderClsRows() {
  $('#clsRows').innerHTML = editCls.map((c, i) => `
    <div class="cls-row" data-ci="${i}">
      <input class="c-name" type="text" data-combo="class" autocomplete="off" maxlength="60" value="${esc(c.name)}" placeholder="${i ? 'Another class' : 'Fighter'}" aria-label="Class name">
      <label class="c-lvl">Level <input class="c-level" type="number" min="1" max="20" value="${c.level}" aria-label="Levels in this class"></label>
      ${editCls.length > 1 ? `<button type="button" class="ibtn del" data-action="rmClass" data-ci="${i}" title="Remove this class">${ic('x')}</button>` : ''}
    </div>`).join('');
  clsTotalText();
}
/** What the class table gives this character, shown as the placeholders of the Combat numbers boxes. */
function combatHint() {
  const hint = $('#cbHint'); if (!hint) return;
  if (!LAB.ready) return;
  const cls = formClasses().filter(c => c.name), level = Math.max(1, formClasses().reduce((s, c) => s + c.level, 0));
  const h = LAB.E.fromCharacter({ name: '', level, classes: cls.length ? cls : [{ name: 'Fighter', level }] });
  $('#cbAtk').placeholder = 'auto ' + (h.atk >= 0 ? '+' : '') + Math.round(h.atk); $('#cbNat').placeholder = 'auto ' + h.nat; $('#cbDmg').placeholder = 'auto ' + Math.round(h.dmg);
  hint.textContent = `Leave a box empty to use the class table (${cls.length ? clsText(cls) : 'a fighter'}: ${h.atk >= 0 ? '+' : ''}${Math.round(h.atk)} to hit, ${h.nat} attack${h.nat === 1 ? '' : 's'}, about ${Math.round(h.dmg)} damage per hit). Spell slots and class features are read from the resources above.`;
}
const clsText = l => l.map(c => `${c.name} ${c.level}`).join(' / ');
$('#clsRows').addEventListener('input', e => {
  combatHint();
  const row = e.target.closest('.cls-row'); if (!row) return;
  const c = editCls[+row.dataset.ci]; if (!c) return;
  if (e.target.classList.contains('c-name')) c.name = e.target.value;
  if (e.target.classList.contains('c-level')) c.level = e.target.value;
  clsTotalText();
});

function openCharModal(id) {
  if (campId == null) { toast('Create a campaign first.'); return openNameModal('create'); }
  editingChar = id != null ? party.find(p => p.id === id) : null;
  const ch = editingChar || { name: '', player: '', class: '', level: 1, max_hp: 10, ac: 10, init_mod: 0, passive_perception: 10, notes: '' };
  $('#charTitle').textContent = editingChar ? `Edit ${ch.name}` : 'New Character';
  $('#cName').value = ch.name; $('#cPlayer').value = ch.player;
  editCls = clsList(ch); renderClsRows();
  $('#cHP').value = ch.max_hp; $('#cAC').value = ch.ac;
  $('#cMod').value = ch.init_mod; $('#cPP').value = ch.passive_perception; $('#cNotes').value = ch.notes;
  const live = editingChar ? liveOf(editingChar) : null;
  $('#cCur').value = editingChar ? (live ? live.hp : ch.current_hp) : '';
  $('#cTemp').value = editingChar ? (live ? live.temp : (ch.temp_hp || 0)) : 0;
  editRes = (ch.resources || []).map(r => Object.assign({}, r));
  renderResRows();
  $('#slotType').value = 'auto';
  const cb = ch.combat || {};
  $('#cbAtk').value = cb.atk ?? ''; $('#cbNat').value = cb.nat ?? ''; $('#cbDmg').value = cb.dmg ?? '';
  combatHint(); ensureLab().then(combatHint).catch(() => { /* the hint just stays generic */ });
  $('#charModal').hidden = false;
  $('#cName').focus();
}
$('#charForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    name: $('#cName').value.trim(), player: $('#cPlayer').value.trim(), temp_hp: Math.max(0, num($('#cTemp').value, 0)), classes: formClasses(), max_hp: num($('#cHP').value, 10), ac: num($('#cAC').value, 10),
    init_mod: num($('#cMod').value), passive_perception: num($('#cPP').value, 10), notes: $('#cNotes').value.trim(),
    resources: editRes.filter(r => r.name.trim()).map(r => Object.assign({}, r, { name: r.name.trim(), cur: Math.min(r.cur, r.max) })),
  };
  body.combat = {};                                                              // blank boxes = use the class table
  for (const [k, id] of [['atk', '#cbAtk'], ['nat', '#cbNat'], ['dmg', '#cbDmg']]) if ($(id).value.trim() !== '') body.combat[k] = +$(id).value;
  if ($('#cCur').value.trim() !== '') body.current_hp = num($('#cCur').value);   // blank = full health
  try {
    const saved = editingChar
      ? await api('PATCH', `/api/characters/${editingChar.id}`, body)
      : await api('POST', `/api/campaigns/${campId}/characters`, body);
    synced[saved.id] = hpKey(saved.current_hp, saved.temp_hp);
    const i = party.findIndex(p => p.id === saved.id);
    if (i >= 0) party[i] = saved; else party.push(saved);

    // If this character is mid-fight, push the edits into their combat entry too
    const live = liveOf(saved);
    if (live) mutate(() => {
      live.name = saved.name; live.ac = saved.ac; live.mod = saved.init_mod; live.maxHp = saved.max_hp;
      live.temp = 0;                                    // adjust real HP first, then set temp HP as typed
      if (saved.current_hp > live.hp) applyHeal(live, saved.current_hp - live.hp);
      else if (saved.current_hp < live.hp) applyDamage(live, live.hp - saved.current_hp);
      live.temp = saved.temp_hp || 0;
    });
    closeAllModals(); await loadParty(); toast('Character saved.');
  } catch (err) { toast(err.message); }
});

async function longRest() {
  if (campId == null || !party.length) return toast('No characters to rest.');
  if (!await askConfirm({ title: 'Take a long rest', message: 'Restore every character in this campaign to full HP and recharge all their resources?', yes: 'Rest', danger: false, icon: 'sun' })) return;
  try {
    Object.values(resTimers).forEach(clearTimeout);
    party = await api('POST', `/api/campaigns/${campId}/rest`);
    party.forEach(p => { synced[p.id] = hpKey(p.current_hp, p.temp_hp); });
    mutate(() => {
      state.combatants.forEach(c => {
        if (c.pcId == null || !party.some(p => p.id === c.pcId)) return;
        c.saves = { s: 0, f: 0 };
        c.temp = 0;
        if (c.hp < c.maxHp) applyHeal(c, c.maxHp - c.hp);
      });
      log('Long rest: the party is back to full HP and resources are recharged.', 'heal');
    });
    toast('The party is fully rested.');
  } catch (err) { toast(err.message); }
}
async function shortRest() {
  if (campId == null || !party.length) return toast('No characters to rest.');
  if (!await askConfirm({ title: 'Take a short rest', message: 'Recharge every short-rest resource (focus points, action surge, pact slots…) for the whole party?', yes: 'Rest', danger: false, icon: 'sun' })) return;
  try {
    Object.values(resTimers).forEach(clearTimeout);
    const fresh = await api('POST', `/api/campaigns/${campId}/short-rest`);
    fresh.forEach(f => { const p = party.find(x => x.id === f.id); if (p) p.resources = f.resources; });
    mutate(() => log('Short rest: short-rest resources recharged.', 'heal'), { noUndo: true });
    toast('Short rest taken.');
  } catch (err) { toast(err.message); }
}
async function deleteChar(id) {
  const ch = party.find(p => p.id === id);
  if (!ch) return;
  const inFight = state.combatants.some(c => c.pcId === id);
  if (!await askConfirm({
    title: 'Remove from the roster',
    message: `Permanently delete ${ch.name} from this campaign?` + (inFight ? ' They will stay in the current fight as an ordinary combatant.' : '') + ' This cannot be undone.',
    yes: 'Delete Character' })) return;
  try {
    await api('DELETE', `/api/characters/${id}`);
    delete synced[id];
    if (inFight) mutate(() => { state.combatants.forEach(c => { if (c.pcId === id) c.pcId = null; }); }, { noUndo: true });
    await loadParty(); toast(`${ch.name} deleted.`); }
  catch (err) { toast(err.message); }
}

/* =====================================================================
   Player view: publish a player-safe snapshot of the fight for /player.html
   ===================================================================== */
const LIVE_ON_KEY = 'dragonwatch.live';
let liveOn = true;   // the player view is always live
/* The player view gets only who is in the fight, their initiative, their conditions and whose turn it is.
   Nothing else (HP, resources, notes) is ever sent to the server for it. */
/** Combatants rotated so the one on turn comes first (only once combat has started). */
function cycleFromTurn() {
  const n = state.combatants.length, t = state.started && n ? state.turn % n : 0;
  return state.combatants.slice(t).concat(state.combatants.slice(0, t));
}
function liveSnapshot() {
  const active = state.combatants[state.turn];
  return {
    round: state.round, started: state.started,
    turnId: active && !active.secret ? active.id : null,   // same highlight the DM sees, even before the first turn ends
    combatants: cycleFromTurn().filter(c => !c.secret).map(c => { return { id: c.id, name: c.name, type: c.type, init: c.init,
      conds: c.conditions.map(x => ({ n: COND[x.key].name, c: COND[x.key].color, lv: x.level || null }))
        .concat((c.effects || []).filter(e => !e.secret).map(e => ({ n: e.name, c: '#d9a441', lv: null, d: e.left }))) }; }),
  };
}
let liveTimer = null;
function publishLive(now) {
  clearTimeout(liveTimer);
  const send = () => {
    const body = liveOn ? liveSnapshot() : { cleared: true };
    api('PUT', '/api/live', body).catch(() => {});
  };
  if (now) send(); else liveTimer = setTimeout(send, 400);
}
setInterval(() => publishLive(true), 20000);   // heartbeat so player screens know the DM is still here

/* The QR code and the Open button use the address this page was opened from, so phones on the same network can follow it. */
function liveLink() { return `${location.origin}${U('player.html')}?room=${DW.room}`; }
function openLive() {
  const url = liveLink();
  $('#liveOpen').href = url;
  let svg = '';
  if (window.qrcode) { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); svg = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  $('#liveQr').innerHTML = svg || '';
  $('#liveModal').hidden = false;
}

/* =====================================================================
   Boot
   ===================================================================== */
renderStatic();
render();
loadCampaigns();
syncCombat();


/* =====================================================================
   Bestiary lookup (Open5e SRD + open content API)
   ===================================================================== */
const OPEN5E = 'https://api.open5e.com/v1/monsters/';
let bestResults = [], bestTimer = null, bestSeq = 0;
function monsterToForm(m) {
  const abil = [];
  const lr = (m.special_abilities || []).map(a => /Legendary Resistance \((\d+)\/Day/i.exec(a.name || '')).find(Boolean);
  if (lr) abil.push(['lr', +lr[1]]);
  if (Array.isArray(m.legendary_actions) && m.legendary_actions.length) {
    const n = /(\d+)\s+legendary actions/i.exec(m.legendary_desc || '');
    abil.push(['la', n ? +n[1] : 3]);
  }
  (m.actions || []).forEach(a => {
    const r = /\(Recharge (\d)(?:\s*[-–]\s*6)?\)/i.exec(a.name || '');
    if (r) abil.push(['recharge', a.name.replace(/\s*\(Recharge[^)]*\)/i, '').trim(), +r[1]]);
  });
  return { name: m.name, type: 'monster', hp: m.hit_points || 1, ac: m.armor_class || 10,
           mod: Math.floor(((m.dexterity || 10) - 10) / 2), abil: abil.length ? abil : null,
           def: defFromText(m.damage_resistances, m.damage_immunities, m.damage_vulnerabilities),
           cr: String(m.challenge_rating || ''), kind: String(m.type || '') };
}

/** Best guess at "attacks per round, to-hit, damage per hit" from an Open5e stat block (null when it has no weapon-style attack). */
const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
function diceAvg(s) {
  let total = 0;
  for (const [, sign, n, d, flat] of String(s || '').replace(/\s+/g, '').matchAll(/([+-]?)(?:(\d+)d(\d+)|(\d+))/g)) {
    const sg = sign === '-' ? -1 : 1; total += sg * (n ? (+n * ((+d + 1) / 2)) : +flat);
  }
  return total;
}
function atkFromOpen5e(m) {
  const acts = (m.actions || []).filter(x => x && x.attack_bonus != null && x.damage_dice);
  if (!acts.length) return null;
  const avg = x => diceAvg(x.damage_dice) + (+x.damage_bonus || 0);
  const best = acts.reduce((p, q) => (avg(q) > avg(p) ? q : p));
  const multi = (m.actions || []).find(x => /^multiattack/i.test(x.name || ''));
  let n = 1;
  if (multi) { const t = /makes (\w+) (?:melee |ranged |weapon )?attacks?/i.exec(multi.desc || ''); n = (t && NUM_WORDS[t[1].toLowerCase()]) || 2; }
  const dmg = Math.round(avg(best) * 10) / 10;
  return dmg > 0 ? { n, hit: Math.round(+best.attack_bonus), dmg } : null;
}
function pickMonster(m) {
  if (!m) return;
  loadTemplate(monsterToForm(m));
}
/** Fill the summon form from a monster template (search result or favourite). */
function loadTemplate(p) {
  pendingAbil = p.abil && p.abil.length ? p.abil : null; pendingName = p.name; pendingDef = hasDef(p.def) ? cloneDef(p.def) : null; pendingNotes = p.notes || '';
  $('#fName').value = p.name; $('#fType').value = p.type; $('#fHP').value = p.hp; $('#fAC').value = p.ac; $('#fMod').value = p.mod; $('#fInit').value = '';
  $('#fName').focus();
  toast(`${p.name} loaded — set the count and press Join the fray.`);
}
function renderBestRows() {
  $('#bestList').innerHTML = bestResults.map((m, i) => `<div class="best-item"><button class="best-row" data-best="${i}" title="${esc(m.document__title || '')}">
      <b>${esc(m.name)}</b><span>CR ${esc(m.challenge_rating)} · ${esc(m.type)} · HP ${m.hit_points} · AC ${m.armor_class}</span></button>
      <button class="best-star ${isFav(m.name) ? 'on' : ''}" data-action="favBest" data-i="${i}" title="${isFav(m.name) ? 'In your Favorited list' : 'Add to Favorited'}" aria-label="Favourite ${esc(m.name)}">${ic('star')}</button></div>`).join('');
}
const searchBestiaryRerender = renderBestRows;
async function searchBestiary(q) {
  const seq = ++bestSeq, st = $('#bestStatus');
  st.textContent = 'Searching the archives…';
  try {
    const url = `${OPEN5E}?name__icontains=${encodeURIComponent(q.trim())}&limit=15&ordering=name`;      // names only: ?search= also matches descriptions
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    if (seq !== bestSeq) return;
    const want = q.trim().toLowerCase(), all = data.results || [];
    bestResults = all.filter(m => String(m.name).toLowerCase().includes(want));              // a second check, in case the service ignores the name filter
    if (bestResults.length !== all.length) data.count = bestResults.length;
    st.textContent = bestResults.length ? `${data.count} found${data.count > bestResults.length ? ' — showing the first ' + bestResults.length : ''}. Click one to load it into the form.` : 'No monsters found.';
    renderBestRows();
  } catch (err) {
    if (seq !== bestSeq) return;
    bestResults = []; $('#bestList').innerHTML = '';
    st.textContent = 'Could not reach the monster database (needs an internet connection).';
  }
}
$('#bestSearch').addEventListener('input', e => {
  clearTimeout(bestTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { bestSeq++; bestResults = []; $('#bestList').innerHTML = ''; $('#bestStatus').textContent = 'Type at least 2 letters to look up a monster.'; return; }
  bestTimer = setTimeout(() => searchBestiary(q), 350);
});


/* =====================================================================
   Defences editor (resistances / immunities / vulnerabilities)
   ===================================================================== */
let defTarget = null;
function openDef(id) {
  const c = byId(id); if (!c) return;
  defTarget = id;
  const d = defOf(c);
  $('#defTitle').textContent = `Defences — ${c.name}`;
  $('#defRows').innerHTML = DMG_TYPES.map(t => {
    const v = d.imm.includes(t) ? 'imm' : d.res.includes(t) ? 'res' : d.vul.includes(t) ? 'vul' : '';
    return `<div class="def-row"><span class="def-name">${cap(t)}</span>
      <select data-def="${t}" aria-label="${cap(t)}"><option value="">Normal</option><option value="res"${v === 'res' ? ' selected' : ''}>Resistant</option><option value="imm"${v === 'imm' ? ' selected' : ''}>Immune</option><option value="vul"${v === 'vul' ? ' selected' : ''}>Vulnerable</option></select>
      ${PHYSICAL.includes(t) ? `<label class="def-nm" title="Magical weapons and spells ignore the resistance or immunity"><input type="checkbox" data-defnm="${t}"${d.nm.includes(t) ? ' checked' : ''}> nonmagical only</label>` : '<span></span>'}</div>`;
  }).join('');
  $('#defModal').hidden = false;
}
$('#defForm').addEventListener('submit', e => {
  e.preventDefault();
  const c = byId(defTarget); if (!c) return closeAllModals();
  const d = blankDef();
  $$('#defRows [data-def]').forEach(s => { if (s.value) d[s.value].push(s.dataset.def); });
  $$('#defRows [data-defnm]').forEach(cb => { const t = cb.dataset.defnm; if (cb.checked && (d.res.includes(t) || d.imm.includes(t))) d.nm.push(t); });
  closeAllModals();
  mutate(() => { c.def = d; log(`${c.name}'s defences: ${defSummary(d) || 'none'}.`, 'effect'); });
});
$('#defClear').addEventListener('click', () => $$('#defRows [data-def]').forEach(s => { s.value = ''; }));

/* =====================================================================
   Favorited monsters (saved on the server, shared by every device)
   ===================================================================== */
const abilSpecs = c => (c.abil || []).map(a => a.kind === 'recharge' ? ['recharge', a.name, a.min] : a.kind === 'uses' ? ['uses', a.name, a.max] : [a.kind, a.max]);
async function loadFavs() {
  try { favs = await api('GET', '/api/bestiary'); lsSet(FAV_KEY, JSON.stringify(favs)); }
  catch (e) { try { favs = JSON.parse(lsGet(FAV_KEY) || '[]'); } catch (e2) { favs = []; } }
  renderFavs(); render();
}
function renderFavs() {
  const q = favQuery.toLowerCase(), list = favs.filter(f => !q || f.name.toLowerCase().includes(q) || (f.kind || '').toLowerCase().includes(q));
  $('#favStatus').textContent = favs.length ? (list.length ? '' : 'No favourites match.') : 'Nothing here yet. Tap the ★ on a monster card or a search result to keep it.';
  $('#favList').innerHTML = list.map(f => `<div class="best-item fav"><button class="best-row" data-fav="${f.id}" title="Load into the summon form"><b>${esc(f.name)}</b><span>${f.cr ? 'CR ' + esc(f.cr) + ' · ' : ''}HP ${f.hp} · AC ${f.ac}${hasDef(f.def) ? ' · ' + esc(defSummary(f.def)) : ''}${f.atk ? ' · ' + f.atk.n + '×' + (f.atk.hit >= 0 ? '+' : '') + f.atk.hit + ' for ' + f.atk.dmg : ''}</span></button>
    <button class="best-star ${f.atk ? 'on' : ''}" data-action="atkFav" data-id="${f.id}" title="${f.atk ? 'Edit' : 'Set'} the attack numbers the Encounter lab uses" aria-label="Attack numbers for ${esc(f.name)}">${ic('swords')}</button>
    <button class="best-star on" data-action="rmFav" data-id="${f.id}" title="Remove from Favorited" aria-label="Remove ${esc(f.name)}">${ic('x')}</button></div>`).join('');
}
async function saveFav(f) {
  try {
    const saved = await api('POST', '/api/bestiary', f);
    const i = favs.findIndex(x => x.id === saved.id);
    if (i >= 0) favs[i] = saved; else favs.push(saved);
    favs.sort((a, b) => a.name.localeCompare(b.name));
    lsSet(FAV_KEY, JSON.stringify(favs));
    renderFavs(); render(); if ($('#bestList').children.length) searchBestiaryRerender();
    toast(`★ ${saved.name} saved to Favorited.`);
  } catch (e) { toast('Could not save the favourite: ' + e.message); }
}
function favFromCard(id) {
  const c = byId(id); if (!c) return;
  const old = favs.find(x => x.name.toLowerCase() === baseName(c.name).toLowerCase()) || {};      // keep the CR and attack numbers already saved for it
  saveFav({ name: baseName(c.name), type: c.type, hp: c.maxHp, ac: c.ac, mod: c.mod, abil: abilSpecs(c), def: defOf(c), notes: c.notes || '', cr: old.cr || '', kind: old.kind || '', atk: old.atk });
}
function favFromSearch(i) {
  const m = bestResults[i]; if (!m) return;
  const t = monsterToForm(m);
  saveFav({ name: t.name, type: 'monster', hp: t.hp, ac: t.ac, mod: t.mod, abil: t.abil || [], def: t.def, cr: t.cr, kind: t.kind, atk: atkFromOpen5e(m) });
}
async function removeFav(id) {
  const f = favs.find(x => x.id === id); if (!f) return;
  if (!await askConfirm({ title: 'Remove favourite?', message: `${f.name} will be removed from your Favorited list.`, yes: 'Remove', icon: 'star' })) return;
  try {
    await api('DELETE', '/api/bestiary/' + id);
    favs = favs.filter(x => x.id !== id); lsSet(FAV_KEY, JSON.stringify(favs));
    renderFavs(); render(); if ($('#bestList').children.length) searchBestiaryRerender();
  } catch (e) { toast('Could not remove it: ' + e.message); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fav]');
  if (b) { const f = favs.find(x => x.id === +b.dataset.fav); if (f) loadTemplate(f); }
});
$('#favSearch').addEventListener('input', e => { favQuery = e.target.value.trim(); renderFavs(); });
loadFavs();

/* =====================================================================
   Themed dropdowns: every <select> opens the app's own menu instead of the
   operating system's list. The real <select> stays in the page (its value and
   change events still drive everything), so nothing else needs to know.
   ===================================================================== */
(function themedSelects() {
  let menu = null, owner = null, items = [], cur = -1;
  /** True when the dropdown sits on a light surface, so its list can be light too. */
  const isLight = el => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] >= 0.4)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) > 140;
    }
    return false;
  };
  const close = (refocus) => {
    if (menu) { menu.remove(); menu = null; }
    if (owner) { owner.removeAttribute('aria-expanded'); if (refocus) owner.focus(); owner = null; }
    items = []; cur = -1;
  };
  const mark = i => {
    items.forEach((b, k) => b.classList.toggle('hot', k === i));
    cur = i; if (items[i]) items[i].scrollIntoView({ block: 'nearest' });
  };
  const choose = i => {
    const sel = owner, b = items[i]; if (!sel || !b) return;
    const v = b.dataset.v; close(true);
    if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
  };
  function open(sel) {
    close();
    owner = sel; sel.setAttribute('aria-expanded', 'true');
    menu = document.createElement('div');
    menu.className = 'menu sel-menu' + (isLight(sel) ? ' light' : ''); menu.setAttribute('role', 'listbox');
    let html = '';
    [...sel.children].forEach(ch => {
      const opts = ch.tagName === 'OPTGROUP' ? [...ch.children] : [ch];
      if (ch.tagName === 'OPTGROUP') html += `<div class="sel-group">${esc(ch.label)}</div>`;
      opts.forEach(o => { const i = [...sel.options].indexOf(o); html += `<button type="button" role="option" data-i="${i}" data-v="${esc(o.value)}" class="${o.selected ? 'sel' : ''}"${o.disabled ? ' disabled' : ''}>${esc(o.textContent)}</button>`; });
    });
    menu.innerHTML = html; document.body.appendChild(menu);
    items = [...menu.querySelectorAll('button')];
    const r = sel.getBoundingClientRect(), mh = Math.min(menu.scrollHeight, 300);
    const below = innerHeight - r.bottom - 10, up = r.top - 10;
    menu.style.minWidth = Math.max(r.width, 140) + 'px';
    menu.style.maxHeight = Math.min(300, Math.max(below, up)) + 'px';
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = (below >= mh || below >= up ? r.bottom + 4 : r.top - Math.min(mh, up) - 4) + 'px';
    const sIdx = items.findIndex(b => b.classList.contains('sel'));
    mark(sIdx >= 0 ? sIdx : 0);
  }
  document.addEventListener('mousedown', e => {
    const s = e.target.closest && e.target.closest('select');
    if (s && !s.disabled) { e.preventDefault(); if (owner === s) close(); else { s.focus(); open(s); } return; }
    if (menu && !e.target.closest('.sel-menu')) close();
  }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.sel-menu button');
    if (b && !b.disabled) { e.stopPropagation(); choose(items.indexOf(b)); }
    else if (e.target.closest && e.target.closest('select')) e.preventDefault();
  }, true);
  document.addEventListener('keydown', e => {
    if (menu) {
      const k = e.key, step = d => { let i = cur; do { i = (i + d + items.length) % items.length; } while (items[i].disabled && i !== cur); mark(i); };
      if (k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); step(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); step(-1); }
      else if (k === 'Home') { e.preventDefault(); e.stopPropagation(); mark(0); }
      else if (k === 'End') { e.preventDefault(); e.stopPropagation(); mark(items.length - 1); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); e.stopPropagation(); choose(cur); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (k === 'Tab') close();
      else if (k.length === 1) {                      // type-ahead
        const i = items.findIndex((b, n) => n > cur && b.textContent.trim().toLowerCase().startsWith(k.toLowerCase())) ;
        const j = i >= 0 ? i : items.findIndex(b => b.textContent.trim().toLowerCase().startsWith(k.toLowerCase()));
        if (j >= 0) mark(j);
      }
      return;
    }
    const s = document.activeElement;
    if (s && s.tagName === 'SELECT' && !s.disabled && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(s); }
  }, true);
  addEventListener('resize', () => close());
  addEventListener('scroll', e => { if (menu && !(e.target.closest && e.target.closest('.sel-menu'))) close(); }, true);
})();

/* =====================================================================
   Timed effects editor
   ===================================================================== */
const QUICK_EFFECTS = [['Bless', 10], ['Bane', 10], ['Haste', 10], ['Slow', 10], ['Rage', 10], ['Hold Person', 10], ['Faerie Fire', 10], ['Guidance', 10], ['Shield of Faith', 100]];
let effTarget = null;
function openEff(id) {
  const c = byId(id); if (!c) return;
  effTarget = id;
  $('#effTitle').textContent = `Timed effect — ${c.name}`;
  $('#effName').value = ''; $('#effDur').value = ''; $('#effUnit').value = 'r'; $('#effTick').value = 'round'; $('#effSecret').checked = false;
  $('#effQuick').innerHTML = QUICK_EFFECTS.map(([n, d]) => `<button type="button" data-action="quickEff" data-n="${esc(n)}" data-d="${d}">${esc(n)}</button>`).join('');
  $('#effModal').hidden = false; $('#effName').focus();
}
$('#effForm').addEventListener('submit', e => {
  e.preventDefault();
  const c = byId(effTarget); if (!c) return closeAllModals();
  const name = $('#effName').value.trim().slice(0, 40), n = num($('#effDur').value, 0);
  if (!name) { toast('Give the effect a name.'); return; }
  if (n < 1) { toast('Enter how long it lasts.'); return; }
  const left = $('#effUnit').value === 'm' ? n * 10 : n;
  closeAllModals();
  mutate(() => {
    (c.effects = c.effects || []).push({ id: 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name, left, tick: $('#effTick').value === 'turn' ? 'turn' : 'round', secret: $('#effSecret').checked });
    log(`${c.name} is under ${name} (${left} round${left === 1 ? '' : 's'}).`, 'effect');
  });
});

/* =====================================================================
   Saved encounters (stored on the server, per campaign or shared)
   ===================================================================== */
const encSummary = e => e.items.map(i => `${i.count > 1 ? i.count + '× ' : ''}${i.name}`).join(', ');
async function loadEncs() {
  const q = campId != null ? `?campaign=${campId}` : '';
  try { encs = await api('GET', '/api/encounters' + q); lsSet(ENC_KEY, JSON.stringify(encs)); }
  catch (e) { try { encs = JSON.parse(lsGet(ENC_KEY) || '[]'); } catch (e2) { encs = []; } }
  renderEncs();
}
function renderEncs() {
  $('#encStatus').textContent = encs.length ? '' : 'Nothing saved yet. Set up a fight, then save it here.';
  $('#encList').innerHTML = encs.map(e => `<div class="best-item enc"><button class="best-row" data-action="loadEnc" data-id="${e.id}" title="Load this encounter"><b>${esc(e.name)}${e.campaign_id == null ? ' <span class="lvl" title="Available in every campaign">shared</span>' : ''}</b><span>${esc(encSummary(e))}</span></button>
    <button class="best-star" data-action="renameEnc" data-id="${e.id}" title="Rename" aria-label="Rename ${esc(e.name)}">${ic('edit')}</button>
    <button class="best-star del" data-action="delEnc" data-id="${e.id}" title="Delete" aria-label="Delete ${esc(e.name)}">${ic('trash')}</button></div>`).join('');
}
/** The monsters and NPCs now in the tracker, grouped by base name into templates with a count. */
function encItemsFromTracker() {
  const groups = new Map();
  state.combatants.filter(c => c.type !== 'pc').forEach(c => {
    const base = baseName(c.name), key = base.toLowerCase() + '|' + c.type;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { name: base, type: c.type, hp: c.maxHp, ac: c.ac, mod: c.mod, abil: abilSpecs(c), def: defOf(c), notes: c.notes || '', count: 1 });
  });
  return [...groups.values()];
}
function openSaveEnc() {
  encRenaming = null; $('#encSaveTitle').textContent = 'Save encounter'; $('#encShareRow').hidden = false;
  const items = encItemsFromTracker();
  if (!items.length) return toast('Add some monsters to the tracker first.');
  $('#encSavePreview').textContent = encSummary({ items });
  $('#encName').value = ''; $('#encShared').checked = campId == null; $('#encShared').disabled = campId == null;
  $('#encSaveModal').hidden = false; $('#encName').focus();
}
$('#encSaveForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#encName').value.trim(); if (!name) return;
  if (encRenaming != null) {
    const id = encRenaming; encRenaming = null; closeAllModals();
    try { await api('PUT', '/api/encounters/' + id, { name }); await loadEncs(); toast('Encounter renamed.'); } catch (err) { toast('Could not rename: ' + err.message); }
    return;
  }
  const body = { name, items: encItemsFromTracker(), campaign_id: $('#encShared').checked || campId == null ? null : campId };
  if (encs.some(x => x.name.toLowerCase() === name.toLowerCase() && x.campaign_id === body.campaign_id) && !(await askConfirm({ title: 'Replace encounter?', message: `“${name}” already exists. Replace it with what is in the tracker now?`, yes: 'Replace', danger: false, icon: 'swords' }))) return;
  closeAllModals();
  try { const saved = await api('POST', '/api/encounters', body); await loadEncs(); toast(`Encounter “${saved.name}” saved.`); }
  catch (err) { toast('Could not save the encounter: ' + err.message); }
});
function loadEncClick(id) {
  const e = encs.find(x => x.id === id); if (!e) return;
  encPending = e;
  if (!state.combatants.length) return doLoadEnc(false);
  $('#encLoadTitle').textContent = e.name;
  $('#encLoadInfo').textContent = `${encSummary(e)}. There are already combatants in the tracker: add these to them, or clear the tracker first?`;
  $('#encLoadModal').hidden = false;
}
function doLoadEnc(replace) {
  const e = encPending; encPending = null; if (!e) return;
  closeAllModals();
  mutate(() => {
    if (replace) state = Object.assign(blank(), { nextId: state.nextId, tie: state.tie });
    let total = 0;
    e.items.forEach(it => {
      const base = it.name, same = state.combatants.filter(c => baseName(c.name).toLowerCase() === base.toLowerCase()).length;
      const numbered = it.count > 1 || same > 0;
      for (let i = 1; i <= it.count; i++) {
        const nm = numbered ? `${base} ${same + i}` : base;
        state.combatants.push(makeCombatant({ ...it, name: nm, init: d20() + it.mod }));
        total++;
      }
      if (same === 1 && it.count >= 1) { const first = state.combatants.find(c => c.name === base); if (first) first.name = `${base} 1`; }
    });
    sortInit();
    log(`Encounter “${e.name}” loaded (${total} creature${total === 1 ? '' : 's'}).`);
  });
}
function renameEnc(id) {
  const e = encs.find(z => z.id === id); if (!e) return;
  encRenaming = id;
  $('#encSaveTitle').textContent = 'Rename encounter';
  $('#encSavePreview').textContent = encSummary(e);
  $('#encName').value = e.name; $('#encShareRow').hidden = true;
  $('#encSaveModal').hidden = false; $('#encName').select();
}
async function delEnc(id) {
  const e = encs.find(x => x.id === id); if (!e) return;
  if (!(await askConfirm({ title: 'Delete encounter', message: `Delete “${e.name}”? This cannot be undone.`, yes: 'Delete' }))) return;
  try { await api('DELETE', '/api/encounters/' + id); await loadEncs(); toast('Encounter deleted.'); } catch (err) { toast('Could not delete: ' + err.message); }
}

/* =====================================================================
   Account: password, player link, backup, recycle bin, activity, administration
   ===================================================================== */
document.getElementById('acctName').textContent = DW.user;
let acctCur = 'account';
const fmtDate = s => { const d = new Date(String(s).replace(' ', 'T') + 'Z'); return isNaN(d) ? String(s || '') : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); };
const AUDIT_LABEL = { login: 'Signed in', 'login-failed': 'Failed sign-in', logout: 'Signed out', setup: 'Account created (first setup)', signup: 'Account created', 'password-changed': 'Password changed', 'password-change-failed': 'Password change failed',
  'room-rotated': 'New player link created', export: 'Backup downloaded', import: 'Backup restored', restored: 'Restored from the recycle bin', 'deleted-forever': 'Deleted forever', 'trash-emptied': 'Recycle bin emptied',
  'campaign-deleted': 'Campaign deleted', 'character-deleted': 'Character deleted', 'favorite-removed': 'Favorite removed', 'encounter-deleted': 'Encounter deleted', 'account-created': 'Account created by admin',
  'account-deleted': 'Account deleted', 'password-reset': 'Password reset by admin', 'full-backup-downloaded': 'Full server backup downloaded' };
function openAcct() {
  $('#acctUsersTab').hidden = !DW.admin;
  $('#acctModal').hidden = false; acctTab('account');
}
function acctTab(t) {
  acctCur = t;
  $$('#acctTabs .chip-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  ({ account: renderAcctAccount, backup: renderAcctBackup, trash: renderAcctTrash, activity: renderAcctActivity, users: renderAcctUsers }[t] || renderAcctAccount)();
}
const acctMsg = (t, ok) => { const m = $('#acctMsg'); if (m) { m.textContent = t || ''; m.classList.toggle('ok', !!ok); } };
function renderAcctAccount() {
  $('#acctBody').innerHTML = `
    <div class="acct-sec"><h4>Signed in</h4>
      <p class="init-help" style="margin:0">You are signed in as <b>${esc(DW.user)}</b>${DW.admin ? ' (administrator)' : ''}. Everything you save belongs to this account only.</p>
      <div class="acct-row" style="margin-top:10px"><button class="btn" data-action="acctSignOut">Sign out</button></div></div>
    <div class="acct-sec"><h4>Player view link</h4>
      <p class="init-help" style="margin:0 0 8px">Your private table code is <span class="acct-room">${esc(DW.room)}</span>. It is part of the player link, so only people you give the link to can watch your table. If it leaks, make a new one; the old link stops working.</p>
      <button class="btn" data-action="acctRotate">Make a new table link</button></div>
    <form class="acct-sec" id="pwForm" autocomplete="off"><h4>Change password</h4>
      <input type="text" name="username" value="${esc(DW.user)}" autocomplete="username" hidden>
      <label>Current password <input type="password" id="pwCur" autocomplete="current-password" required></label>
      <label>New password <input type="password" id="pwNew" autocomplete="new-password" minlength="10" required></label>
      <label>Repeat new password <input type="password" id="pwNew2" autocomplete="new-password" minlength="10" required></label>
      <button class="btn btn-primary" type="submit">Change password</button>
      <p class="live-hint">At least 10 characters. Your other signed-in devices are signed out when you change it.</p></form>
    <p class="acct-msg" id="acctMsg" role="status"></p>`;
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('#pwNew').value !== $('#pwNew2').value) return acctMsg('The new passwords do not match.');
    try { await api('POST', '/api/password', { current: $('#pwCur').value, next: $('#pwNew').value }); $('#pwForm').reset(); acctMsg('Password changed.', true); }
    catch (err) { acctMsg(err.message); }
  });
}
async function rotateRoom() {
  if (!(await askConfirm({ title: 'New table link', message: 'Make a new player link? Screens using the old link will stop updating until they open the new one.', yes: 'Make new link', danger: false, icon: 'eye' }))) return;
  try { const r = await api('POST', '/api/room/rotate'); DW.room = r.room; publishLive(true); renderAcctAccount(); acctMsg('New link created. Open Player view to share it.', true); }
  catch (err) { acctMsg(err.message); }
}
async function signOut() {
  try { if (localStorage.getItem(DIRTY_KEY) === '1') { clearTimeout(saveTimer); await serverSave(); } } catch (e) { /* ignore */ }
  if (localStorage.getItem(DIRTY_KEY) === '1' && !(await askConfirm({ title: 'Unsaved changes', message: 'Your latest changes could not be saved to the server. Sign out anyway? They will be lost.', yes: 'Sign out anyway' }))) return;
  try { await api('POST', '/api/logout'); } catch (e) { /* ignore */ }
  try { Object.keys(localStorage).filter(k => k.startsWith(`dragonwatch.u${DW.uid}.`)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ }   // leave nothing behind on a shared computer
  location.replace(U('login.html'));
}
function renderAcctBackup() {
  $('#acctBody').innerHTML = `
    <div class="acct-sec"><h4>Download a backup</h4>
      <p class="init-help" style="margin:0 0 8px">One file with all your campaigns, characters, favorite monsters and saved encounters. Keep it somewhere safe.</p>
      <a class="btn btn-primary" href="${U('/api/export')}" download>Download my backup</a></div>
    <div class="acct-sec"><h4>Restore from a backup</h4>
      <p class="init-help" style="margin:0 0 8px">Adds the contents of a backup file to this account. Nothing you already have is overwritten or deleted; restored campaigns that share a name get “(restored)” added.</p>
      <input type="file" id="impFile" accept="application/json,.json"> <button class="btn" id="impGo">Restore</button></div>
    <div class="acct-sec"><h4>Automatic copies</h4>
      <p class="init-help" style="margin:0">The server also keeps a full copy of its database every day and holds on to the last 14, in its data folder.</p>
      ${DW.admin ? `<div class="acct-row" style="margin-top:10px"><a class="btn" href="${U('/admin/backup')}" download>Download a full server backup</a></div>` : ''}</div>
    <p class="acct-msg" id="acctMsg" role="status"></p>`;
  $('#impGo').onclick = async () => {
    const f = $('#impFile').files[0]; if (!f) return acctMsg('Choose a backup file first.');
    if (f.size > 4.5e6) return acctMsg('That file is too large to be a backup.');
    try {
      const r = await api('POST', '/api/import', JSON.parse(await f.text()));
      acctMsg(`Restored ${r.campaigns} campaign(s), ${r.characters} character(s), ${r.favorites} favorite(s), ${r.encounters} encounter(s).`, true);
      await loadCampaigns(); loadFavs(); loadEncs();
    } catch (err) { acctMsg(err instanceof SyntaxError ? 'That file is not a Dragonwatch backup.' : err.message); }
  };
}
const TRASH_LABEL = { campaign: 'Campaign', character: 'Character', favorite: 'Favorite', encounter: 'Encounter' };
async function renderAcctTrash() {
  $('#acctBody').innerHTML = '<p class="init-help">Loading…</p>';
  try {
    const r = await api('GET', '/api/trash');
    $('#acctBody').innerHTML = `<p class="init-help" style="margin:0 0 10px">Deleted campaigns, characters, favorites and encounters wait here for ${r.days} days, then disappear for good.</p>
      ${r.items.length ? `<div class="acct-list">${r.items.map(i => `<div class="acct-item"><div><b>${esc(i.name)}</b><small>${TRASH_LABEL[i.type]} · ${esc(i.detail)} · deleted ${esc(fmtDate(i.deleted_at))}</small></div>
        <div class="acct-row"><button class="btn sm" data-action="trashRestore" data-type="${i.type}" data-id="${i.id}">Restore</button><button class="btn btn-danger sm" data-action="trashDelete" data-type="${i.type}" data-id="${i.id}">Delete forever</button></div></div>`).join('')}</div>
        <div class="acct-row" style="margin-top:12px"><button class="btn btn-danger" data-action="trashEmpty">Empty the recycle bin</button></div>` : '<p class="init-help">The recycle bin is empty.</p>'}
      <p class="acct-msg" id="acctMsg" role="status"></p>`;
  } catch (err) { $('#acctBody').innerHTML = `<p class="acct-msg">${esc(err.message)}</p>`; }
}
async function trashAct(kind, type, id) {
  try {
    if (kind === 'restore') await api('POST', '/api/trash/restore', { type, id });
    else { if (!(await askConfirm({ title: 'Delete forever', message: 'Delete this for good? This cannot be undone.', yes: 'Delete forever' }))) return; await api('DELETE', `/api/trash/${type}/${id}`); }
    await renderAcctTrash(); if (kind === 'restore') { acctMsg('Restored.', true); await loadCampaigns(); loadFavs(); loadEncs(); }
  } catch (err) { acctMsg(err.message); }
}
async function trashEmpty() {
  if (!(await askConfirm({ title: 'Empty the recycle bin', message: 'Delete everything in the recycle bin for good?', yes: 'Empty it' }))) return;
  try { await api('DELETE', '/api/trash'); await renderAcctTrash(); } catch (err) { acctMsg(err.message); }
}
async function renderAcctActivity() {
  $('#acctBody').innerHTML = '<p class="init-help">Loading…</p>';
  try {
    const rows = await api('GET', '/api/audit' + (DW.admin ? '?all=1' : ''));
    $('#acctBody').innerHTML = `<p class="init-help" style="margin:0 0 10px">${DW.admin ? 'Recent activity on every account.' : 'Recent activity on your account.'} Failed sign-ins you did not make are a sign someone is guessing your password.</p>
      <div class="acct-list">${rows.map(r => `<div class="acct-item"><div><b>${esc(AUDIT_LABEL[r.action] || r.action)}</b><small>${esc(fmtDate(r.at))}${DW.admin && r.username ? ' · ' + esc(r.username) : ''}${r.detail ? ' · ' + esc(r.detail) : ''} · ${esc(r.ip)}</small></div></div>`).join('') || '<div class="acct-item">Nothing yet.</div>'}</div>`;
  } catch (err) { $('#acctBody').innerHTML = `<p class="acct-msg">${esc(err.message)}</p>`; }
}
async function renderAcctUsers() {
  if (!DW.admin) return;
  $('#acctBody').innerHTML = '<p class="init-help">Loading…</p>';
  try {
    const us = await api('GET', '/api/users');
    $('#acctBody').innerHTML = `<div class="acct-sec"><h4>Accounts</h4><div class="acct-list">${us.map(u => `<div class="acct-item"><div><b>${esc(u.username)}</b>${u.is_admin ? ' (administrator)' : ''}<small>Last sign-in: ${u.last_login ? esc(fmtDate(u.last_login)) : 'never'}</small></div>
        <div class="acct-row"><button class="btn sm" data-action="userReset" data-id="${u.id}">Reset password</button>${u.id === DW.uid ? '' : `<button class="btn btn-danger sm" data-action="userDelete" data-id="${u.id}">Delete</button>`}</div></div>`).join('')}</div></div>
      <form class="acct-sec" id="newUserForm" autocomplete="off"><h4>Create an account</h4>
        <label>Username <input type="text" id="nuName" maxlength="32" required></label>
        <label>Temporary password <input type="text" id="nuPass" minlength="10" required placeholder="At least 10 characters"></label>
        <label class="def-nm"><input type="checkbox" id="nuAdmin"> Administrator</label>
        <button class="btn btn-primary" type="submit" style="margin-top:10px">Create account</button>
        <p class="live-hint">Give them the password privately; they will be asked to choose their own when they first sign in. Each account has its own campaigns, favorites, encounters and fight.</p></form>
      <p class="acct-msg" id="acctMsg" role="status"></p>`;
    $('#newUserForm').addEventListener('submit', async e => {
      e.preventDefault();
      try { await api('POST', '/api/users', { username: $('#nuName').value.trim(), password: $('#nuPass').value, admin: $('#nuAdmin').checked }); await renderAcctUsers(); acctMsg('Account created.', true); }
      catch (err) { acctMsg(err.message); }
    });
  } catch (err) { $('#acctBody').innerHTML = `<p class="acct-msg">${esc(err.message)}</p>`; }
}
async function userDelete(id) {
  if (!(await askConfirm({ title: 'Delete account', message: 'Delete this account and everything saved in it (campaigns, characters, favorites, encounters)? This cannot be undone. Download a full server backup first if unsure.', yes: 'Delete account' }))) return;
  try { await api('DELETE', '/api/users/' + id); await renderAcctUsers(); acctMsg('Account deleted.', true); } catch (err) { acctMsg(err.message); }
}
async function userReset(id) {
  const pw = await askText('Reset password', 'Choose a new temporary password (at least 10 characters). They will be asked to replace it when they sign in.', { secret: true });
  if (!pw) return;
  try { await api('POST', `/api/users/${id}/password`, { password: pw }); acctMsg('Password reset. That account was signed out everywhere.', true); } catch (err) { acctMsg(err.message); }
}


/* =====================================================================
   Live party win chance
   Re-runs the Encounter lab simulation from the fight as it stands now (current HP, who is down).
   ===================================================================== */
const winBase = n => String(n).replace(/\s*[#(]?\d+\)?\s*$/, '').trim().toLowerCase();
function winMonster(c) {
  const key = winBase(c.name), fav = favs.find(f => f.atk && f.cr && CR_XP_TABLE[f.cr] != null && f.name.toLowerCase() === key);
  let m = fav ? labFavToMon(fav) : LAB.mons.find(x => x.name.toLowerCase() === key);
  let stand = false;
  if (!m) {                                    // unknown creature: borrow attacks from the SRD creature closest in hit points
    stand = true;
    const hp = Math.max(1, c.maxHp || c.hp);
    m = LAB.mons.reduce((b, x) => (Math.abs(Math.log(x.hp / hp)) < Math.abs(Math.log(b.hp / hp)) ? x : b), LAB.mons[0]);
  }
  return { stand, mon: { ...m, name: c.name, hp: c.hp, ac: c.ac > 0 ? c.ac : m.ac, regen: stand ? 0 : m.regen || 0 } };
}
/** One party member for the simulation, built from the character (class, slots, features, real numbers) and the fight as it stands (HP now, AC, initiative). */
function winHero(c) {
  const ch = c.pcId != null ? party.find(p => p.id === c.pcId) : null;
  if (!ch) {                                   // a PC added by hand, with no character behind it: a standard fighter of the party's level
    const lv = party.length ? Math.round(party.reduce((s, p) => s + (+p.level || 1), 0) / party.length) : 3;
    const h = LAB.E.pcStats(Math.max(1, Math.min(20, Math.round(lv || 1))), 'Fighter');
    h.hp = c.hp; h.max = Math.max(c.maxHp || 0, c.hp, 1); if (c.ac > 0) h.ac = c.ac; h.init = c.mod || 0;
    return Object.assign(h, { name: c.name, loose: true });
  }
  const h = labHeroFor(Object.assign({}, ch, { max_hp: Math.max(c.maxHp || ch.max_hp, 1), current_hp: c.hp, ac: c.ac > 0 ? c.ac : ch.ac, init_mod: c.mod || 0 }));
  h.name = c.name; h.hp = c.hp; h.own = !!(ch.combat && (ch.combat.atk || ch.combat.nat || ch.combat.dmg));
  h.clsText = clsList(ch).filter(x => x.name).map(x => `${x.name} ${x.level}`).join(' / ') || ch.class || '';
  return h;
}
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
/** What the simulation was told about one hero, in words, for the pop-up. */
function winHeroLine(h) {
  const bits = [h.hp <= 0 ? 'Down' : `HP ${Math.round(h.hp)} of ${Math.round(h.max)}`];
  const sl = (h.slots || []).map((n, i) => n > 0 ? `${n}× ${ORD[i]}` : '').filter(Boolean);
  if (sl.length) bits.push('slots: ' + sl.join(', '));
  if (h.surge > 0) bits.push('Action Surge ready');
  if (h.sw > 0) bits.push('Second Wind ready');
  if (h.loh > 0) bits.push('Lay on Hands ' + Math.round(h.loh));
  if (h.rage) bits.push('Rage ready');
  if (h.smite && sl.length) bits.push('smite ready');
  if (!sl.length && h.blast) bits.push('cantrips only');
  return bits.join(' · ');
}
function scheduleWin() {
  clearTimeout(WIN.timer);
  WIN.timer = setTimeout(updateWin, 250);
}
async function updateWin() {
  if (!Array.isArray(state.win)) state.win = [];
  const chip = $('#winChip');
  const pcs = state.combatants.filter(c => c.type === 'pc' && !isDead(c)), foes = state.combatants.filter(c => c.type === 'monster' && !isDead(c) && c.hp > 0);
  if (!pcs.length || !foes.length) { chip.hidden = true; closeWin(); return; }
  const key = JSON.stringify([state.combatants.map(c => [c.id, c.hp, c.ac, c.type, isDead(c)]), party.map(p => [p.id, p.level, p.max_hp, p.ac, p.init_mod, JSON.stringify(p.classes), JSON.stringify(p.resources), JSON.stringify(p.combat)])]);
  if (key === WIN.key && WIN.now != null) { chip.hidden = false; return; }
  if (!LAB.ready) { try { await ensureLab(); } catch (e) { chip.hidden = true; return; } }
  if (WIN.busy) { scheduleWin(); return; }
  WIN.busy = true; chip.classList.add('busy');
  await new Promise(r => setTimeout(r, 0));
  try {
    const up = pcs.filter(c => c.hp > 0), down = pcs.filter(c => c.hp === 0);
    const heroes = pcs.map(winHero), ms = foes.map(winMonster);                    // downed heroes stay in: a healer can bring them back up
    const p = up.length ? Math.round(LAB.E.simulate(heroes, ms.map(x => x.mon), 600).p_win * 100) : 0;
    WIN.key = key; WIN.heroes = heroes; WIN.fallback = ms.filter(x => x.stand).length; WIN.down = down.map(c => c.name);
    WIN.pHp = [pcs.reduce((s, c) => s + c.hp, 0), pcs.reduce((s, c) => s + c.maxHp, 0)];
    WIN.mHp = [foes.reduce((s, c) => s + c.hp, 0), foes.reduce((s, c) => s + c.maxHp, 0)];
    WIN.now = p;
    if (state.started || !state.win.length) {
      const e = state.win.find(x => x.r === (state.started ? state.round : 0));
      const r = state.started ? state.round : 0;
      if (!e) { state.win.push({ r, p }); if (state.win.length > 40) state.win.shift(); try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (x) { /* ignore */ } queueServerSave(); }
    }
    const ref = state.win.length ? state.win.filter(x => x.r < (state.started ? state.round : 0)).pop() || state.win[0] : null;
    const d = ref && state.started ? p - ref.p : 0;
    $('#winPct').textContent = p + '%';
    $('#winDelta').textContent = d ? (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) : '';
    chip.className = 'win-chip ' + (p >= 65 ? 'good' : p >= 35 ? 'mid' : 'bad');
    chip.hidden = false;
    if (WIN.pop) renderWinPop();
  } finally { WIN.busy = false; chip.classList.remove('busy'); }
}
function toggleWin() { WIN.pop ? closeWin() : openWin(); }
function openWin() {
  if (WIN.now == null) return;
  const pop = document.createElement('div'); pop.className = 'win-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Win chance');
  document.body.appendChild(pop); WIN.pop = pop; $('#winChip').setAttribute('aria-expanded', 'true');
  renderWinPop();
}
function closeWin() { if (WIN.pop) { WIN.pop.remove(); WIN.pop = null; } const c = $('#winChip'); if (c) c.setAttribute('aria-expanded', 'false'); }
function renderWinPop() {
  const pop = WIN.pop; if (!pop) return;
  const pts = state.win.map(x => ({ l: x.r === 0 ? 'Start' : 'R' + x.r, p: x.p })).slice(-7);
  if (pts.length && pts[pts.length - 1].l === 'R' + state.round) pts.pop();
  pts.push({ l: 'Now', p: WIN.now });
  const W = 340, H = 92, X = i => 14 + i * ((W - 28) / Math.max(1, pts.length - 1)), Y = v => 8 + (100 - v) * (H - 16) / 100;
  const line = pts.map((q, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(q.p).toFixed(1)}`).join(' ');
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Win chance by round">
    <line x1="14" x2="${W - 14}" y1="${Y(50)}" y2="${Y(50)}" stroke="#8a6d36" stroke-width="1" stroke-dasharray="3 4" opacity=".5"/>
    ${pts.length > 1 ? `<path d="${line}" fill="none" stroke="#8a1c1c" stroke-width="2.2" stroke-linejoin="round"/>` : ''}
    ${pts.map((q, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(q.p).toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="#8a1c1c"><title>${q.l}: ${q.p}%</title></circle>`).join('')}</svg>
    <div class="wp-axis">${pts.map(q => `<span>${esc(q.l)}</span>`).join('')}</div>`;
  const dn = WIN.down;
  pop.innerHTML = `<h4>Win chance, round by round</h4>${svg}
    <p>The party is at ${Math.round(WIN.pHp[0])} of ${Math.round(WIN.pHp[1])} HP, against ${Math.round(WIN.mHp[0])} of ${Math.round(WIN.mHp[1])} HP for the monsters.${dn.length ? ` <b>${esc(dn.join(', '))} ${dn.length === 1 ? 'is' : 'are'} down</b> and ${dn.length === 1 ? "isn't" : "aren't"} counted as fighting.` : ''}</p>
    <div class="wp-heroes"><h4>Counted for each hero</h4>${(WIN.heroes || []).map(h => `<div class="wp-hero"><b>${esc(h.name)}${h.clsText ? ` <i>${esc(h.clsText)}</i>` : ''}</b><span class="${h.loose ? 'est' : h.own ? 'own' : 'tab'}">${h.loose ? 'Stand-in' : h.own ? 'Your numbers' : 'Class table'}</span><p>${esc(winHeroLine(h))}</p></div>`).join('')}</div>
    <p class="wp-note">An estimate from the Encounter lab simulation, redone after every change. Spell slots and class features come from each character; attacks come from the class table unless you typed your own${WIN.fallback ? `, and ${WIN.fallback} monster${WIN.fallback === 1 ? '' : 's'} without attack data use${WIN.fallback === 1 ? 's' : ''} a stand-in of similar hit points` : ''}.</p>`;
  const r = $('#winChip').getBoundingClientRect(), w = pop.offsetWidth;
  pop.style.top = Math.round(r.bottom + 8) + 'px';
  pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px';
}
document.addEventListener('mousedown', e => { if (WIN.pop && !e.target.closest('.win-pop, #winChip')) closeWin(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWin(); });
window.addEventListener('resize', () => { if (WIN.pop) renderWinPop(); });


/* =====================================================================
   Type-to-search boxes (damage type, class names): the list shows only what contains the letters typed.
   ===================================================================== */
(function combos() {
  const CAST = { full: 'full caster', half: 'half caster', halfup: 'half caster', third: 'third caster', pact: 'pact magic', '': 'martial' };
  const source = kind => kind === 'dtype'
    ? [...DMG_TYPES.map(t => ({ v: t, label: cap(t) })), ...PHYSICAL.map(t => ({ v: t + '+m', label: cap(t) + ' (magic)' }))]
    : Object.keys(CLASSES).map(k => ({ v: k, label: k, sub: `d${CLASSES[k].die} · ${CAST[CLASSES[k].cast] || ''}` }));
  let menu = null, owner = null, items = [], cur = -1;
  const matches = (inp, q) => source(inp.dataset.combo).filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase()));
  const close = () => { if (menu) { menu.remove(); menu = null; } owner = null; items = []; cur = -1; };
  const mark = i => { items.forEach((b, k) => b.classList.toggle('hot', k === i)); cur = i; if (items[i]) items[i].scrollIntoView({ block: 'nearest' }); };
  function open(inp) {
    const q = inp.dataset.typed === '1' ? inp.value : '', list = matches(inp, q);
    if (!menu || owner !== inp) { close(); owner = inp; menu = document.createElement('div'); document.body.appendChild(menu); }
    menu.className = 'menu sel-menu' + (inp.closest('.card, .modal-card') ? ' light' : ''); menu.setAttribute('role', 'listbox');
    menu.innerHTML = list.length
      ? list.map((o, i) => `<button type="button" role="option" data-i="${i}">${esc(o.label)}${o.sub ? `<small class="cb-sub">${esc(o.sub)}</small>` : ''}</button>`).join('')
      : `<div class="sel-group">${inp.dataset.combo === 'dtype' ? 'No damage type contains that' : 'No match: keep typing to use a custom class'}</div>`;
    menu._list = list; items = [...menu.querySelectorAll('button')];
    const r = inp.getBoundingClientRect();
    menu.style.minWidth = Math.max(r.width, 190) + 'px';
    const below = innerHeight - r.bottom - 10, up = r.top - 10, mh = Math.min(menu.scrollHeight, 300);
    menu.style.maxHeight = Math.min(300, Math.max(below, up)) + 'px';
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = (below >= mh || below >= up ? r.bottom + 4 : r.top - Math.min(mh, up) - 4) + 'px';
    mark(items.length ? 0 : -1);
  }
  function pick(o) {
    const inp = owner; if (!inp || !o) return;
    inp.value = o.label; inp.dataset.typed = '0';
    if (inp.dataset.combo === 'dtype') { inp.dataset.key = o.v; const c = byId(+inp.dataset.dtype); if (c) c.dt = o.v; }
    else inp.dispatchEvent(new Event('input', { bubbles: true }));
    close();
  }
  function settle(inp) {           // when leaving a damage type box: empty = default, one clear match = that, anything else = back to what it was
    if (inp.dataset.combo !== 'dtype') return;
    const q = inp.value.trim(), all = source('dtype'), c = byId(+inp.dataset.dtype);
    let key = inp.dataset.key || '';
    if (!q) key = '';
    else { const m = all.find(o => o.label.toLowerCase() === q.toLowerCase()) || (matches(inp, q).length === 1 ? matches(inp, q)[0] : null); if (m) key = m.v; }
    inp.dataset.key = key; inp.value = dtLabel(key); inp.dataset.typed = '0';
    if (c) c.dt = key;
  }
  document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.combo) { t.dataset.typed = '0'; if (t.dataset.combo === 'dtype') t.select(); open(t); } });
  document.addEventListener('focusout', e => { const t = e.target; if (t.dataset && t.dataset.combo) { settle(t); close(); } });
  document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.combo) { t.dataset.typed = '1'; open(t); } });
  document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.sel-menu button[data-i]') && menu && menu._list) e.preventDefault(); }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.sel-menu button[data-i]');
    if (b && menu && menu._list) { e.stopPropagation(); pick(menu._list[+b.dataset.i]); }
  }, true);
  document.addEventListener('keydown', e => {
    const t = e.target; if (!menu || !t.dataset || !t.dataset.combo) return;
    const k = e.key, n = items.length;
    if (k === 'ArrowDown' && n) { e.preventDefault(); e.stopPropagation(); mark((cur + 1) % n); }
    else if (k === 'ArrowUp' && n) { e.preventDefault(); e.stopPropagation(); mark((cur - 1 + n) % n); }
    else if (k === 'Enter' && n && cur >= 0 && t.dataset.typed === '1') { e.preventDefault(); e.stopPropagation(); pick(menu._list[cur]); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  }, true);
  addEventListener('resize', close);
})();
