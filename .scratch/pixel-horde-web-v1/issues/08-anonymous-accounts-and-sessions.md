# 08: Anonymous Player Accounts, nicknames and one-place-at-a-time sessions

**What to build:** On first launch a player enters a nickname (or skips and gets "Hero#1234") and gets an anonymous Supabase account. Only one place plays at a time: a second tab shows "game open in another tab" with "use this tab instead", and a newer login elsewhere makes the older device show "account opened elsewhere".

**Blocked by:** 01 (Workspace scaffold and the original game running on Cloudflare Pages)

**Status:** in-progress — live: migrations applied and anonymous sign-in on (18 anonymous accounts). Open: Turnstile is not set up — the repo variable `TURNSTILE_SITE_KEY` does not exist, so the deployed build sends no captcha token; the raised anonymous rate limit is not confirmable from here — owner to set both (checked 2026-09-26 against the live project)

- [ ] Supabase project `pixel-horde` has `profiles` with RLS; anonymous sign-in enabled with raised rate limit and Turnstile
- [x] `claim_session` stores the JWT session id; gameplay RPCs reject stale sessions with SESSION_REPLACED
- [x] Same-browser tabs coordinate via Web Locks/BroadcastChannel
- [x] Nickname profanity filter (Thai/English basic list)
- [x] pgTAP tests cover RLS on `profiles` and stale-session rejection

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** migration `supabase/migrations/20260925000001_profiles_and_sessions.sql`; pgTAP file `supabase/tests/001_profiles_sessions.test.sql` (runs in CI via PGlite + shim). Client: `apps/game/src/net/` (`backend.ts` interface, `supabase.ts` lazy adapter that falls back to `offline.ts`), `platform/tabs.ts` (Web Locks + BroadcastChannel), `ui/account.ts` (nickname prompt, rename, tab screens, "opened elsewhere"). Session is checked at Run start, every Stage start and when the tab becomes visible. When this was written it had not been exercised against the live project; the migrations are applied and live now (see Status).
