# 29: Heart Crater, Umbra, ending, Endless and Heart Crack 1–3

**What to build:** Chapter 8 is the Heart Crater: Umbra fights in three phases (shadow Hero skills; the ultimates of escaped Kings, or weakened ones of defeated Kings; darkened heart) with HP +15% per Escape. Victory records the main Score, grants a new Weapon (or 500 Gold), plays the ending, and offers Endless (same Run, random Realms, rising difficulty, own board). Winning unlocks Heart Crack tiers 1–3.

**Blocked by:** 20 (King framework: phases, ultimates, dialogue, boss arrows); 27 (Ultimate rebalance and the Weapon system)

**Status:** done (awaiting owner playtest; Umbra drawn at 40×40 — art review)

- [x] Death in Endless ends the Run normally; main Score is unaffected
- [x] Heart Crack tiers are Stage modifiers from Balance Config
- [x] Sim tests: Umbra phase transitions, Escape effects, Endless scoring separation

## Notes (implementation)

- Umbra (`kings.ts`): phase 1 shadow skills (fans of shadow bolts, shadow meteor rain); phase 2 below `umbra.phase2` (66%) adds stolen ultimates — those of the Kings that escaped, else weakened ones of the others; phase 3 below `umbra.phase3` (33%) is the darkened heart: `darkness` (screen dark except a light around the player), ultimates × `ultCdMul3` faster, new line `king.umbra.heart`. HP +15% per Escape. Umbra never escapes.
- Victory: the main Score is frozen (`s.main`) when the Stage ends, a missing Weapon (or 500 Gold) is granted, phase `victory` shows the ending text and offers Endless (`{type:'endless', go}`).
- Endless: same Run and everything in it; random available Realms each Chapter, no events, extra × `endless.hpGrowth`/`dmgGrowth` per Chapter beyond 8. Its own Score (`endlessBreakdown`: Chapters/Kings beyond 8, kills and Combos since Umbra, Escapes, a revive bought in Endless cuts only this Score). Death ends the Run; `submit_run` stores `endless_score` and the Run lands on both the Season board (main) and the Endless board.
- Heart Crack 1–3: Balance Config `heartCrack.hpN/dmgN/spawnN`; beating Umbra on tier n unlocks n+1 (server `meta_progress.stats.heartCrack`, local cache); title screen picker once unlocked; `runs.crack` recorded.
- Tests: `tests/endgame.test.ts`, DB tests (Endless board).

### For the owner
- Heart Crack Runs currently share the normal leaderboards (the tier is stored per Run). Separate boards per tier can be added if wanted.
- Ending text is a short first draft (`ending.*` in i18n).

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
