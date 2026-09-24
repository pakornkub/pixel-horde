# 10: Leaderboards and Seasons

**What to build:** Players see Season boards (solo, co-op, Endless) and an all-time board per World: the top 100 with name, Title slot, Score, Chapter, Hero and Weapon, their own rank with neighbours even outside the top 100, and a Hero filter. `submit_run` keeps each player's best per board.

**Blocked by:** 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** ready-for-agent

- [ ] `leaderboard` and `seasons` tables; ties ordered by earliest achievement
- [ ] Leaderboard screen with board tabs, my-rank row and Hero filter
- [ ] Co-op entries are marked "unverified"
- [ ] pgTAP tests cover best-per-board updates

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
