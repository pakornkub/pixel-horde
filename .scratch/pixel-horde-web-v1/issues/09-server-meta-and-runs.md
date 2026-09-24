# 09: Server-counted meta progression, Run submission and anti-cheat tier 0

**What to build:** Gold, Shop levels and unlocks are owned by the server: a Run starts with `start_run` (token + server seed) and ends with `submit_run`, which validates and credits Gold; the Shop buys through `buy_upgrade`. Offline Runs queue and submit later; the old `pixelhorde-meta` save is uploaded once. The client never writes tables directly.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 04 (Determinism guardrails, headless test harness, golden replay and CI)

**Status:** ready-for-agent

- [ ] Tables `meta_progress` and `runs` (with World column) exist with RLS; players cannot write them directly
- [ ] `submit_run` enforces minimum real play time, Score/Gold ceilings per Chapter and config version, rate limit
- [ ] Backend interface has a Supabase adapter and an offline adapter; the game plays solo fully when the server is unreachable
- [ ] Legacy local save uploads once and is tagged
- [ ] pgTAP tests cover ceilings, time check, RLS; game-side flows are tested against the offline/fake adapter

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
