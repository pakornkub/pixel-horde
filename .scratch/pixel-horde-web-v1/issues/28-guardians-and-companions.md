# 28: Guardians, Companions and the Three-headed Dragon

**What to build:** Frost and Storm Dragons join Inferno as Blood Moon Guardians favoured by Realm element. Defeated Guardians become Companions (1 active + 2 stored, swap at Stage end) that level 1–5 (level-up card, 2 Skill Points, or defeating the same Guardian again), unlock a second move at 3 and grow at 5, and apply Statuses/Combos as the owner's Skills. After the first Guardian, missing ones become likelier. Defeating all three in one Run offers fusion into the Three-headed Dragon at Stage end.

**Blocked by:** 22 (Statuses, Combos, Realm traits and resistances); 26 (Skill Points, King rewards, Gold-for-Skill-Points and the bought revive)

**Status:** done (awaiting owner playtest)

- [x] Frost Dragon blizzard freezes a player who stops moving; Storm Dragon moves per wayfinder #21
- [x] Old "+100 Gold per dragon" reward removed
- [x] Fusion level = average of the three rounded up, minimum 3; Tri-Breath included
- [x] Sim tests: pity after first Guardian, levelling paths, fusion prompt conditions

## Notes (implementation)

- `packages/sim/src/systems/guardians.ts`. Blood Moon Guardian = the Realm element's dragon (fire → Inferno, ice → Frost, lightning → Storm), else a random one (missing ones first once you have one). After the first Guardian, a Realm matching a missing Guardian gets Blood Moon × `guardians.pityBloodMoon` and Guardian chance ≥ `pityDragon` (60%).
- Frost Dragon: ice breath (chills the player), ice pillar ring, blizzard (`bliz` hazard: standing still for 0.9 s freezes you — hurt + chill; a ring shows the timer). Storm Dragon: parallel lightning rows (`beam`), bouncing orbs (`proj` with `bounce`), telegraphed dash.
- Companions: 1 active + 2 stored (swap on the clear screen). Level 1–5 via the level-up card ("Companion grows stronger"), 2 Skill Points, or beating the same Guardian again (+2). Level 3 unlocks the second move (Inferno dive bomb, Frost ice wall, Storm chain lightning); level 5 is the grown form (main move ×1.5, bigger sprite). Their hits carry the owner's tags: Inferno Burning, Frost freezes by stacks, Storm Shocked — Combos work with the owner's Skills.
- The old "+100 Gold per dragon" is gone.
- All three Guardians beaten in one Run → clear screen offers fusion; the Three-headed Dragon starts at max(3, ceil(average level)), uses Tri-Breath (lightning → fire → ice, so Overload fires by itself) and all three second moves.
- Debug: `?debug=frostdragon` / `stormdragon`. Tests: `tests/guardians.test.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
