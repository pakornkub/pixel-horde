# 04: Determinism guardrails, headless test harness, golden replay and CI

**What to build:** Every push runs automated checks proving the sim is deterministic and stable: a scripted bot plays seeded Runs headlessly, and a recorded golden replay reproduces the exact hash sequence in Node and in Chromium, Firefox and WebKit.

**Blocked by:** 03 (Move special events, hazards, dragon, rival and pet into the sim)

**Status:** ready-for-agent

- [ ] Deterministic math helpers replace `Math.sin/cos/atan2/hypot/pow/exp/log` in the sim; an ESLint rule bans them plus `Math.random`, `Date.now`, `performance.now` in sim folders
- [ ] The input recorder is always on and a Run can be exported as a replay (seed, config, inputs, commands)
- [ ] State hash every 60 ticks; `scoreOf(state)` is the only score computation
- [ ] Vitest: bot plays N minutes across several seeds with no exceptions and progresses Stages
- [ ] Golden replay test passes in Node and in Playwright on Chromium, Firefox and WebKit
- [ ] GitHub Actions runs lint, unit tests and the cross-browser replay on every push

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
