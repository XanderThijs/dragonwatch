/* Dragonwatch sign-in page: sign in, first-time setup (creates the administrator), or open sign-up if the server allows it. */
'use strict';
const $ = s => document.querySelector(s);
const BASE = location.pathname.replace(/[^/]*$/, '');
const U = p => BASE + String(p).replace(/^\//, '');
let mode = 'login', info = { setup: false, signup: false };

function show() {
  const setup = mode === 'setup', signup = mode === 'signup', change = mode === 'change';
  $('#gUserRow').hidden = change; $('#gUser').required = !change;
  $('#gNewRow').hidden = !change; $('#gNew').required = change;
  $('#gPassLbl').textContent = change ? 'Temporary password' : 'Password';
  $('#gRules').hidden = !(setup || signup || change);
  $('#gateTitle').textContent = change ? 'Choose your own password' : setup ? 'Welcome — create the first account' : signup ? 'Create an account' : 'Sign in';
  $('#gateHint').textContent = change ? 'You signed in with a temporary password. Choose a new one to continue.' : setup ? 'This first account becomes the administrator. Everything saved before accounts existed (campaigns, favorites, encounters) is moved into it.' : '';
  $('#gConfRow').hidden = !(setup || signup || change);
  $('#gConf').required = setup || signup || change;
  $('#gPass').autocomplete = setup || signup ? 'new-password' : 'current-password';
  $('#gGo').textContent = change ? 'Save password' : setup ? 'Create account' : signup ? 'Create account' : 'Sign in';
  const alt = $('#gAlt');
  alt.hidden = change || !(info.signup && !info.setup);
  alt.innerHTML = signup ? 'Already have an account? <button type="button" id="gSwap">Sign in</button>' : 'No account yet? <button type="button" id="gSwap">Create one</button>';
  const sw = $('#gSwap'); if (sw) sw.onclick = () => { mode = signup ? 'login' : 'signup'; $('#gMsg').textContent = ''; show(); };
}
function msg(t, ok) { const m = $('#gMsg'); m.textContent = t || ''; m.classList.toggle('ok', !!ok); }

async function post(url, body) {
  const r = await fetch(U(url), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DW': '1' }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch (e) { /* ignore */ }
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
$('#gateForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('#gUser').value.trim(), password = $('#gPass').value;
  if (mode === 'change') {
    const next = $('#gNew').value;
    if (next !== $('#gConf').value) return msg('The two new passwords do not match.');
    $('#gGo').disabled = true; msg('');
    try { await post('/api/password', { current: password, next }); msg('Password saved!', true); location.replace(BASE); }
    catch (err) { msg(err.message); $('#gNew').value = ''; $('#gConf').value = ''; }
    finally { $('#gGo').disabled = false; }
    return;
  }
  if ((mode !== 'login') && password !== $('#gConf').value) return msg('The two passwords do not match.');
  $('#gGo').disabled = true; msg('');
  try {
    await post(mode === 'setup' ? '/api/setup' : mode === 'signup' ? '/api/signup' : '/api/login', { username, password });
    if (mode === 'login') { const me = await (await fetch(U('/api/me'), { cache: 'no-store' })).json(); if (me.user && me.user.must_change) { mode = 'change'; $('#gPass').value = password; $('#gPass').value = ''; msg(''); show(); $('#gPass').focus(); return; } }
    msg('Welcome!', true); location.replace(BASE);
  } catch (err) { msg(err.message); $('#gPass').value = ''; $('#gConf').value = ''; $('#gPass').focus(); }
  finally { $('#gGo').disabled = false; }
});
(async () => {
  try {
    info = await (await fetch(U('/api/me'), { cache: 'no-store' })).json();
    if (info.user && !info.user.must_change) return location.replace(BASE);
    mode = info.user ? 'change' : info.setup ? 'setup' : 'login';
  } catch (e) { msg('Cannot reach the server.'); }
  show();
})();
