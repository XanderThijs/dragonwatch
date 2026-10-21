# Dragonwatch — D&D Combat Tracker

Combat tracker + campaign/party manager for Dungeons & Dragons 5e. A tiny Node server (no npm dependencies)
serves the site and stores campaigns, characters and fights in a SQLite database. Everything it needs is in this
repository: clone it, run one command, and it works (see **Run it**).

## Run it

Dragonwatch is self-contained: the server, the app, the monster data and the Encounter lab model for the win chance are all in this folder. You only need Docker, or Node.js 22 or newer.

```bash
docker compose up --build -d
```

Open http://localhost:8080. The first time, you create the **admin account** (username + password of at least 10 characters).
Everything you save (campaigns, characters, bestiary, saved encounters, the running fight) belongs to your account only.

Without Docker:

```bash
node server.js          # http://localhost:3000, data in ./data
```

Optional environment variables (see `docker-compose.yml`): `ALLOW_SIGNUP=1` lets others create their own accounts,
`TRUST_PROXY=1` when behind a reverse proxy, `COOKIE_SECURE=1` when served over HTTPS, `PORT` and `DATA_DIR`.

Stop with `docker compose down`. Your data is kept in the `dragonwatch-data` volume;
adding `-v` deletes it. To use another port, change `8080` in the compose file.

### Behind a reverse proxy (optional)

To serve Dragonwatch under a path such as `https://example.com/dragonwatch/` or on a domain with HTTPS, put any reverse proxy
(Caddy, nginx, Traefik…) in front and set these in `docker-compose.yml`:

```yaml
    environment:
      BASE_PATH: "/dragonwatch/"   # the path the proxy serves it under ("/" when there is none)
      TRUST_PROXY: "1"             # the proxy sets X-Forwarded-For / X-Forwarded-Proto
      COOKIE_SECURE: "1"           # when served over HTTPS
```

The proxy should strip the path prefix before passing requests on (Caddy: `handle_path /dragonwatch/* { reverse_proxy dragonwatch:3000 }`).
The app itself works under any prefix.

### Accounts & safety
- Passwords are hashed (scrypt); sessions use an HttpOnly cookie; sign-in is rate limited and locks after repeated failures.
- Deleted things go to a **recycle bin** for 30 days (account menu → Recycle bin). An **activity log** records sign-ins and changes.
- A snapshot of the database is made daily (last 14 kept in `backups/`). Admins can download the whole database; everyone can export/import their own data as JSON.
- Admins add, remove and reset users in the account menu → Accounts. New and reset accounts must choose their own password at first sign-in.
- The container runs read-only with no extra privileges.

### Backups
The database is a single file (`dragonwatch.db`) in the volume. To keep it in a normal folder instead,
replace the volume line in the compose file with `- ./data:/data`.

## Look & feel

Styled as a Dungeon Master's table: parchment sheets with gilded corners on dark wood, a leather-and-gold
header, a wax-seal round counter and d20 initiative medallions. Conditions are colour-coded text labels;
HP, temp HP, AC and passive perception use small hand-drawn heraldic emblems (blood-red heart, ward-drop, gilded shield, watchful eye) instead of emoji.

Fonts (Cinzel and EB Garamond, SIL Open Font License) are bundled in `app/fonts`, so the app works fully offline.

## Campaigns & party (far-left panel)

- Create multiple campaigns; each holds its own player characters
  (name, player, class, level, max HP, AC, initiative modifier, passive perception, notes).
- The panel always shows the party at a glance: heroes, average level, total HP, average AC.
- **Drag a character into the combat area** (or press ➜, or "Add Whole Party to Combat").
  Initiative is rolled automatically (d20 + modifier) — type the player's real roll over it if they rolled themselves.
- A character already in combat is marked "in combat" and can't be added twice.
- **Turn reminder.** When a turn begins (Next turn, or the play button on a card) and that creature has conditions or timed effects, a pop-up lists them with their rules text and remaining rounds. Press *Read* (or Enter) to continue.
- **Death saves.** When a downed hero's turn begins, a pop-up asks for the result: success, failure, natural 20 (back up at 1 HP) or natural 1 (two failures). The *Dying* condition is now called *Downed*.
- **Concentration checks.** Damage to a concentrating creature opens a pop-up with the Constitution save DC (10 or half the damage, max 30): passed keeps it, failed ends it. Several hits in one action are combined into one check.
- **Party win chance.** A chip above the combat list shows the live chance that the party wins, re-simulated after every change from each hero's current HP, unspent spell slots and class features (Action Surge, Second Wind, Lay on Hands, Rage), with downed heroes kept in because a healer can bring them back up. Click it for the round-by-round trend and a *Counted for each hero* list that shows exactly what the simulation was told. It uses the Encounter lab engine; monsters without attack data use a stand-in of similar hit points.
- **Combat numbers.** In the character form, the optional *Attack bonus*, *Attacks/round* and *Damage per hit* boxes replace the class table's estimates for that character (leave a box empty to use the table).
- **Type-to-search boxes.** The damage type on each card and the class names in the character and level-up dialogs filter as you type and show only entries that contain those letters. The damage type goes back to the default after every hit. Custom (homebrew) class names still work.
- **Summon dialog.** The Summon Combatant panel now only asks for name, type, count and initiative modifier. Pressing *Join the fray* opens a dialog with one row per creature (monster, NPC or player): marker, initiative, AC, max HP and temp HP. A blank initiative rolls d20 + modifier; *Auto colours* fills in Lego colours. Presets from the Bestiary and Favourites prefill the rows.
- **Reaction tracker.** A small *Ready / Used* pill under each creature's initiative number. Click it when the creature uses its reaction (this is logged); it resets by itself when that creature's turn starts.
- **Markers.** The Summon panel has a *Marker* box so identical monsters can be told apart on the mat (for example a Lego minifigure with a red hat). With several copies, type one marker per copy separated by commas, or press *Auto colours*. Each card shows its marker as a small pill (a colour word like red or blue adds a matching dot) that you can edit at any time.
- **Class table.** `app/classes.js` holds what the app automates per class: hit die, spellcasting type and which class resources unlock at which level. The character form's *Add class resources* button adds Hit Dice, unlocked features and spell slots in one click, and a level up adds anything the new level (or a new class) unlocks. Unknown/homebrew class names simply get no automation.
- **Multiclassing.** A character can have several classes, each with its own level (character form: *Add another class*); total level is the sum. *Level up party* lets you pick which class advances, or start a new one, with HP pre-filled from that class's hit die. Hit Dice become one pool per die size, class features (Rage, Action Surge…) scale with the level in their own class, and spell slots follow the 5e multiclass rules (casting classes add up into one caster level, Pact Magic stays separate). The Encounter lab uses the class with the most levels to pick a role.
- **Level up party:** the button on the roster raises everyone one level in one go, with a per-character HP gain (pre-filled with the average hit die) and optional rescaling of spell slots and class resources.
- **Temp HP is saved too.** Each character has a Temp HP field, so it survives between sessions; a long rest clears it.
- **HP stays in sync.** Damage, healing, temp HP, conditions and AC changes show on the party card
  instantly, and every HP change is saved to the database, so the party panel (and the next session)
  always shows each character's real current HP. Characters join a fight at their current HP.
- **Class resources** — spell slots (full / half caster tables or Warlock pact slots, filled for the character's level), focus/ki points,
  rage, sorcery points, bardic inspiration, channel divinity, action surge, superiority dice, lay on hands and custom counters.
  Set them in the character form; each resource recharges on a short rest, a long rest, or manually.
  They show as clickable pips on the roster and on the PC's combat card (click a pip to spend it, click an empty one to restore).
  Saved in the database.
  More presets cover most class features plus Hit Dice (a long rest returns half), Heroic Inspiration, Lucky, Breath Weapon and item charges;
  "Fill spell slots" also adds a Warlock's Mystic Arcanum. Every spend or recovery is written to the Battle Chronicle.
- **Short Rest** recharges short-rest resources for the whole party.
- **☀ Long Rest** restores the whole party to full HP and recharges every resource (also in the running fight).
- Edit a character to change any stat, including current HP; changes are applied to their combat entry too.

## Player view

Click **Player view** in the top bar for your private link (`/player.html?room=…`; the code is unique to your account and can be replaced in the account menu) to put on a TV or phone. It shows only who is in the fight, their initiative, their conditions and whose turn it is — no health, resources, AC or notes (those are never sent to it).
The eye button on a card keeps that combatant off the player view.
Type this computer's local IPv4 address (from `ipconfig`) into the window and it shows a QR code for the players to scan; allow the port through the firewall.
The QR code generator (`app/qrcode.js`, MIT licence, Kazuhiko Arase) is bundled, so it works offline.
The player page is read-only and only shows your table to people holding your link; the DM page requires signing in.

## Combat tracker


- Initiative order with round counter, next/previous turn, auto-sort, roll-all, drag the ⠿ handle to reorder
- Tie-breaks: choose *Highest modifier*, *Players first* or *Manual* above the list, or roll off tied initiatives (d20 + modifier)
- HP, max HP, temp HP (absorbs damage first), AC, init modifier — all editable inline
- Damage / Heal / Temp buttons (Enter = damage, Shift+Enter = heal)
- Death saves for PCs, stabilize, auto-dead for monsters
- 55+ conditions: all 5e core conditions (with Exhaustion levels), weapon-mastery effects
  (Vexed, Sapped, Slowed…), spell effects and statuses, with optional durations that tick down
- Monster abilities: the **+ Ability** button on monsters and NPCs adds Legendary Resistance, Legendary Actions (refresh at the start of the creature's turn),
  recharge powers (spent ones are rolled for automatically at the start of the creature's turn) and limited-use counters. Adult Dragon, Young Dragon, Vampire and Lich come with theirs.
- **Area effects:** one window to damage, heal or give temp HP to several creatures at once (pick the effect at the top). Enter a number or dice (`8d6`), tick the targets (or Monsters / Party / All), mark who saved, and choose whether saves take half or none. For damage: enter a number or dice (`8d6`), tick the targets (or Monsters / Party / All), mark who saved, and choose whether saves take half or none. Temp HP always replaces what a creature already has.
- **Surprise round:** the *Surprise round* button opens a menu that marks all monsters or the party as Surprised. A surprised creature loses its first turn automatically.
- **Import encounter:** paste text or JSON, or load a `.txt`/`.json` file. One creature per line, e.g.
  `4x Goblin | hp 7 | ac 15 | init +2`, optionally `| roll 14` (fixed initiative instead of rolling) `| lr 3 | la 3 | recharge Fire Breath 5 | uses Spellcasting 3 | type npc | note …`. A live preview shows what will be added and flags problems before anything is added.
- **Resistances, immunities & vulnerabilities:** the **+ Defences** button on a card sets each damage type to Resistant (half), Immune (none) or Vulnerable (double). Physical types can be marked *nonmagical only*. Pick the damage type next to the Damage button (or in Area effects) and the tracker applies the defences and notes it in the log. Defences show as coloured chips on the card. Monsters from the search come with theirs; in imports use `| resist fire, cold | immune poison | vuln radiant` (add `(nonmagical)` for physical types). **Raging** barbarians automatically take half damage from bludgeoning, piercing and slashing (magical too), as long as a damage type is picked.
- **Bestiary search:** look up monsters (Open5e: SRD and open content) and load one into the summon form with its HP, AC, initiative modifier, Legendary Resistance / Legendary Actions / recharge powers and damage defences. Needs internet in the browser.
- **Favorited monsters:** press the ★ on a monster card or on a search result to keep it in the **Favorited** panel (stored in the database, so every device sees it). Click a favourite to load it into the summon form, ✕ removes it. Saving an edited monster again updates the saved version.
- Concentration tracking, combat log, undo (Ctrl+Z)
- The current encounter is saved in your browser; campaigns and characters (with current HP) are saved in the database

Shortcuts: `N` next turn, `P` previous turn, `Ctrl+Z` undo, `Esc` close dialogs.

## Local development (without Docker)

Needs Node 22.5+ and nothing else (no `npm install`):

```bash
npm start                        # same as: node --no-warnings server.js
```

Then open http://localhost:3000. Data is stored in `./data` (set `DATA_DIR` to change it).

## Timed effects

Use **+ Effect** on a card for spells and effects that last a set time (Bless, Haste, Hold Person…). Pick a quick preset or type your own, choose rounds or minutes (10 rounds each), and whether it counts down every round or at the end of the creature's own turn. The chip shows the rounds left (click the number to add a round), pulses at the last round, and the chronicle and a toast tell you when it ends. Effects can be hidden from the player view.

## Saved encounters

Set up a fight, then **Save current encounter** (left column). Only monsters and NPCs are saved, grouped with a count, at full health; add the party with "Add whole party to combat". Encounters belong to the active campaign unless you tick "Available in every campaign". Click one to load it (add to the current fight or replace it); creatures are numbered automatically and roll fresh initiative. Stored on the server (`encounters` table), so every device sees them.

## Generate with Encounter lab (optional)
The tracker's encounter generator is **Generate with Encounter lab** (it replaced the older XP-budget generator). It loads the Encounter lab's engine and trained model from the `app/encounter/` folder that ships with Dragonwatch (copies of the Encounter lab's `web/engine.js`, `web/model.json` and `web/monsters.json`; to update the model, train a new one there and copy those three files over), takes the party from the selected campaign, and builds fights from a monster pool that land on the win chance you choose. Each result is checked by a live simulation, and "Add to combat" puts the monsters in the tracker with initiative rolled (Undo takes it back).
- **Pool:** SRD monsters (filter by CR, creature type, environment or pick specific ones) and your favorited monsters.
- **Attack numbers for favorites:** the model needs attacks per round, to-hit and damage per hit, plus a CR, for each monster. Press the swords button on a favorite to enter them; favorites saved from the Bestiary search get them filled in automatically where the stat block allows. They are stored with the favorite (and included in backups and saved encounters). Favorites without them are simply left out of the pool.
- **Party:** class, level, max and current HP, AC, initiative, spell slots and class features come from the characters (so a hurt or spent party is generated against as it is); attacks and damage come from the class table unless you typed *Combat numbers* on the character. The class can be changed per character in the dialog to try a different build.
- If the files in `app/encounter/` are missing, the dialog says so and everything else keeps working.

## Project layout

| Path | What it is |
|---|---|
| `server.js` | The whole backend: static files, REST API, accounts, SQLite (`node:sqlite`) |
| `app/` | The browser app (plain HTML, CSS and JavaScript, no build step) and the bundled fonts |
| `app/encounter/` | The Encounter lab engine and trained model used for the live win chance and the encounter generator |
| `encounter.js`, `monsters.json` | SRD monster data for the generator (environments, creature lists) |
| `tools/build-monsters.py` | Rebuilds `monsters.json` from the Open5e data |
| `Dockerfile`, `docker-compose.yml` | One-command Docker setup |

## Credits and licences

- **Monster data** (`monsters.json`) comes from the 5e System Reference Document 5.1 by Wizards of the Coast, available under the Creative Commons Attribution 4.0 licence (CC-BY-4.0), via the Open5e project and 5e-bits/5e-database. This work includes material taken from the SRD 5.1, which is © Wizards of the Coast LLC.
- **Bestiary search** queries the public Open5e API (api.open5e.com), which also serves third-party open content under its own licences. Nothing from it is stored in this repository.
- **Fonts:** Cinzel and EB Garamond, SIL Open Font License 1.1, bundled in `app/fonts`.
- Dragonwatch is an unofficial fan tool and is not affiliated with or endorsed by Wizards of the Coast.
