# 10: Leaderboards and Seasons

**What to build:** Players see Season boards (solo, co-op, Endless) and an all-time board per World: the top 100 with name, Title slot, Score, Chapter, Hero and Weapon, their own rank with neighbours even outside the top 100, and a Hero filter. `submit_run` keeps each player's best per board.

**Blocked by:** 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** in-progress — code + tests done; waiting for the owner to apply migrations to the live project

- [x] `leaderboard` and `seasons` tables; ties ordered by earliest achievement
- [x] Leaderboard screen with board tabs, my-rank row and Hero filter
- [x] Co-op entries are marked "unverified"
- [x] pgTAP tests cover best-per-board updates

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** migration `20260925000003_leaderboards.sql` (Season 1 seeded; board rows `solo`/`coop`/`endless` per Season, `alltime` with season 0; the table is read only through `get_leaderboard`). `submit_run` now records the best per board; offline and rejected Runs never rank; banned players are skipped. Screen: `apps/game/src/ui/leaderboard.ts`. Daily boards (`daily:YYYY-MM-DD`) are allowed by the schema for a later release. `tests/browser/online.spec.ts` drives the online flows against a mocked Supabase API. The Score itself is still the old `stage×1e6+kills` until ticket 19.
