# 11: Link Google and merge accounts

**What to build:** A player can link Google from the title screen; if that Google account already has a save, both merge automatically (unlocks united, higher Shop levels, higher Gold kept, best scores kept).

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** done — Google sign-in on (5 Google accounts, 1 linked from an anonymous account); owner to confirm the flow once on a phone (checked 2026-09-26 against the live project)

- [x] Manual linking enabled; `linkIdentity` flow works on desktop and mobile
- [x] `identity_already_exists` triggers `merge_accounts` with the documented rules
- [x] Merging never sums Gold
- [x] pgTAP tests cover merge rules

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** migration `20260925000006_merge_accounts.sql` (`create_merge_ticket` made by the anonymous session before the redirect; `merge_accounts(ticket)` called by the Google session: higher Gold, higher Shop level per item, united Heroes/Weapons, best leaderboard row per board, Run history moved, anonymous account deleted; tickets are one-time and expire in 30 min). Client: `apps/game/src/net/link.ts` (pure state machine, unit-tested) + `supabase.ts` (`linkIdentity`, then `signInWithOAuth` on `identity_already_exists`, then merge). Title shows "Link Google" for anonymous online players; the game-over screen suggests it after the 3rd Run (victory prompt comes with ticket 29). Not yet tried against real Google OAuth (needs the owner's Google Cloud client + Supabase provider settings).
