# 56: Special shop after the first win (hosts the Weapon forge, cosmetics, …)

**What to build:** Owner request (2026-09-27): a special shop that opens after the first win, built on systems the game
already has: upgrade Weapons, fashion / outfits, and more.

This is the gate and the home, not the items: the items are the balance audit's Gold-sink tickets
**49 (Weapon forge)** and **51 (cosmetics)**, possibly **50 (Hero Mastery)**. This ticket decides which of them wait for
the first win and puts them behind one "special shop" entry that appears (and is announced on the unlock screen, 55)
once the player has beaten Umbra.

Owner decisions (2026-09-27, all the recommended options):
- The Weapon forge (49) and outfits (51) wait for the first win; Hero Mastery (50) is open from the start.
- One special-shop screen with tabs (Forge / Mastery / Outfits) behind one title button; locked tabs show a lock and
  "beat Umbra once to unlock".
- The server checks it too: the purchase RPCs refuse (`SHOP_LOCKED`) before the first win, `has_won(uid)` =
  `stats.heartCrack >= 1` or `stats.heroesWon` non-empty (heartCrack first: `heroesWon` only knows the four current Heroes).
- This PR: the gate, the screen and a simple Weapon forge. Mastery and outfits show "coming soon" and ship with 50 / 51.
- Hero Mastery must also cover the 5th Hero (ticket 57) (owner, 2026-09-27).

Weapon forge rules (simple version, every number in Balance Config `shared.forge`):
- Every owned Weapon (Judgement included) has `forge.max` = 5 levels. Price `forge.base` 400 × `forge.growth` 1.6^level
  (400 / 640 / 1,024 / 1,638 / 2,621 = 6,323 per Weapon, 69.5k for all 11: about 5.5× the permanent shop).
- Each level stretches the Weapon's own Ultimate effect by `forge.<weapon>` (0.15 = +15% per level), never its damage, so
  the boss caps (`ult.bossCap` / `umbraCap`) are unchanged: root, Burning, reap threshold (capped at 100%), freeze,
  knockback, poison damage, Shocked, push, turret time, Lich Tome healing and its limit. Judgement has no effect of its
  own, so it gains one: surviving normal monsters are stunned `forge.judgement` 0.2 s per level (bosses never).
- Levels live in `meta_progress.shop` under `forge:<world>:<weapon>` keys: get_meta returns them, account merges keep the
  higher level, and `buy_upgrade` refuses them. The client keeps them in `pixelhorde-meta` (`forge`) and queues offline
  purchases like the shop.

**Blocked by:** —

**Status:** ready-for-human (owner playtest; the migration goes live with the build)

- [x] Balance Config group `shared.forge` (+ Thai descriptions, changelog category economy)
- [x] Sim: `Meta.forge`, `forgeLevel/forgeMul/forgeStun/forgeCost/forgeKey` (packages/sim/src/data/weapons.ts); the
      Ultimate reads the level of the equipped Weapon. Level 0 = unchanged (golden replays unchanged)
- [x] Game: `metaSync.hasWon / forgeLv / forgeWeapon` (queued offline), backend `forgeWeapon` → RPC `forge_weapon`
- [x] Special shop screen (`apps/game/src/ui/special-shop.ts`, `#ovSpecial`): tabs, lock, forge rows with the held Weapon
      sprite, current → next effect, price; title button "ร้านพิเศษ" with a NEW badge after the first win until opened
- [x] Migration `20260930000036_weapon_forge.sql`: `config_schema` patch, `has_won(uid uuid)` (shared with ticket 57),
      `forge_num`, `forge_cost`, RPC `forge_weapon(p_weapon, p_world)`; supabase/tests/018_weapon_forge.test.sql
- [x] Website guide: one line about the forge (numbers from the config)
- [x] Tests: tests/ultimate.test.ts (forge effects, cap, damage unchanged), apps/game/src/meta.test.ts (gate, offline
      queue, server keys)
- [ ] Owner: playtest (beat Umbra → the shop opens → forge a Weapon → feel the Ultimate)

Follow-ups (not in this PR):
- 11 Weapon icons (32×32, the skill-icon atlas style) for the forge rows and the website; the rows use the small held
  Weapon sprite until then (ticket 49's art item).
- Hero Mastery tab (ticket 50, including the 5th Hero of ticket 57) and outfits tab (ticket 51).
- Ticket 55's unlock screen announces the special shop.
