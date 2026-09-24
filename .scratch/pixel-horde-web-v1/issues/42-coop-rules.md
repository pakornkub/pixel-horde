# 42: Co-op rules on the new Run structure

**What to build:** Co-op follows the full ruleset: route vote (15 s, host breaks ties), parallel personal Stage-end decisions (ready or 30 s), boss HP ×(1 + 0.6 × extra players), per-player rewards (team XP, Gold from team kills with own Greed, own King rewards and Companions), revive a downed ally by standing next to them for 3 s (once per player per Stage) with arrows to downed allies, Run ends when all are down, co-op Score to the co-op board, Endless continue vote.

**Blocked by:** 41 (Co-op rooms on a Durable Object and the lobby); 19 (8-Chapter Run, route choice, King-must-die, Escape and the new Score); 26 (Skill Points, King rewards, Gold-for-Skill-Points and the bought revive); 28 (Guardians, Companions and the Three-headed Dragon)

**Status:** ready-for-agent

- [ ] Guests load the host's Balance Config version
- [ ] In-memory tests for vote, revive, all-down end, per-player rewards

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
