# 26: Skill Points, King rewards, Gold-for-Skill-Points and the bought revive

**What to build:** Every King kill gives 50 × Chapter Gold, 1 Skill Point and the chest wheel. Skill Points buy a reroll (1), a banish (1) or +1 level to a chosen Skill (2); at Stage end Gold buys Skill Points at 30 × Chapter. On death a player may buy one revive per Run for 75 × Chapter Gold (separate from Second Wind), which cuts the final Score by 15%. The permanent Shop is only reachable outside Runs.

**Blocked by:** 21 (Skill slots v2, Bench and Stage-end swaps); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** ready-for-agent

- [ ] All prices from Balance Config
- [ ] `submit_run` accounts for in-Run Gold spending
- [ ] Bought revive disabled where the spec says (daily challenge flag reserved)
- [ ] Sim tests for Skill Point actions and revive Score penalty

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
