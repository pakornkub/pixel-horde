# 49: Weapon forge — spend Gold to upgrade the Weapons you own

**What to build:** The v6 balance audit (2026-09-27) found no use for Gold once the permanent shop is full. On the
current base difficulty (ticket 48, Gold ×0.2) the playtest bot fills the shop in 5–6 Runs, and after that Gold only
piles up. Owner decision (2026-09-27): add long-term Gold sinks: a Weapon forge (this ticket), Hero Mastery (ticket 50)
and cosmetics (ticket 51).

Forge rules (owner):
- Upgrade only. Weapons are never bought: a Weapon still comes only from its Realm's King (`weapons.drop`) or from
  beating Umbra.
- Each owned Weapon (the 11 Ultimate forms in `packages/sim/src/data/weapons.ts`, Judgement included) gets forge
  levels that strengthen its own effect, e.g. Thornwhip root time, Bone Scythe execute threshold, Gear Cannon turret
  length. Levels do not add raw damage, so the Ultimate stays capped against bosses (`ult.bossCap` / `umbraCap`).
  (Superseded by ticket 58: each level now adds `forge.dmg` damage and raises the boss caps.)
- Every tunable lives in the Balance Config: price base and growth, max level, and the per-level effect of each Weapon.
- The server charges the Gold through an RPC, like the shop (`shop_cost`), never by a direct table write.
- **Art dependency:** the owner wants a picture of each Weapon for the forge screen. There is no Weapon art yet;
  the Ultimate forms are drawn only as effects. 11 icons are needed (pixel art, the same style and palette as the
  skill icons in the icon atlas, `scripts/build-icon-atlas.mjs`).

**Blocked by:** — (art can be made in parallel; the screen needs it before release)

**Status:** ready-for-human (built as ticket 56, PR #46, with the damage of ticket 58, PR #50; both live. Open: the 11
Weapon icons; owner playtest under ticket 56)

- [x] Owner: forge level cap and price curve (suggestion: 5 levels per Weapon, priced like the shop's late levels,
      so the forge holds several times the shop's 12.6k Gold)
- [x] Owner: the effect per level for each Weapon
- [ ] Weapon icons (11) in the atlas
- [x] Balance Config group `shared.forge` + migration (config_schema, `forge_cost`, meta column or `meta_progress.forge`)
- [x] Sim: Ultimate forms read the forge level (`meta.forge`) — determinism and golden replays unchanged at level 0
- [x] Forge panel: the title's Special shop (ticket 56) instead of next to the Weapon picker; the website guide describes the forge
      (per-Weapon forge levels on the website: not done)

## Notes

- Measurements behind this: balance audit report https://claude.ai/artifact/Hshttgm9nTNRkCG7pA4tEB and the career
  simulation (`scripts/playtest/career.mjs`): on the base difficulty the shop is full after 5–6 Runs (bot), with about
  1.5–3k Gold per Run.
