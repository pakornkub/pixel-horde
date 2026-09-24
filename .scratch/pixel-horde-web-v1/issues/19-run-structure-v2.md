# 19: 8-Chapter Run, route choice, King-must-die, Escape and the new Score

**What to build:** A Run is 8 Chapters: Greenvale first, a 1-of-2 route choice for Chapters 2–7 (using the existing Realms until new ones land), Heart Crater placeholder last. A Stage clears only when its King dies; overtime then Escape (King flees, no King rewards, Umbra strength +1, one re-pick per Chapter). Difficulty follows the Chapter number. Special events only in Chapters 2–7 and Blood Moon is never announced. The Score formula of the spec replaces the old one, with an itemised count-up at Run end.

**Blocked by:** 04 (Determinism guardrails, headless test harness, golden replay and CI); 05 (Balance Config schema with every tunable number)

**Status:** ready-for-agent

- [ ] Route screen shows Realm name, traits, resisted element and advised Skills
- [ ] Overtime length and Escape effects come from Balance Config
- [ ] Sim tests: Stage clears only on King death; Escape consequences; route validity; Score equals formula for fixture Runs
- [ ] Golden replay regenerated and documented as an intentional behaviour change

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
