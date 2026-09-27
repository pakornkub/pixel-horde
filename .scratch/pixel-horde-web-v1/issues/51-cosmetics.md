# 51: Outfits — Gold for gear sets (was: cosmetics)

**What to build:** Things to buy with Gold after the permanent shop is full. This is one of the three Gold sinks the owner
chose on 2026-09-27 (see ticket 49). First idea: looks only (palettes, trails, frames), so the leaderboard stays fair.

Owner decisions (2026-09-27, ticket 56 session), replacing the looks-only idea:
- Outfits are **gear with stats**, sold in the special shop's Outfits tab, locked until the first win (server
  `has_won(uid)`). Monster HP grows late in a Run and Heart Crack now goes to tier 10, so they add real power.
- 3 slots × 4 element sets. The slot decides the stat, the same for every set: hat damage +2% per level (additive like
  Might), body max HP +8 per level, cloak crit +1% per level (still under the crit cap).
- Wearing all three pieces of one set gives a set bonus: damage against that set's monsters, `setBase` 15% +
  `setPerLv` 2% × the lowest piece level (17–25%). Ember: Burning; Frost: Frozen or chilled; Storm: Shocked;
  Shadow: Kings, Guardians and Umbra.
- Each piece is bought with Gold (first level) and upgraded to `outfits.max` 5, price `base` 500 × `growth` 1.6^level
  (500 / 800 / 1,280 / 2,048 / 3,277 = 7,905 per piece, about 95k for all 12). Pieces work for every Hero.
- Looks: **new pixel-art sprites** (owner's choice over palette swaps). The system works before the art exists; the
  shop shows coloured slot icons until then.

**Blocked by:** —

**Status:** ready-for-human (owner playtest; art follow-up; migration 0041 goes live with the build)

- [x] Balance Config group `shared.outfits` (+ Thai descriptions, changelog category economy)
- [x] Sim: `packages/sim/src/data/outfits.ts` (sets, slots, `outfitStats`, `outfitSet`, `outfitTarget`, `outfitCost`,
      `outfitKey`), `Meta.outfit` (worn pieces + levels), `recompute` adds the stats, `hit()` adds the set bonus
- [x] Game: `metaSync.outfitLv / buyOutfit / wearOutfit / worn` (bought offline = queued; a new piece is worn at once;
      what is worn is a local choice like the picked Weapon), backend `buyOutfit` → RPC `buy_outfit`
- [x] Special shop Outfits tab: the worn full set, 4 sets × 3 pieces with level, stat now → next, buy / upgrade, wear
- [x] Migration `20260930000041_outfit_gear.sql`: `config_schema` group `shared.outfits`, `outfit_num`, `outfit_cost`,
      RPC `buy_outfit(p_set, p_slot)` (security definer; UNKNOWN_ITEM, SHOP_LOCKED via `has_won`, MAXED,
      NOT_ENOUGH_GOLD); levels in `meta_progress.shop` as `outfit:<set>:<slot>`; supabase/tests/019_outfit_gear.test.sql
- [x] Tests: tests/outfits.test.ts, apps/game/src/meta.test.ts
- [ ] Art (follow-up): outfit sprites for every Hero (5 Heroes × 4 sets × 3 pieces, side / down / up walk frames) and
      12 shop icons; then the Hero preview in the Outfits tab
- [ ] Owner: playtest; after it, the balance-audit session re-measures Heart Crack with outfits and forge
