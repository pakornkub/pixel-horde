# 04: Determinism guardrails, headless test harness, golden replay and CI

**What to build:** Every push runs automated checks proving the sim is deterministic and stable: a scripted bot plays seeded Runs headlessly, and a recorded golden replay reproduces the exact hash sequence in Node and in Chromium, Firefox and WebKit.

**Blocked by:** 03 (Move special events, hazards, dragon, rival and pet into the sim)

**Status:** in-progress — done locally (Node + Chromium); Firefox/WebKit run in CI (`.github/workflows/ci.yml`)

- [x] Deterministic math helpers replace `Math.sin/cos/atan2/hypot/pow/exp/log` in the sim; an ESLint rule bans them plus `Math.random`, `Date.now`, `performance.now` in sim folders
- [x] The input recorder is always on and a Run can be exported as a replay (seed, config, inputs, commands)
- [x] State hash every 60 ticks; `scoreOf(state)` is the only score computation
- [x] Vitest: bot plays N minutes across several seeds with no exceptions and progresses Stages
- [ ] Golden replay test passes in Node and in Playwright on Chromium, Firefox and WebKit
- [x] GitHub Actions runs lint, unit tests and the cross-browser replay on every push

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** recorder + `runReplay()` in `packages/sim/src/sim.ts`; tests in `tests/` (bot, determinism, fmath, golden); goldens in `tests/golden/` (regenerate with `UPDATE_GOLDEN=1 npm test` only when gameplay is meant to change); browser golden in `tests/browser/golden.spec.ts` (`PW_CHROMIUM_PATH=... npx playwright test` locally). Replay download button on the pause and game-over screens.
