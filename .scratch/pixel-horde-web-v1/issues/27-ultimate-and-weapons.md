# 27: Ultimate rebalance and the Weapon system

**What to build:** The Ultimate charges mainly over time (full in 60 s, kills at most double the rate), deals damage relative to the Chapter's mob HP without player bonuses, and is capped at 8% of a King/Guardian's HP (5% for Umbra). Players own a Weapon collection, pick one before a Run (default Judgement) that changes only the Ultimate's form, and can switch to a Weapon found mid-Run at the next Stage end. Kings drop their Realm's Weapon at 5%.

**Blocked by:** 19 (8-Chapter Run, route choice, King-must-die, Escape and the new Score); 22 (Statuses, Combos, Realm traits and resistances); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** ready-for-agent

- [ ] Weapon collection stored per World in `meta_progress`; heirloom slot field exists (unused until a second World)
- [ ] Framework supports per-Weapon Ultimate forms that leave a Status; ship Judgement plus the Weapons of the currently playable Realms
- [ ] Sim tests: charge rate cap, boss caps, damage independent of Might/crit

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
