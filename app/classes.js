/* Dragonwatch — what each class brings to the tracker.
   One place for the rules the app automates: hit die, spellcasting type, and which class resources unlock at which level.
   `scales` lists subclass resources that follow this class's level but are not added automatically. `res` maps a resource name (as in RES_PRESETS in app.js, which holds its recharge and per-level maximum) to the class level it unlocks at.
   Class names the table does not know (homebrew) simply get no automation. */
const CLASSES = {
  Artificer: { die: 8,  cast: 'halfup', res: { 'Flash of Genius': 7 } },
  Barbarian: { die: 12, cast: '',       res: { 'Rage': 1 } },
  Bard:      { die: 8,  cast: 'full',   res: { 'Bardic Inspiration': 1, 'Superior Inspiration': 18 } },
  Cleric:    { die: 8,  cast: 'full',   res: { 'Channel Divinity': 2, 'Divine Intervention': 10 } },
  Druid:     { die: 8,  cast: 'full',   res: { 'Wild Shape': 2 } },
  Fighter:   { die: 10, cast: '',       res: { 'Second Wind': 1, 'Action Surge': 2, 'Indomitable': 9 }, scales: ['Superiority Dice'] },
  Monk:      { die: 8,  cast: '',       res: { 'Focus Points': 2, 'Uncanny Metabolism': 2 } },
  Paladin:   { die: 10, cast: 'half',   res: { 'Lay on Hands': 1, 'Divine Sense': 1, 'Channel Divinity': 3, 'Cleansing Touch': 14 } },
  Ranger:    { die: 10, cast: 'half',   res: { 'Favored Foe': 1 } },
  Rogue:     { die: 8,  cast: '',       res: { 'Stroke of Luck': 20 } },
  Sorcerer:  { die: 6,  cast: 'full',   res: { 'Innate Sorcery': 1, 'Sorcery Points': 2 } },
  Warlock:   { die: 8,  cast: 'pact',   res: {} },
  Wizard:    { die: 6,  cast: 'full',   res: { 'Arcane Recovery': 1 } },
};
/** Subclasses people type in as a class: they follow their parent's hit die but cast as a third caster. */
const CLASS_ALIASES = [[/eldritch knight/i, { die: 10, cast: 'third', res: {} }], [/arcane trickster/i, { die: 8, cast: 'third', res: {} }]];
/** What the table knows about a class name ("Wizard", "wizard (evoker)"…), or null for something it doesn't recognise. */
function classInfo(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const alias = CLASS_ALIASES.find(([re]) => re.test(n));
  if (alias) return alias[1];
  const key = Object.keys(CLASSES).find(k => n === k.toLowerCase()) || Object.keys(CLASSES).find(k => n.includes(k.toLowerCase()));
  return key ? Object.assign({ key }, CLASSES[key]) : null;
}
