# 01: Co-op level-ups — no attacks while choosing, shorter shield, EXP shared by team size

**What to build:** Owner co-op playtest (2026-09-26): "levels go up fast while invulnerable, as if damage is still
being done". Cause: while a player chooses a level-up / chest they stand in a shield bubble (no damage) but their
Skills and Companion keep killing; after the pick they stay invulnerable 5 s more (`coop.shieldAfter`); and every EXP
gem anyone picks gives every player 100% (spawns only grow ×1.6 with 2 players). EXP keeps coming, level-ups chain,
the player is invulnerable nearly all the time. Owner decisions: attacks stop while choosing, a short bubble after
the pick, EXP shared but scaled by team size (`1 / (1 + 0.4 × other players)`).
Everything is a Balance Config field whose default keeps today's behaviour; the owner turns it on from Admin.

**Blocked by:** —

**Status:** ready-for-human (owner: apply the migration, then load pass 2026-09-coop in Admin → Balance and publish)

- [x] `coop.choosingSkills` (default 1): 0 = Skills (and so Shadow Clone casts) and the Companion wait while their
      player chooses (`attacksPaused()` in `systems/coop.ts`, host and guest loops in `sim.ts`)
- [x] `coop.xpShareK` (default 0): each player gets `1 / (1 + k × mates)` of a shared EXP pickup (`xpShare()` in
      `systems/player.ts`; host pickup, guest team-XP delta, Stage-start EXP vacuum)
- [x] Pass `2026-09-coop`: `choosingSkills` 0, `shieldAfter` 5 → 1.5, `xpShareK` 0.4 (+ Thai report and patch notes)
- [x] Migration `20260929000026_coop_choosing_xp_share.sql` (live `config_schema`, `shared.coop` only), Thai help in `desc-th.ts`
- [x] Tests in `tests/coop.test.ts`; solo and golden replays unchanged (both fields only act in co-op)
- [ ] Owner co-op playtest after publishing
- [ ] Docs sentences (CLAUDE.md co-op + state machine, site text) sent to the coordinator session

## Notes

- Bolts already in flight and lingering effects still finish while choosing; only new attacks wait.
- `xpShare()` counts `coop.mates` (host: connected guests; guest: everyone else in the host's snapshot), so both sides
  use the same team size.
