/* Dragonwatch SRD monster data for the Encounter lab dialog.
   Reads monsters.json (Open5e / SRD 5.1, CC-BY-4.0) and works out which environments each creature lives in, so the dialog can
   offer an environment filter. (Encounters themselves are generated in the browser by the Encounter lab at /encounter/.)

   Pure and dependency-free: no network, no database. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/* Challenge rating -> XP  (DMG p.274) */
const CR_XP = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900,
  '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000,
  '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};


/* The dialog's environment list. Each key covers several of the raw labels used in the monster data. */
const ENV_GROUPS = [
  { key: 'arctic', label: 'Arctic & tundra', match: ['arctic', 'tundra', 'ice'] },
  { key: 'coast', label: 'Coast & water', match: ['coastal', 'water', 'underwater', 'ocean', 'lake'] },
  { key: 'desert', label: 'Desert', match: ['desert'] },
  { key: 'dungeon', label: 'Dungeon & ruins', match: ['ruin', 'ruins', 'tomb', 'temple', 'laboratory'] },
  { key: 'forest', label: 'Forest', match: ['forest'] },
  { key: 'grassland', label: 'Grassland', match: ['grassland'] },
  { key: 'hills', label: 'Hills & mountains', match: ['hill', 'hills', 'mountain', 'mountains', 'volcano'] },
  { key: 'jungle', label: 'Jungle', match: ['jungle'] },
  { key: 'swamp', label: 'Swamp', match: ['swamp'] },
  { key: 'underdark', label: 'Caves & Underdark', match: ['underdark', 'caverns', 'caves', 'sewer'] },
  { key: 'urban', label: 'Town & city', match: ['urban', 'settlement', 'sewer'] },
  { key: 'feywild', label: 'Feywild', match: ['feywild'] },
  { key: 'shadowfell', label: 'Shadowfell', match: ['shadowfell'] },
  { key: 'hell', label: 'The Nine Hells', match: ['hell'] },
  { key: 'abyss', label: 'The Abyss', match: ['abyss'] },
  { key: 'planes', label: 'Other planes', match: ['plane of earth', 'plane of water', 'plane of fire', 'plane of air', 'astral plane', 'ethereal plane'] },
];
const crNumber = cr => { const s = String(cr).trim(); if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return a / b; } return Number(s); };

/* ------------------------------------------------------------------ monster pool */
function prepare(list) {
  const out = [];
  for (const m of list) {
    const xp = CR_XP[String(m.cr)];
    if (xp == null || xp <= 10) continue;                 // CR 0 creatures add nothing to a budget
    const raw = (m.environments || []).map(e => String(e).toLowerCase());
    const envKeys = new Set(ENV_GROUPS.filter(g => g.match.some(x => raw.includes(x))).map(g => g.key));
    out.push({ m, xp, cr: crNumber(m.cr), envKeys, anyEnv: raw.includes('any'), type: String(m.type || '').toLowerCase() });
  }
  return out;
}
let defaultPool = null;
function loadMonsters(file = path.join(__dirname, 'monsters.json')) {
  return prepare(JSON.parse(fs.readFileSync(file, 'utf8')));
}
function poolFor(monsters) {
  if (monsters) return Array.isArray(monsters) && monsters.length && monsters[0].m ? monsters : prepare(monsters);
  return defaultPool || (defaultPool = loadMonsters());
}
/** The creature types and environments that actually exist in the data, for building the dialog. */
function options(monsters) {
  const pool = poolFor(monsters);
  const types = [...new Set(pool.map(a => a.m.type).filter(Boolean))].sort();
  const environments = ENV_GROUPS.filter(g => pool.some(a => a.anyEnv || a.envKeys.has(g.key))).map(g => ({ key: g.key, label: g.label }));
  return { types, environments, monsters: pool.length };
}

module.exports = { options, loadMonsters, prepare, crNumber, CR_XP, ENV_GROUPS };
