# 32: Achievements, Titles, badges, bestiary and Season rewards

**What to build:** About 30 achievements across story, Heroes, Combos, dragons and challenges (some grant Titles) are tracked from Run summaries; players pick one Title to show; a bestiary unlocks entries on first kill; a collection menu shows Weapons, Titles, badges and bestiary. Opening a new Season (Admin, with a confirmation list) distributes cosmetic rewards to verified entries.

**Blocked by:** 10 (Leaderboards and Seasons); 15 (Admin Console shell, admin login, audit log and control-room home); 28 (Guardians, Companions and the Three-headed Dragon)

**Status:** ready-for-agent

- [ ] Tables `achievements`, `player_titles`, `player_badges`; `profiles.shown_title`
- [ ] Season rewards: rank 1 Title + gold frame + Hero palette; 2–10 Title + badge; 11–100 badge; Umbra victory badge
- [ ] Co-op top entries require admin confirmation before rewards
- [ ] pgTAP tests for reward distribution

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
