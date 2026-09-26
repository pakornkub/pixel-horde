# 12: Feature flags, maintenance mode, minimum build and announcements

**What to build:** The server can instantly disable co-op, score submission or individual events, put the game into maintenance, force a refresh below a minimum client build, and show a Thai/English announcement on the title screen with start/end times.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions)

**Status:** done — migrations applied; flags, maintenance and announcements live (checked 2026-09-26 against the live project)

- [x] `feature_flags` and `announcements` tables readable by players
- [x] Clients check flags at launch, Stage start and before creating a room or submitting a score
- [x] Maintenance shows a friendly screen; solo offline play remains possible
- [x] Flags can be edited via SQL/Supabase Studio until the Admin pages exist

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** migration `20260925000004_flags_config_audit.sql` (feature_flags seeded from `DEFAULT_FLAGS`, announcements with start/end, `get_live_state()` = flags + config version + active announcements in one REST call, `set_flag` for admins, audit triggers). Maintenance makes every gameplay RPC raise `MAINTENANCE` (admins exempt); `scoreSubmit=false` keeps paying Gold but skips leaderboards; event flags reach the sim as `setEvents` (applied at the next Stage start, random rolls unchanged). Minimum build: Vite injects `__BUILD__` (yyyymmddHHMM UTC). Edit flags in Supabase Studio → Table editor → `feature_flags` (value is JSON: `true`/`false`/number) until the Admin pages exist.
