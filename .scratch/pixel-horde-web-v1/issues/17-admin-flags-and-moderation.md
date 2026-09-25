# 17: Admin pages: flags, announcements and leaderboard moderation

**What to build:** The admin toggles feature flags and maintenance, sets the minimum build, writes announcements, and hides suspicious scores or bans players from leaderboards.

**Blocked by:** 10 (Leaderboards and Seasons); 15 (Admin Console shell, admin login, audit log and control-room home)

**Status:** in-progress — code + tests done; waiting for the owner to apply migrations, deploy the Admin site and put it behind Cloudflare Access (docs/deploy.md)

- [x] Flags page shows "instant" badges and applies immediately
- [x] Leaderboard page with board tabs and status tags (verified / pending / suspicious)
- [x] Hide/unhide and ban/unban via admin RPCs, audited
- [x] Announcements with Thai/English text and schedule

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** pages `flags.tsx` (instant badges, maintenance confirm, minimum build), `announce.tsx` (TH/EN + start/end), `leaderboard.tsx` (tabs, verified / pending / suspicious, hide/unhide, ban/unban, verify co-op). Opening a new Season with a reward-recipient list is not in this ticket's checklist; it belongs with Titles/badges (ticket 32).
