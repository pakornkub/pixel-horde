# 14: Run statistics, error reporting, nightly rollups and keep-alive

**What to build:** Each Run sends one ~0.8 KB summary with its submission (5% of players also send sampled detail events); client errors are grouped by fingerprint; FPS goes as a histogram; a nightly job builds daily stats per config version; a Cloudflare Worker cron pings Supabase daily to prevent pausing.

**Blocked by:** 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** ready-for-agent

- [ ] Tables `player_days`, `telemetry_samples`, `client_errors`, `stats_daily`; retention jobs per the spec
- [ ] Outbox in localStorage + sendBeacon on tab hide
- [ ] pg_cron nightly rollup and retention cleanup; anonymous-account cleanup (unlinked, inactive 90 days)
- [ ] Keep-alive Worker cron deployed
- [ ] pgTAP tests for rollup correctness on fixture data

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
