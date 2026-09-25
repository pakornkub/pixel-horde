# 14: Run statistics, error reporting, nightly rollups and keep-alive

**What to build:** Each Run sends one ~0.8 KB summary with its submission (5% of players also send sampled detail events); client errors are grouped by fingerprint; FPS goes as a histogram; a nightly job builds daily stats per config version; a Cloudflare Worker cron pings Supabase daily to prevent pausing.

**Blocked by:** 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** in-progress — code + tests done; waiting for the owner to apply migrations and deploy the keep-alive Worker

- [x] Tables `player_days`, `telemetry_samples`, `client_errors`, `stats_daily`; retention jobs per the spec
- [x] Outbox in localStorage + sendBeacon on tab hide
- [x] pg_cron nightly rollup and retention cleanup; anonymous-account cleanup (unlinked, inactive 90 days)
- [ ] Keep-alive Worker cron deployed
- [x] pgTAP tests for rollup correctness on fixture data

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** migration `20260925000005_telemetry_stats.sql` (player days via a trigger on `runs`, cut in Asia/Bangkok; `report_errors` / `report_telemetry` open to anon with size caps; `rollup_day`, `retention_cleanup`, `nightly_jobs` scheduled with pg_cron at 00:10 Thai time when the extension exists). Client `apps/game/src/telemetry.ts`: Run summary (skills, picks, FPS histogram, config versions…) rides on `submit_run`; 5% sample stable per account; outbox flushed every minute and with `fetch(keepalive)` when the tab hides — plain `sendBeacon` cannot send the Supabase `apikey` header or JSON without a CORS preflight. Settings has a statistics opt-out (PDPA). Keep-alive Worker `workers/keepalive` (daily cron) is written but not deployed (needs the owner's Cloudflare token: `cd workers/keepalive && npx wrangler deploy`).
