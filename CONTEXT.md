# Pixel Horde

A top-down pixel-art horde-survivor web game: the player survives timed stages while skills auto-fire, levelling up between waves. Played solo or in host-authoritative co-op.

## Language

### World and story

**Lumora**:
The game world.

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
A Guardian travelling with the Hero. One is active; the others wait in Companion storage (1 + 2 slots) and swap at stage end.
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
A story unit made of consecutive stages sharing one Theme, closed by that theme's boss and a short story beat. The survivor core is unchanged; chapters are how the story is told.
_Avoid_: act, world, episode

**Theme**:
The visual and enemy set of a Realm (tiles, three regular mobs, its King). Currently grass, desert, cave, snow.
_Avoid_: biome, map, zone

**Special Event**:
A rare stage modifier with run-only rewards: Blood Moon, Inferno Dragon, Shadow Rival.

### Player power

**Skill**:
An auto-firing attack the player holds (max 6 slots), levelled on level-up.
_Avoid_: weapon, spell

**Passive**:
A stat upgrade picked on level-up, never fires on its own.

**Evolution**:
The upgraded form a Skill takes when it is max level and its paired Passive is owned.

**Signature Skill**:
A Skill that belongs to one character only, occupies a locked attack slot, and can Evolve and later Awaken. Other characters can never obtain it.
_Avoid_: starting skill, unique skill, ultimate

**Skill Line**:
The group of shared Skills that count as Links for one character's Signature Skill, and the set of new Skills that character unlocks after Awakening. Every character may still pick any shared Skill.
_Avoid_: tree, class, branch

**Link**:
A shared Skill from the character's own Skill Line, at max level and equipped in an attack slot, that counts toward Awakening.
_Avoid_: synergy, bond

**Awakening**:
The optional, one-time transformation of an evolved Signature Skill that consumes its Links and unlocks the character's Skill Line skills. Declining it forfeits it for the rest of the Run.
_Avoid_: ultimate evolution, second evolution, ascension

**Combo**:
The automatic reaction when a Skill hits an enemy carrying a Status left by a different element (e.g. Shatter = Frozen + heavy hit).
_Avoid_: synergy, chain (Chain Lightning is a Skill)

**Status**:
A temporary effect a Skill leaves on an enemy (Frozen, Gathered, Burning, Shocked, Poisoned) that Combos consume.
_Avoid_: debuff, element

**Bench**:
The storage slots holding Skills that are owned but not firing; Skills move between Bench and attack slots only at stage end, for Gold.
_Avoid_: inventory, reserve, stash

**Skill Point**:
A boss reward spent on Skills during a Run (exact use to be decided).
_Avoid_: points (ambiguous with score)

**Meta Progression**:
Permanent power bought with Gold between runs (Shop upgrades, character unlocks).
_Avoid_: upgrades (ambiguous with level-up picks)

**Gold**:
The only currency that survives a run; banked on stage clear or defeat. Also spent inside a Run (Bench swaps, a purchased revive), competing with permanent Shop upgrades.
_Avoid_: coins, money

**Director**:
The hidden difficulty controller that raises or lowers spawn pressure based on how comfortably the player is surviving.

### Live operations

**Balance Config**:
The versioned set of every tunable gameplay number, edited in the Admin Console. A run locks to the version current when each stage starts; every score records the version it was played on.
_Avoid_: settings, remote config, tuning

**Season**:
A leaderboard period opened manually by the admin (typically after a big Balance Config change). Solo and co-op are ranked separately inside a season; an all-time board is kept for display only.
_Avoid_: ladder, league

**Admin Console**:
The web back-office where the admin edits Balance Config, reads play statistics, and moderates leaderboards.
_Avoid_: dashboard, backend, CMS

### People and co-op

**Player Account**:
The identity that owns Meta Progression and scores. Starts anonymous behind a nickname; can later be linked to a Google login to move between devices.
_Avoid_: user, profile

**Host / Guest**:
In co-op, the Host simulates the world and is authoritative; Guests run their own skills and report damage to the Host.
