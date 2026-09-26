# 46: Wave fronts — monsters come from one side at a time, with room to breathe

**What to build:** Owner playtest after config v4: from Chapter 2–3 the horde arrives from every side at once and there
is nowhere to run. Two causes: every monster spawns at a uniformly random angle (and monsters left behind reappear at a
random angle), and the Director sits near its 2.4 ceiling for a player doing well and carries it into the next Stage.
Make most monsters come from a **wave front** — one side that moves every few seconds — with a short quiet spell when it
moves, swarm rings as a **pincer** (two arcs, the far side open), and let the Director ease off at each new Stage.
Everything is a Balance Config field whose default keeps today's behaviour; the owner turns it on from Admin.

**Blocked by:** —

**Status:** ready-for-human — code merged (PR #23) and migration 0024 applied to live via the Supabase SQL editor (so it is not in the migration history); every wave-front field is still at its neutral default (off). Pass 2026-09c (Director) published as v6. Waiting for the owner: playtest wave values with a draft link from Admin → Balance, then publish them as a balance pass (v7 or later) (2026-09-26)

- [x] Pass 2026-09c (config only, works on the live build): `director.max` 2.4 → 1.6, `director.rise` 0.06 → 0.04 — published as v6
- [x] `spawn.frontShare / frontArc / frontEvery / frontTurn` — wave front
- [x] `spawn.lull / lullSpawn` — quiet seconds when the front moves
- [x] `spawn.frontRecycle` — monsters left far behind reappear on the front, not ahead of a fleeing player
- [x] `spawn.pincer / pincerArc` — swarms as two arcs on the front's sides (Blood Moon keeps the full ring)
- [x] `director.stageReset` — share of the way back to `director.start` at each new Stage
- [x] Migration `20260928000024_spawn_wave_fronts.sql` (live `config_schema`; applied via the SQL editor 2026-09-26, not in the migration history), Thai field help in `desc-th.ts`
- [x] Tests `tests/spawn-front.test.ts`; golden replays unchanged (defaults draw no extra random numbers)
- [x] Playtest crowd metrics (`crowd` per Chapter in `scripts/playtest/run.ts`: monsters alive, Director, blocked directions)
- [ ] Owner playtest → recommended wave values as a balance pass → publish (v7 or later)
- [ ] When published: site text `g.stage.t1` ("every 18 s … a ring") in `apps/site/src/text.ts`

## Notes (implementation)

- `packages/sim/src/systems/spawner.ts`: `frontStep()` moves `s.front.a` by `frontTurn`–180° (random side) every
  `frontEvery` s and returns the spawn-rate × for the quiet seconds; `edgePos(s, onFront)` picks the front
  (`frontShare` of the time, always for recycled monsters with `frontRecycle`) at ±`frontArc`/2 around it.
  Kings, Guardians and the Rival also use `edgePos`, so with the front on they often arrive from it too.
- The front angle is world-absolute and shared in co-op; each spawn still picks a random living player as its centre.
- `s.front` is reset (`t = 0`) at every Stage start, so each Stage opens with a fresh side and a quiet spell.
- Nothing new is drawn from `rng.spawn` while `frontShare` and `pincer` are 0, so replays and checkpoints of
  earlier versions stay identical.

## Bot results (12 seeds × 4 Heroes, v4 + pass; `node scripts/playtest/exp.mjs`, 2026-09-26)

"wave" = 2026-09c + `director.stageReset` 0.5 + `frontShare` 0.75, `frontArc` 100, `frontEvery` 9, `frontTurn` 90,
`lull` 2.5, `lullSpawn` 0.35, `frontRecycle` 1, `pincer` 1, `pincerArc` 100. Blocked = share of 12 directions with a
monster within 70 px (the bot kites well, so real players see more).

| | Chapter reached (fresh / mid shop) | Reach Chapter 3 (fresh) | Monsters Ch 2/3/4 (mid) | Director Ch 2 (mid) | Blocked Ch 2 (fresh / mid) |
|---|---|---|---|---|---|
| v4 | 3.5 / 6.6 | 69% | 64 / 72 / 81 | 2.26 | 36% / 34% |
| 2026-09c | 4.0 / 6.9 | 73% | 46 / 54 / 56 | 1.50 | 30% / 26% |
| wave | 4.5 / 7.2 | 85% | 41 / 50 / 42 | 1.51 | 25% / 22% |
| wave, no lull | 4.6 / 7.2 | 83% | 50 / 52 / 58 | 1.49 | 28% / 25% |

Each step makes the game easier (the wave front mainly by giving a way out). If the owner wants the old difficulty
with the new feel, raise `spawn.base` / `spawn.prog` or keep `director.max` higher once the fronts are on.
