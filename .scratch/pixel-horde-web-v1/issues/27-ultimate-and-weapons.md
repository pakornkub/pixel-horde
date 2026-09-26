# 27: Ultimate rebalance and the Weapon system

**What to build:** The Ultimate charges mainly over time (full in 60 s, kills at most double the rate), deals damage relative to the Chapter's mob HP without player bonuses, and is capped at 8% of a King/Guardian's HP (5% for Umbra). Players own a Weapon collection, pick one before a Run (default Judgement) that changes only the Ultimate's form, and can switch to a Weapon found mid-Run at the next Stage end. Kings drop their Realm's Weapon at 5%.

**Blocked by:** 19 (8-Chapter Run, route choice, King-must-die, Escape and the new Score); 22 (Statuses, Combos, Realm traits and resistances); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** done (awaiting owner playtest)

- [x] Weapon collection stored per World in `meta_progress`; heirloom slot field exists (unused until a second World)
- [x] Framework supports per-Weapon Ultimate forms that leave a Status; ship Judgement plus the Weapons of the currently playable Realms
- [x] Sim tests: charge rate cap, boss caps, damage independent of Might/crit

## Notes (implementation)

- Ultimate: fills over time (`ult.fill` 60 s); kills add charge only from a budget that refills at `killCap` × the time rate, so it is never full faster than ~30 s. Damage = `ult.mobHp` (1.5) × the Chapter's normal monster HP (same scaling as spawns) and bypasses Might/Power/crit/variance (`HitTag.raw`); capped per strike at 8% of a King/Guardian's max HP, 5% for Umbra.
- Weapons (`data/weapons.ts`): Judgement (default) + Thornwhip (roots), Sunblade (Burning), Bone Scythe (reaps normal monsters under 20% HP), Glacier Lance (freezes; bosses slowed). The six Weapons of future Realms were defined but unavailable at first (all playable since ticket 38). A Weapon changes only the Ultimate (and its colour).
- Kings drop their Realm's Weapon at 5% if not owned; beating Umbra gives a missing Weapon or 500 Gold. Found Weapons can be equipped at a Stage end (clear screen) and join the collection at once (local) / on submit (server).
- Server: `meta_progress.weapons` holds "<world>:<id>" (per-World collection), `heirloom_weapon` exists (unused until a second World); `start_run(..., p_weapon)` refuses a locked Weapon and records `runs.weapon` (shown on leaderboards); `submit_run` / `submit_offline_run` add found Weapons via `add_found_weapons` (≤ 2 per Run, well-formed ids).
- Title screen: Weapon picker (owned ones). Tests: `tests/ultimate.test.ts`, DB tests in `002_*`.

**Update 2026-09-26:** the clear screen can switch to any usable Weapon (Judgement, the collection, one found this Run) in both directions (`usableWeapons`); each Weapon's Ultimate has its own name and colour (`weapon.<id>.ult`, banner "{ult}!").

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
