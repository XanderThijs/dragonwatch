/* Smoke test: starts the real server on a free port with an empty database and checks the main paths.
   Run with:  npm test   (Node 22.5+, no dependencies) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const ROOT = path.join(__dirname, '..');
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
let proc, base, dataDir;

test.before(async () => {
  const port = await freePort();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonwatch-test-'));
  base = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'server.js')], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 10000);
    proc.stdout.on('data', d => { if (String(d).includes('listening')) { clearTimeout(t); res(); } });
    proc.on('exit', c => rej(new Error('server exited early (' + c + ')')));
  });
});
test.after(() => { if (proc) proc.kill(); try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ } });

const post = (url, body, headers = {}) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DW': '1', ...headers }, body: JSON.stringify(body) });

test('the server is healthy and serves the login page', async () => {
  assert.equal((await fetch(base + '/api/health')).status, 200);
  const r = await fetch(base + '/login.html');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<html/i);
});

test('the first account can be created, then setup is closed', async () => {
  const pw = 'a-long-test-password';
  assert.equal((await post('/api/setup', { username: 'admin', password: pw })).status, 201);
  assert.equal((await post('/api/setup', { username: 'other', password: pw })).status, 403);
  const login = await post('/api/login', { username: 'admin', password: pw });
  assert.equal(login.status, 200);
  assert.ok(login.headers.get('set-cookie'), 'a session cookie is set');
});

test('the DM page needs a sign-in', async () => {
  const r = await fetch(base + '/', { redirect: 'manual' });
  assert.equal(r.status, 302);
});

test('the Encounter lab files are bundled and agree with each other', async () => {
  const get = f => fetch(base + '/encounter/' + f).then(r => { assert.equal(r.status, 200, f); return r; });
  await get('engine.js');
  const model = await (await get('model.json')).json();
  const mons = await (await get('lab-monsters.json')).json();
  assert.ok(Array.isArray(mons) && mons.length > 300, 'about 330 SRD creatures');
  const E = require(path.join(ROOT, 'app', 'encounter', 'engine.js'));
  assert.deepEqual(model.features, E.FEATURES, 'the model and the engine use the same feature list');
  const hero = E.heroFromClass('Fighter', 5), mon = mons.find(m => m.name === 'Troll');
  const p = E.predict(model, E.features(5, [hero, hero, hero, hero], [mon]));
  assert.ok(p.p_win >= 0 && p.p_win <= 1, 'a win chance between 0 and 1');
  const sim = E.simulate([hero, hero, hero, hero], [mon], 200);
  assert.ok(sim.p_win >= 0 && sim.p_win <= 1);
});
