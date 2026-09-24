# 32: Achievements, Titles, badges, bestiary and Season rewards

**What to build:** About 30 achievements across story, Heroes, Combos, dragons and challenges (some grant Titles) are tracked from Run summaries; players pick one Title to show; a bestiary unlocks entries on first kill; a collection menu shows Weapons, Titles, badges and bestiary. Opening a new Season (Admin, with a confirmation list) distributes cosmetic rewards to verified entries.

**Blocked by:** 10 (Leaderboards and Seasons); 15 (Admin Console shell, admin login, audit log and control-room home); 28 (Guardians, Companions and the Three-headed Dragon)

**Status:** done (awaiting owner review of the achievement list and Titles)

- [x] Tables `achievements`, `player_titles`, `player_badges`; `profiles.shown_title`
- [x] Season rewards: rank 1 Title + gold frame + Hero palette; 2–10 Title + badge; 11–100 badge; Umbra victory badge
- [x] Co-op top entries require admin confirmation before rewards
- [x] pgTAP tests for reward distribution

## Notes (implementation)

- Catalog: `packages/sim/src/data/achievements.ts` — 30 achievements (story, Heroes, Combos, dragons, challenges), some grant Titles. Checked from `RunFacts` (`sim.runFacts()`: Chapter reached, victory, Heart Crack, Kings/double Kings, Combos used, kills by monster type, Guardians, Hero, no-hit Stages…) plus lifetime counters. The same list is seeded into SQL; `tests/db.test.ts` asserts TS and SQL agree.
- Server (`supabase/migrations/20260925000009_achievements.sql`): tables `achievements`, `player_achievements`, `player_titles`, `player_badges`, `profiles.shown_title`, `profiles.lifetime`, `profiles.bestiary`; `apply_run_facts` is called from `submit_run` and `submit_offline_run` (server decides unlocks); `set_title`, `get_collection`.
- Season rewards: `admin_season_rewards_preview()` lists who gets what (rank 1 Title + gold frame + Hero palette, 2–10 Title + badge, 11–100 badge, Umbra-victory badge); `admin_open_season(name)` distributes, closes the Season and opens the next (audit-logged). Only verified entries count — pending co-op entries are listed as needing admin confirmation first.
- Client: Collection menu (`apps/game/src/ui/collection.ts`, title button) with tabs Achievements / Titles / Weapons / Badges / Bestiary; new unlocks shown on the game-over screen; offline mode keeps everything in `pixelhorde-meta`.
- Admin: Leaderboard page "Season" card previews the reward list, then confirms opening the new Season.
- Tests: `supabase/tests/009_achievements.test.sql` (unlocks, Titles, reward distribution, co-op confirmation), `apps/game/src/meta.test.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
