# Pixel Horde

A top-down pixel-art horde-survivor web game: the player survives timed stages while skills auto-fire, levelling up between waves. Played solo or in host-authoritative co-op.

## Language

### World and story

**World**:
A self-contained campaign with its own story, Realms, Kings, final boss and Endless Mode, sharing all core systems. Gold, Shop upgrades, Heroes and Titles are shared across Worlds; Weapons and leaderboards belong to one World, except one heirloom Weapon a player may carry into another World. Lumora is the first and currently only World.
_Avoid_: map, game, season

**Lumora**:
The first World.

**Heart of Lumora**:
The crystal that sustains the world. Its shattering drives monsters into hordes; XP crystals are its fragments.
_Avoid_: core, orb, crystal (alone)

**Umbra**:
The shadow born from the dark side of the Heart of Lumora, who shattered it; the final boss. Shadow Rivals are fragments of Umbra.

**Realm**:
A story region of Lumora ruled by a King who holds a large Heart shard. Each Realm has one Theme and is told as one Chapter.
_Avoid_: zone, world, land

**King**:
The boss who rules a Realm, corrupted by the Heart shard it holds.
_Avoid_: stage boss (use Boss for any boss-flagged enemy)

**Guardian**:
One of the three dragons (Inferno, Frost, Storm) torn from the Heart's original three-headed guardian. Found maddened during Blood Moon; defeating one turns it into a Companion.
_Avoid_: legendary beast, boss dragon

**Three-headed Dragon**:
The Heart's original guardian, restored by fusing all three Guardians defeated within the same Run. Nothing carries over between Runs. (Final name to be chosen.)
_Avoid_: hydra, fused pet

**Companion**:
A Guardian travelling with the Hero. One is active; the others wait in Companion storage (1 + 2 slots) and swap at stage end. Levels 1–5 within a Run (level-up card, Skill Points, or defeating the same Guardian again); its attacks leave Statuses and trigger Combos as the owner's own Skills.
_Avoid_: pet (code name), familiar

**Hero**:
A playable character with a personal name, class, and motive (Lyra the Mage, Bram the Knight, Kit the Ranger, Vex the Alchemist). The four travel as one team.
_Avoid_: character class, avatar

### Structure of play

**Run**:
One attempt from stage 1 until the player is defeated (or finishes the story). Everything earned inside a run except Gold is lost when it ends.
_Avoid_: game, session, match

**Stage**:
One timed survival segment inside a run, ending in a stage clear. Has a Theme, a boss at 55% of its timer, and may be a Special Event stage.
_Avoid_: level (reserved for player level), wave

**Chapter**:
One step of a Run's route: a single Stage in one Realm, opened by a story card and cleared only when that Realm's King dies. A Run has 8 Chapters: Greenvale first, Heart Crater last, and a choice of 1 of 2 Realms for each Chapter in between. Difficulty follows the Chapter number, not the Realm.
_Avoid_: act, world, episode, level

**Escape**:
When a Stage's timer and overtime run out with the King still alive: the King flees with its shard, the Chapter gives no King rewards, Umbra grows stronger, and the player picks another Realm for the same Chapter (once per Chapter).
_Avoid_: fail, timeout

**Endless Mode**:
Optional play after defeating Umbra: random Realms with ever-rising difficulty, ranked on its own leaderboard.
_Avoid_: survival mode, infinite mode

**Weapon**:
A permanent, unique collectible (one per Realm) chosen before a Run that changes only the form of the Ultimate — never the player's stats. Earned by defeating Umbra or, rarely, from that Realm's King. At any Stage end the player may switch between every usable Weapon (Judgement, the collection, and Weapons found this Run), back and forth. Each Weapon gives the Ultimate its own look, colour and name (e.g. Thornwhip → Bramble Field).
_Avoid_: item, gear, equipment

**Ultimate**:
The special attack fired from a gauge that charges mainly with time (about every 30–60 s); it clears ordinary mobs but is capped against bosses, ignores player damage bonuses, and its form and name depend on the Weapon (default: Judgement).
_Avoid_: ult, special, bomb

**Theme**:
The visual and enemy set of a Realm (tiles, three regular mobs, its King). Lumora has 11: grass, desert, cave, snow, crater, ember, swamp, sky, sea, gear and dusk (`THEME_VIS` in `apps/game/src/render/tiles.ts`).
_Avoid_: biome, map, zone

**Special Event**:
A rare stage modifier with run-only rewards: Blood Moon (never announced in advance), a Guardian inside Blood Moon, Shadow Rival, or a double-King stage.

### Player power

**Skill**:
An auto-firing attack the player holds in one of 4 attack slots (one locked to the Signature Skill; Awakening can add a 5th), levelled on level-up.
_Avoid_: weapon, spell

**Passive**:
A stat upgrade picked on level-up, never fires on its own.

**Evolution**:
The upgraded form a Skill takes when it is max level and its paired Passive is owned.

**Signature Skill**:
A Skill that belongs to one character only, occupies a locked attack slot, and can Evolve and later Awaken. Other characters can never obtain it.
_Avoid_: starting skill, unique skill, ultimate

**Skill Line**:
The group of shared Skills that count as Links for one character's Signature Skill, and the set of new Skills that character unlocks after Awakening. Every character may still pick any shared Skill. Players see the unlocked Skills as **Awakened skills** (Thai สกิลตื่นพลัง); the code keeps `SKILL_LINES` / `isLine`.
_Avoid_: tree, class, branch

**Link**:
A shared Skill from the character's own Skill Line, at max level and equipped in an attack slot, that counts toward Awakening.
_Avoid_: synergy, bond

**Awakening**:
The optional, one-time transformation of an evolved Signature Skill that makes the Signature much stronger and unlocks the character's Skill Line skills (the first may arrive at once, `awaken.grant`). Under the original rule it consumes two Links; with `awaken.keep` the Links stay and `awaken.slots` adds attack slots instead (the live config does this). Declining it forfeits it for the rest of the Run.
_Avoid_: ultimate evolution, second evolution, ascension

**Combo**:
The automatic reaction when a Skill hits an enemy carrying a Status left by a different element (e.g. Shatter = Frozen + heavy hit).
_Avoid_: synergy, chain (Chain Lightning is a Skill)

**Kill Streak**:
The count of kills made in quick succession (each within ~2 s of the last), shown as "×50 KO!". Named `combo` in the original code; renamed so it never collides with Combo.
_Avoid_: combo (reserved for elemental reactions)

**Status**:
A temporary effect a Skill leaves on an enemy (Frozen, Gathered, Burning, Shocked, Poisoned) that Combos consume.
_Avoid_: debuff, element

**Bench**:
The storage slots holding Skills (and, once the passive slots are full, Passives) that are owned but not firing (1 slot, +1 after clearing Chapters 2 and 4); they move between Bench and attack / passive slots only at stage end, for Gold (20 × Chapter, doubling for each further swap at the same Stage end), and do not level up while benched. Removing a Skill from the Bench at a Stage end is free.
_Avoid_: inventory, reserve, stash

**Skill Point**:
A King reward (1 per King; not sold for Gold unless the Admin switch `economy.spShop` is on) spent during a Run: 1 to reroll level-up choices, 1 to banish a Skill from the Run, 2 to raise a chosen Skill one level.
_Avoid_: points (ambiguous with score)

**Meta Progression**:
Permanent power bought with Gold between runs (Shop upgrades, character unlocks).
_Avoid_: upgrades (ambiguous with level-up picks)

**Gold**:
The only currency that survives a run; banked on stage clear or defeat. Also spent inside a Run (Bench swaps, a purchased revive), competing with permanent Shop upgrades.
_Avoid_: coins, money

**Director**:
The hidden difficulty controller that raises or lowers spawn pressure (and a little monster HP) based on how comfortably the player is surviving. `director.stageReset` can ease it back toward its start value at each new Stage.

**Wave Front**:
The side most monsters come from at a given moment (`spawn.frontShare`); it moves to another side every few seconds, optionally after a short lull. A **Pincer** swarm comes as two arcs from the front's sides instead of a full ring (`spawn.pincer`; Blood Moon keeps the ring). Both are off by default.
_Avoid_: wave (a Stage is not a wave), direction

### Live operations

**Balance Config**:
The versioned set of every tunable gameplay number, edited in the Admin Console. A run locks to the version current when each stage starts; every score records the version it was played on.
_Avoid_: settings, remote config, tuning

**Balance Pass**:
A recommended set of Balance Config changes measured with the playtest bot (`packages/config/src/balance-pass.ts`), carrying a Thai Balance Report for the owner and player-facing Patch Notes. Loaded into a draft in the Admin Console (several can stack on one draft) and published as a new version; never changes the built-in defaults.

**Patch Notes**:
The player-facing changelog entries (balance / feature / fix / content / system), written in Admin → อัปเดตเกม or automatically on each config publish, shown on the website Updates page and as the title screen's "New update!" notice.
_Avoid_: release notes, news

**Base Difficulty**:
The Balance Config's own multipliers on its numbers (`shared.difficulty`), the same for every player and every Run. It replaced the six solo Difficulty Presets (removed 2026-09-27; its defaults are the full old Relaxed preset, with Gold ×0.2 so a Run pays about what old Balanced did). Players who want it harder pick a Heart Crack tier.
_Avoid_: difficulty preset, difficulty level, mode (Endless Mode is a mode)

**Heart Crack**:
Difficulty tiers 1–3 picked before a new Run, unlocked by beating Umbra (winning at tier N opens N+1): monsters get more HP, damage and spawns from Chapter 1. Unlike Endless Mode it is a whole Run at a fixed higher difficulty.
_Avoid_: hard mode, New Game+

**Season**:
A leaderboard period opened manually by the admin (typically after a big Balance Config change). Solo and co-op are ranked separately inside a season; an all-time board is kept for display only.
_Avoid_: ladder, league

**Score**:
The arcade-style number a Run earns, computed only by the sim: progress (Chapters cleared, Kings killed, victory, fast finish) dominates, kills and Combos separate equal progress, Escapes subtract, and a purchased revive cuts it by 15%.
_Avoid_: points, rank (rank is a position on a board)

**Title**:
A cosmetic name tag shown under a player's nickname, earned from Season rank or an achievement; one is shown at a time. Titles, badges and Season palettes never give power.
_Avoid_: rank, badge (a badge is a separate collectible)

**Admin Console**:
The web back-office where the admin edits Balance Config, reads play statistics and Feedback, writes Patch Notes, follows Work Items, and moderates leaderboards.
_Avoid_: dashboard, backend, CMS

**Feedback**:
A message a player sends from the in-game Feedback button (Bug, Balance, Idea or Other), read in the Admin Console.
_Avoid_: report, ticket

**Work Item**:
A task the daily triage routine files for the owner from live errors and Feedback (`public.work_items`, written only via `agent_report`), shown in Admin → งานแก้ไข; clear bugs become pull requests instead.
_Avoid_: issue, ticket (tickets are the markdown files under `.scratch/`)

### People and co-op

**Player Account**:
The identity that owns Meta Progression and scores. Starts anonymous behind a nickname; can later be linked to a Google login to move between devices. Only one place plays at a time: the most recent login wins and older tabs or devices are stopped.
_Avoid_: user, profile

**Host / Guest**:
In co-op, the Host simulates the world and is authoritative; Guests run their own skills and report damage to the Host.
