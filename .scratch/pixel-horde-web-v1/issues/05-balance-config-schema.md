# 05: Balance Config schema with every tunable number

**What to build:** Every tunable gameplay number lives in one zod schema (default, allowed range, description) with shared and per-World sections; the sim reads all numbers from a resolved config object and the game ships the defaults so it works offline.

**Blocked by:** 02 (Extract the headless deterministic sim core)

**Status:** ready-for-agent

- [ ] All numbers from the original game (stage length, spawn, Director, enemy scaling, skills, economy, events) are schema fields
- [ ] Loading a config validates it; out-of-range values are rejected with a clear error
- [ ] Defaults reproduce current gameplay exactly (golden replay unchanged)
- [ ] Config schema tests cover defaults, rejection and shared + per-World merge

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
