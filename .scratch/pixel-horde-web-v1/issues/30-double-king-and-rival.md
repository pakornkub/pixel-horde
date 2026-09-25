# 30: Double-King Stages and Shadow Rival as Umbra's fragment

**What to build:** In Chapters 4–7 a 10% unannounced modifier brings the King of the Realm the player skipped alongside the current King (×0.7 HP each, both rewards). Shadow Rival keeps its mechanics and gets Umbra-fragment dialogue.

**Blocked by:** 20 (King framework: phases, ultimates, dialogue, boss arrows)

**Status:** done (awaiting owner playtest)

- [x] Both Kings get arrows and HP bars
- [x] Sim tests for spawn rules and double rewards

## Notes (implementation)

- The route choice not taken is remembered (`skipped`). In Chapters 4–7 a double-King roll (`events.doubleKingChance` 10%, on the route RNG stream, never announced) brings that Realm's King alongside the current one; both at `events.doubleKingHp` (70%) of the Chapter's King HP.
- Both Kings: HP bars, off-screen arrows, dialogue, enrage in overtime; the Stage clears only when both are dead; each gives the full King reward (Gold, Skill Point, chest, 5% Weapon of its own Realm) and counts for the Score; both escape separately (two Escapes, both Realms strengthen Umbra).
- Shadow Rival speaks as Umbra's fragment on arrival, defeat and escape (`king.rival.*`).
- Tests: `tests/doubleking.test.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
