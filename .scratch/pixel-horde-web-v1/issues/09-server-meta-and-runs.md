# 09: Server-counted meta progression, Run submission and anti-cheat tier 0

**What to build:** Gold, Shop levels and unlocks are owned by the server: a Run starts with `start_run` (token + server seed) and ends with `submit_run`, which validates and credits Gold; the Shop buys through `buy_upgrade`. Offline Runs queue and submit later; the old `pixelhorde-meta` save is uploaded once. The client never writes tables directly.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 04 (Determinism guardrails, headless test harness, golden replay and CI)

**Status:** done — migrations applied and Runs are being submitted (188 so far) (checked 2026-09-26 against the live project)

- [x] Tables `meta_progress` and `runs` (with World column) exist with RLS; players cannot write them directly
- [x] `submit_run` enforces minimum real play time, Score/Gold ceilings per Chapter and config version, rate limit
- [x] Backend interface has a Supabase adapter and an offline adapter; the game plays solo fully when the server is unreachable
- [x] Legacy local save uploads once and is tagged
- [x] pgTAP tests cover ceilings, time check, RLS; game-side flows are tested against the offline/fake adapter

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** migration `20260925000002_meta_and_runs.sql` (also creates `balance_configs` with version 0 = built-in defaults; a test keeps it equal to `DEFAULT_CONFIG` — when defaults change, add a migration that updates version 0 or publish a new version). Ceilings live in Balance Config `shared.antiCheat`. Offline Runs use `submit_offline_run` (status `offline`, unranked, deduped by client Run id). Game side: `apps/game/src/meta.ts` (`createMetaSync`: local cache + queue, server wins, one-time legacy upload of a save without the version marker), Run lifecycle in `main.ts` (server seed from `start_run`, progress recorded at every Stage clear, submit at Run end).
