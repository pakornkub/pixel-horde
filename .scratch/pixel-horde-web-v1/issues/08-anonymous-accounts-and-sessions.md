# 08: Anonymous Player Accounts, nicknames and one-place-at-a-time sessions

**What to build:** On first launch a player enters a nickname (or skips and gets "Hero#1234") and gets an anonymous Supabase account. Only one place plays at a time: a second tab shows "game open in another tab" with "use this tab instead", and a newer login elsewhere makes the older device show "account opened elsewhere".

**Blocked by:** 01 (Workspace scaffold and the original game running on Cloudflare Pages)

**Status:** ready-for-agent

- [ ] Supabase project `pixel-horde` has `profiles` with RLS; anonymous sign-in enabled with raised rate limit and Turnstile
- [ ] `claim_session` stores the JWT session id; gameplay RPCs reject stale sessions with SESSION_REPLACED
- [ ] Same-browser tabs coordinate via Web Locks/BroadcastChannel
- [ ] Nickname profanity filter (Thai/English basic list)
- [ ] pgTAP tests cover RLS on `profiles` and stale-session rejection

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
