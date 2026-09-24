# 02: Extract the headless deterministic sim core

**What to build:** The game still plays the same, but all core gameplay (player movement, spawner, Director, combat via `hit()`/`hurtP()`, the 12 skills, pickups, level-up, chest wheel, stage flow) runs inside the headless sim package behind `createSim(...)` → `step(inputFrame, commands)` / `view()` / `score()` / `hash()`. The renderer only reads `view()`; menus send Commands and listen to sim events.

**Blocked by:** 01 (Workspace scaffold and the original game running on Cloudflare Pages)

**Status:** in-progress — code done; waiting for the owner's side-by-side playtest

- [x] Sim advances at a fixed 60 ticks/s from an accumulator in the game loop; timers are expressed in ticks where practical
- [x] All gameplay randomness comes from a seeded 32-bit RNG with named streams; rendering uses a separate `fxRng`
- [x] The sim package imports no DOM, Canvas, network, wall-clock or `Math.random`
- [x] Keyboard/touch input becomes an `InputFrame` per tick; level-up picks, chest stop and pause become Commands
- [x] The old kill counter `combo` is renamed Kill Streak
- [ ] A side-by-side playtest shows no noticeable gameplay difference

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `packages/sim` (`createSim` → `step/view/score/hash`), game in `apps/game/src` (render/, ui/, audio/, platform/). The artifact-only co-op (`window.claude` room) was not ported: it cannot run outside Claude and is rebuilt on the new transport in tickets 41–42. Presentation (particles, damage numbers, shake/flash, banners, sfx) is driven by sim events; banners are keys looked up in `apps/game/src/ui/text.ts`.
