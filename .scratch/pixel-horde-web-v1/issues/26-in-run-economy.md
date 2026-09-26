# 26: Skill Points, King rewards, Gold-for-Skill-Points and the bought revive

**What to build:** Every King kill gives 50 × Chapter Gold, 1 Skill Point and the chest wheel. Skill Points buy a reroll (1), a banish (1) or +1 level to a chosen Skill (2); at Stage end Gold buys Skill Points at 30 × Chapter. On death a player may buy one revive per Run for 75 × Chapter Gold (separate from Second Wind), which cuts the final Score by 15%. The permanent Shop is only reachable outside Runs.

**Blocked by:** 21 (Skill slots v2, Bench and Stage-end swaps); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** done (awaiting owner playtest)

- [x] All prices from Balance Config
- [x] `submit_run` accounts for in-Run Gold spending
- [x] Bought revive disabled where the spec says (daily challenge flag reserved)
- [x] Sim tests for Skill Point actions and revive Score penalty

## Notes (implementation)

- King kill: 50 × Chapter Gold (coin), +1 Skill Point, 1 chest wheel (`economy.kingSkillPoints`, `economy.kingChest`). Rewards now open before the Stage clear, so a King killed in overtime still pays out its chest.
- Skill Points: reroll 1 and banish 1 on level-up (✕ on a card; owned Skills/passives cannot be banished), +1 level for 2 (clear screen; the sim also allows it during a level-up). Clear screen: buy 1 SP for 30 × Chapter Gold. All paid from this Run's Gold first, then the wallet (`walletSpent`, charged by `submit_run`).
- Bought revive: when down without Second Wind, the sim waits in phase `revive` (75 × Chapter, once per Run, −15% final Score via `revivesBought`); not offered in `mode: 'daily'` (reserved for the daily challenge) or when Gold is short. Second Wind (Shop) still triggers first.
- The permanent Shop stays reachable only from the title and Run-end screens.
- Tests: `tests/economy.test.ts`.

**Update 2026-09-26:** by default Skill Points are no longer sold for Gold at the Stage end (`economy.spShop` 0) and a King opens only the chest wheel, no chest item (`loot.kingChestItem` 0); Admin switches bring the old rules back (migration 0014, live).

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
