# 12: Feature flags, maintenance mode, minimum build and announcements

**What to build:** The server can instantly disable co-op, score submission or individual events, put the game into maintenance, force a refresh below a minimum client build, and show a Thai/English announcement on the title screen with start/end times.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions)

**Status:** ready-for-agent

- [ ] `feature_flags` and `announcements` tables readable by players
- [ ] Clients check flags at launch, Stage start and before creating a room or submitting a score
- [ ] Maintenance shows a friendly screen; solo offline play remains possible
- [ ] Flags can be edited via SQL/Supabase Studio until the Admin pages exist

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
