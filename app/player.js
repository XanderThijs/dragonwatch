/* Dragonwatch player view: read-only. Shows who is in the fight, their initiative and whose turn it is. */
'use strict';
const $ = s => document.querySelector(s);
const BASE = location.pathname.replace(/[^/]*$/, '');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let rev = -1, lastTurn, lastRound = null;
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
(function embers() {   // a few drifting embers behind everything
  if (reduce) return;
  for (let i = 0; i < 22; i++) {
    const e = document.createElement('i'); e.className = 'ember';
    e.style.cssText = `left:${Math.random() * 100}%;--s:${2 + Math.random() * 4}px;--d:${9 + Math.random() * 10}s;--w:${-Math.random() * 14}s;--x:${(Math.random() - .5) * 160}px`;
    $('#fx').appendChild(e);
  }
})();
function roundBanner(n) {
  if (reduce) return;
  $('#rbT').textContent = 'Round ' + n;
  const b = $('#rb'); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
}

const isDead = c => (c.conds || []).some(x => x.n === 'Dead');
let deadNow = null;   // ids that were dead at the last update
function card(c, d) {
  const active = d.turnId === c.id;
  const conds = (c.conds || []).map(x => `<span class="cond" style="--c:${esc(x.c)}">${esc(x.n)}${x.d ? ` <span class="lvl">${esc(x.d)} R</span>` : ''}${x.lv ? ` <span class="lvl">Lv ${esc(x.lv)}</span>` : ''}</span>`).join('');
  return `<article class="card ${esc(c.type)} ${active ? 'active' : ''} ${isDead(c) ? 'dead' : ''}" data-id="${esc(c.id)}">
    <div class="init"><small>Init</small><span class="init-num">${esc(c.init)}</span></div>
    <div class="body"><div class="head"><span class="name">${esc(c.name)}</span></div>${conds ? `<div class="conds">${conds}</div>` : ''}</div>
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
    el.style.zIndex = Math.abs(dy) > 300 ? 3 : 2;
    const base = getComputedStyle(el).transform, b = base === 'none' ? '' : ' ' + base;
    const a = el.animate([{ transform: `translateY(${dy}px)${b}` }, { transform: base }], { duration: 520, easing: 'cubic-bezier(.22,.8,.24,1)' });
    a.onfinish = a.oncancel = () => { el.style.zIndex = ''; };
  });
}

function render(payload) {
  const d = payload.data, list = $('#pvList'), msg = $('#pvMsg'), spot = $('#pvSpot'), nh = $('#pvNextH');
  const none = () => { spot.hidden = true; nh.hidden = true; list.innerHTML = ''; };
  if (!d) {
    none(); msg.hidden = false; lastTurn = undefined; lastRound = null;
    msg.innerHTML = '<h2>Waiting for the Dungeon Master</h2>The battle will appear here as soon as it begins.';
    $('#pvRound').textContent = '–'; $('#pvTurn').innerHTML = '';
    return;
  }
  $('#pvRound').textContent = d.round;
  const active = d.combatants.find(c => c.id === d.turnId);
  $('#pvTurn').innerHTML = active ? `On turn<b>${esc(active.name)}</b>` : (d.started ? '' : 'The battle is about to begin');
  if (!d.combatants.length) {
    none(); msg.hidden = false;
    msg.innerHTML = '<h2>The field is quiet…</h2>No combatants yet.';
    return;
  }
  msg.hidden = true;
  const id = active ? active.id : '';
  if (active) {
    const fresh = id !== lastTurn;
    spot.hidden = false;
    spot.innerHTML = `<div class="kicker">${d.started ? 'On turn' : 'Opens with'}</div>${card(active, d)}`;
    if (fresh && lastTurn !== undefined) { spot.classList.remove('enter'); void spot.offsetWidth; spot.classList.add('enter'); }
  } else {
    spot.hidden = false; spot.classList.remove('enter');
    spot.innerHTML = `<div class="kicker">${d.started ? 'Something stirs' : 'Prepare yourselves'}</div><div class="pv-msg" style="margin:10px auto"><h2>${d.started ? 'Something moves in the dark…' : 'The battle is about to begin'}</h2></div>`;
  }
  if (lastRound !== null && d.round > lastRound && d.started) roundBanner(d.round);
  lastRound = d.round; lastTurn = id;
  const rest = active ? d.combatants.filter(c => c.id !== active.id) : d.combatants;
  nh.hidden = !rest.length;
  flipList(list, rest.map(c => card(c, d)).join(''));
  // a creature just fell: shake, red flash, and 
  const dead = new Set(d.combatants.filter(isDead).map(c => c.id));
  if (deadNow) {
    const fresh = [...dead].filter(x => !deadNow.has(x));
    if (fresh.length) {
      fresh.forEach(x => { const el = document.querySelector(`.card[data-id="${CSS.escape(x)}"]`); if (el) el.classList.add('fall'); });
      if (!reduce) { const f = $('#df'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    }
  }
  deadNow = dead;
}
function setStatus(payload, ok) {
  const el = $('#pvStatus');
  if (!ok) { el.innerHTML = '<span class="stale">Connection lost – retrying…</span>'; return; }
  const age = payload.now && payload.at ? (payload.now - payload.at) / 1000 : 0;
  el.innerHTML = payload.data && age > 60 ? '<span class="stale">The Dungeon Master seems to be away…</span>' : '<span class="live">● Live</span>';
}
const ROOM = new URLSearchParams(location.search).get('room') || '';
async function poll() {
  try {
    const r = await fetch(BASE + 'api/live?room=' + encodeURIComponent(ROOM) + '&rev=' + rev, { cache: 'no-store' });
    if (r.status === 404 || r.status === 400) { $('#pvStatus').innerHTML = '<span class="stale">This link is not valid. Ask your Dungeon Master for a fresh player link.</span>'; return setTimeout(poll, 5000); }
    const p = await r.json();
    if (!p.same) { rev = p.rev; render(p); }
    setStatus(p, true);
  } catch (e) { setStatus(null, false); }
  setTimeout(poll, 1500);
}
poll();

// text size for a TV across the room
let zoom = parseFloat(localStorage.getItem('dragonwatch.pvzoom')) || 1;
function applyZoom() { document.querySelector('.pv-main').style.zoom = zoom; try { localStorage.setItem('dragonwatch.pvzoom', zoom); } catch (e) { /* ignore */ } }
$('#zPlus').onclick = () => { zoom = Math.min(2, +(zoom + .1).toFixed(2)); applyZoom(); };
$('#zMinus').onclick = () => { zoom = Math.max(.7, +(zoom - .1).toFixed(2)); applyZoom(); };
applyZoom();
