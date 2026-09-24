# Pixel Horde

A top-down pixel-art horde-survivor web game: the player survives timed stages while skills auto-fire, levelling up between waves. Played solo or in host-authoritative co-op.

## Language

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
The visual and enemy set of a stage (tiles, three regular mobs, one boss). Currently grass, desert, cave, snow.
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

**Meta Progression**:
Permanent power bought with Gold between runs (Shop upgrades, character unlocks).
_Avoid_: upgrades (ambiguous with level-up picks)

**Gold**:
The only currency that survives a run; banked on stage clear or defeat.
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
