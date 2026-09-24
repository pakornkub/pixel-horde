# 20: King framework: phases, ultimates, dialogue, boss arrows

**What to build:** Kings fight in two phases (two telegraphed moves, plus an ultimate below 50% HP with a longer warning), speak at arrival/50%/defeat/Escape in non-blocking bubbles, and are always findable: off-screen arrows with the boss icon, a direction in the spawn banner, and an HP bar. The four existing Realm Kings get their designed moves.

**Blocked by:** 19 (8-Chapter Run, route choice, King-must-die, Escape and the new Score)

**Status:** done (awaiting owner playtest)

- [x] Arrows appear for Kings, Guardians, Shadow Rival and Umbra when off-screen; not disableable in Settings
- [x] King Slime, Sand King, Bone King, Frost King implement their wayfinder #21 move sets with the hazard system
- [x] Dialogue lines come from i18n
- [x] Sim tests: phase change at 50%, ultimate availability, overtime enrage

## Notes (implementation)

- `packages/sim/src/systems/kings.ts`: King kits (2 moves + ultimate), phase 2 below `kings.phaseAt`, ultimate cooldown ×`overtimeUltMul` and allowed in phase 1 during overtime, dialogue events (`say`), spawn direction for the banner.
- New hazard kinds: `beam` (Sand King line), `pull` (Quicksand Vault), `ice` (slippery floor, player keeps momentum), `safe` (Absolute Throne: only the safe circles are spared, then a chill). `circ` hazards can spawn an enemy instead of hurting (split slimes, raised skeletons).
- Moves: King Slime slam / split / Royal Splash; Sand King sandstorm line / burrow / Quicksand Vault (+ fake coin blasts); Bone King bone fan / raise skeletons / Lonely Crypt (pillar ring with one gap, then a centre blast); Frost King three ice spears / ice floor / Absolute Throne.
- Umbra (placeholder until ticket 29) uses the ultimates of Kings that escaped, or weaker ones of the others.
- While leaping or burrowed a King cannot be hit and deals no contact damage.
- Game: off-screen arrows with the boss icon (King, dragon, Shadow Rival; blink for 2 s after a spawn, bigger when near), dialogue bubbles (i18n `king.<enemy>.<beat>`), "from the right" in the King banner. Arrows have no Settings switch.
- Every number is in Balance Config `kings.*`. Tests: `tests/kings.test.ts`. Golden replays regenerated (Kings now attack).

### For the owner
- Dialogue lines are first drafts in Thai and English; edit freely in `packages/i18n/src/th.json` / `en.json` (`king.*`).

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
