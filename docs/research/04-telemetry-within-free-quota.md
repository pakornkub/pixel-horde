# Research 04: Telemetry within free quotas

- Ticket: `.scratch/pixel-horde-web/issues/04-telemetry-within-free-quota.md`
- Date checked: 2026-09-24 (all quotas below were read from the vendors' own pricing/docs pages on this date)
- Budget constraint: 0 THB, free tiers only. Backend not chosen yet (Supabase / Firebase / Cloudflare Workers+D1 / Appwrite), so everything below is written to work on any of them.

## TL;DR / Recommendation

1. **Store telemetry in our own tables, in whichever backend we pick.** Send **one Run summary event per Run** (about 0.8 KB of JSON), plus a tiny `player_days` upsert for DAU and retention. At 10,000 Runs/day this is about 14k writes/day and about 10 MB/day raw. That fits every candidate backend if raw rows are rolled up nightly and pruned (raw TTL = 45 days, shortened to about 14 days at 10k Runs/day so raw rows stay under about 150 MB).
2. **Do not send per-action events.** At 60 events per Run they break every free tier from about 1,000 Runs/day (Firestore writes, D1 writes, Supabase 500 MB, PostHog 1M events/month). For deep dives, pack a **sampled action trace (5%) into the same Run row** as a JSON blob, so it costs no extra requests or rows.
3. **Batching is built in.** The summary is the batch: stats accumulate in memory, are checkpointed to a `localStorage` outbox at each stage clear, and are sent once at Run end (piggybacked on the score submission). `sendBeacon`/`fetch keepalive` on `visibilitychange: hidden` is the fallback. The row is keyed on `rid`, so retries are idempotent.
4. **Errors and FPS: store them ourselves.** FPS is a histogram inside the Run summary. Errors go to a deduplicated `client_errors` table, one row per (day, build, fingerprint) with a counter. Sentry's free Developer plan (5k errors/month, 1 user, 30-day retention) is optional, as a developer convenience for stack traces with source maps. It is not needed for Admin v1.
5. **Third-party analytics is not the primary store.** GameAnalytics free cannot query design events or custom fields without paid PipelineIQ, and custom dimensions allow only 20 values in the SDK, which Balance Config versions will outgrow. PostHog free (1M events/month, 1-year retention) is the best "plan B" if we want dashboards without writing them, but it adds an SDK, ad-blocker loss and a cross-border transfer. Cloudflare Web Analytics is fine as a free, cookieless extra for landing-page traffic only (no custom events).
6. **Retention D1/D7** comes from a `player_days(pid, day)` table (Bangkok calendar day) with a plain SQL cohort query (see below).

---

## 1. What Admin v1 needs, mapped to data

| Admin stat | Minimum data needed | Source field(s) |
|---|---|---|
| Daily players / Runs / play time | player id, Run end, duration, day | `player_days`, `runs.dur_s`, `runs.received_at` |
| Which Stage players die on (funnel) | stage reached + end reason per Run | `runs.stage_reached`, `runs.end_reason`, `runs.killer` |
| Skills picked and which correlate with going far | offers + pick per level-up, final build, stage reached | `runs.picks` (JSON), `runs.final_build`, `runs.stage_reached` |
| Retention D1/D7 | first day seen + active days per player | `player_days` |
| Client errors, FPS | error fingerprint + counts; FPS histogram per Run | `client_errors`, `runs.fps_*` |
| Compare all of the above between Balance Config versions | Balance Config version on every row | `runs.cfg`, `players.first_cfg`, `client_errors.cfg` |

Note on `cfg`: CONTEXT.md says a Run locks to the Balance Config version current when **each Stage** starts, so the version can change mid-Run. Record `cfg` as the version at Run start **and** `stage_cfg[]` (version per Stage). Most comparisons group by `cfg`. The per-Stage death funnel should use `stage_cfg[stage_reached]`.

## 2. Proposed event schema

### 2.1 Run summary (`run_end`): one per Run, sent at Run end

```jsonc
{
  "v": 1,                      // telemetry schema version
  "rid": "k3Jd9sQ2xPa7LmN0",   // Run id, random 16 chars (primary key -> idempotent retries)
  "pid": "Zq81mYb2Rt5wHc4e",   // anonymous player id (random, localStorage; later = Player Account id)
  "sid": "p0Lk2",              // play-session id (tab lifetime)
  "cfg": 17, "stage_cfg": [17,17,18,18], // Balance Config version at Run start / per Stage
  "build": "a1b2c3d",          // client build hash (matches source maps)
  "mode": "s", "party": 1,     // s=solo, h=co-op host, g=co-op guest
  "ch": "mage", "lang": "th", "dev": "m",   // character, UI language, device class m/d
  "t0": 1790254589, "dur": 412,             // start (unix s), active play seconds (pauses excluded)
  "end": "death",              // death | quit | clear (story end) | disconnect | abandoned
  "st": 4, "killer": "eye",    // Stage reached, enemy type that dealt the final hit
  "lv": 31, "kills": 2875, "gold": 118, "score": 48210,
  "stT": [60,80,100,74],       // seconds spent in each Stage
  "ev": ["bm3","rv2:win"],     // Special Events seen (Blood Moon st3, Shadow Rival st2 won)
  "lu": ["bo,or,mg>0", "..."], // each level-up: offered codes > picked index (about 30 per Run)
  "fin": {"bo":8,"ch":7,"no":5,"me":3,"mg":5,"ha":3},  // final Skill/Passive levels
  "evo": ["bo@3"],             // Evolutions and the Stage they happened in
  "perf": {"avg":57.2,"p5":41,"h":[3,12,40,160,3900],"mob":318}, // FPS avg, 5th pct, histogram buckets <20/20-30/30-45/45-55/55+ (seconds), peak enemy count
  "err": 0,                    // client errors during this Run (details in client_errors)
  "sr": 1, "trace": null       // sample rate used for trace; trace = packed action log for sampled Runs only
}
```

Measured size of this example (Node `JSON.stringify` with 30 level-ups): **776 bytes raw, 459 bytes gzipped**. Budget **about 1 KB stored per Run** (Postgres tuple header, 2 indexes, jsonb overhead; see the [Postgres page layout](https://www.postgresql.org/docs/current/storage-page-layout.html)).

A per-Run summary answers everything in section 1 because the level-up offers are kept (`lu`). With offers we can compute **pick rate** (picked / offered), not just raw pick counts. We can also compare "offered and picked" against "offered and skipped" Runs, which is the fair way to ask "does Skill X make players go further" (see section 6.3).

### 2.2 Other tiny records

| Record | When | Size | Purpose |
|---|---|---|---|
| `player_days(pid, day)` upsert | First Run end of the day (server side, from the `run_end` request; no extra request) | about 40 B/row | DAU, retention |
| `players(pid, first_day, first_cfg, first_build)` insert-if-absent | Same request | about 60 B/row | retention cohorts per Balance Config |
| `client_errors` upsert | Batched with `run_end`, or a standalone beacon at most once per minute | about 300 B/row, one row per (day, build, fingerprint) | error list and counts |
| `session_start` (optional) | Page load | about 120 B | only if we want "opened the game but never finished a Run" |

### 2.3 Per-action alternative (for comparison)

The same information sent as individual events (`session_start`, `run_start`, `stage_start/end` ×N, `level_up` ×30, `chest` ×3, `boss_kill` ×N, `special_event`, `fps_sample` every 30 s, `death`) comes to **about 60 events per Run**. Each event needs the envelope (`e, ts, pid, rid, sid, cfg, build`) again. The measured `level_up` example is **182 bytes**, so budget about 250 B stored per event (row plus index).

## 3. Volume math

Assumptions: 2.5 Runs per play session; about 60 events per Run in the per-action model; D1 counts one written row per index entry as well as the table row ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)), so a Run row with 2 indexes plus `player_days` and `players` is about 5 "rows written".

### 3.1 One summary per Run (recommended)

| Runs/day | Events/day | Events/month | Worker/API requests/day (telemetry only) | D1 rows written/day | Raw storage/day | Raw storage/month |
|---|---|---|---|---|---|---|
| 100 | about 140 | about 4.2k | about 100 (0 extra if piggybacked on score submit) | about 500 | about 0.1 MB | about 3 MB |
| 1,000 | about 1.4k | about 42k | about 1k | about 5k | about 1 MB | about 30 MB |
| 10,000 | about 14k | about 420k | about 10k | about 50k | about 10 MB | about 300 MB |

### 3.2 Per-action events

| Runs/day | Events/day | Events/month | Requests/day if unbatched | D1 rows written/day (1 index) | Raw storage/day | Raw storage/month |
|---|---|---|---|---|---|---|
| 100 | 6k | 180k | 6k | 12k | 1.5 MB | 45 MB |
| 1,000 | 60k | 1.8M | 60k | 120k (over the limit) | 15 MB | 450 MB |
| 10,000 | 600k | 18M | 600k | 1.2M (over the limit) | 150 MB | 4.5 GB |

### 3.3 Checked against free quotas

| Quota (free tier) | Summary @100 | Summary @1k | Summary @10k | Per-action @1k | Per-action @10k |
|---|---|---|---|---|---|
| **Supabase** DB 500 MB, then read-only ([pricing](https://supabase.com/pricing), [db size](https://supabase.com/docs/guides/platform/database-size)) | OK for years | OK for about 1.3 years raw; OK forever with rollup + prune | Full in about 7 weeks raw. **Needs rollup + raw TTL of about 14 days** (about 140 MB steady) | Full in about 1 month | Full in about 3 days |
| **Firestore** 20k writes/day, 1 GiB storage, auto-index on every field ([pricing](https://firebase.google.com/pricing), [index overview](https://firebase.google.com/docs/firestore/query-data/index-overview)) | OK | OK | 14k/20k writes (70%, tight, shares the quota with the game). Storage full in about 3 months unless index exemptions + pruning | Over the limit (60k writes) | Over the limit |
| **Cloudflare D1** 100k rows written/day, 5M rows read/day, 500 MB per DB, 5 GB per account ([pricing](https://developers.cloudflare.com/d1/platform/pricing/), [limits](https://developers.cloudflare.com/d1/platform/limits/)) | OK | OK | 50k/100k writes OK. 500 MB per DB means rollup + prune (or one DB per month, up to 10 DBs) | Over the limit | Over the limit |
| **Cloudflare Workers** 100k requests/day, 10 ms CPU ([pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits](https://developers.cloudflare.com/workers/platform/limits/)) | OK | OK | 10k OK (piggyback on score submit to add about 0) | 60k unbatched (too close, the game API needs the rest) | Over the limit |
| **PostHog** 1M events/month ([pricing](https://posthog.com/pricing)) | OK | OK | 420k OK (autocapture off) | 1.8M over the limit | 18M over the limit |
| **Sentry** 5k errors/month ([pricing](https://sentry.io/pricing/)) | n/a | n/a | OK normally; one bad build can burn the month in hours | n/a | n/a |

**Conclusion:** the summary model fits every backend at 10k Runs/day as long as raw Run rows are **rolled up nightly and pruned** (raw TTL = min(45 days, about 150 MB of raw rows), which is about 14 days at 10k Runs/day; aggregates are kept forever). The per-action model only fits at about 100 Runs/day.

## 4. Batching and sampling strategy

### Batching (client)
1. **The Run summary is the batch.** A `RunStats` object in memory is updated by the game systems (level-up, stage clear, kill counter, FPS meter). Sending nothing during play also keeps the network free during co-op.
2. **Outbox in `localStorage`** (`pixelhorde-outbox`, at most 20 items, oldest dropped first). At each Stage clear, write a checkpoint of the in-progress summary with `end: "abandoned"`. At Run end, replace it with the final summary and flush. On the next boot, flush anything left over, so a killed tab still reports an "abandoned" Run instead of vanishing. Wrap every storage access in try/catch.
3. **Piggyback on score submission:** the `run_end` payload travels in the same request as the leaderboard score, which needs the same fields anyway. This is 0 extra requests, which matters for Workers' 100k/day.
4. **Unload fallback:** on `visibilitychange` → `hidden`, flush the outbox with `navigator.sendBeacon` (64 KiB queued max) or `fetch(..., {keepalive: true})`. MDN recommends `visibilitychange` over `unload`/`beforeunload`, which are unreliable on mobile ([MDN sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)).
5. **Idempotency:** `rid` is the primary key and the server does `INSERT … ON CONFLICT (rid) DO UPDATE` (the final summary overwrites an "abandoned" checkpoint). Retries with exponential backoff (1 s, 5 s, 30 s, next boot).
6. **Co-op:** each client (host and guests) sends its **own** summary with `mode` and a shared `room_run_id`, so per-player stats stay correct and team stats can be joined.

### Batching (server)
- **Nightly rollup** with a Supabase `pg_cron` job, a Cloudflare Cron Trigger (5 per account on the free plan), or an admin-triggered button. It aggregates into `daily_stats(day, cfg, …)`, `daily_stage_funnel(day, cfg, stage, reached, died)`, `daily_skill_stats(day, cfg, skill, offered, picked, stage_sum_picked, stage_sum_skipped)` and `daily_perf(day, cfg, dev, fps_hist[])`, then deletes raw `runs` older than the raw TTL (45 days by default, shortened automatically so raw rows stay under about 150 MB, which is about 14 days at 10k Runs/day). Admin Console charts read only the rollups, which keeps D1 rows-read and Supabase egress tiny.
- On Workers free, the 10 ms CPU limit and 50 D1 queries per invocation mean the rollup should be SQL-only (`json_each` is available in SQLite and Postgres), processed per day and per `cfg` chunk.

### Sampling
| Data | Rate | Why |
|---|---|---|
| Run summary | **100%** | Cheap, and DAU/retention/funnel must be exact. |
| Action trace (`trace` blob inside the Run row: timestamps of level-ups, chest, boss, damage-taken spikes, about 2–3 KB) | **5% of players**, chosen by `hash(pid) % 100 < 5`, so a player is fully in or fully out. 100% for admin/debug (`?debug=`) Runs. | For "why did they die at 2:40" deep dives. At 10k Runs/day that is 500 × 2.5 KB = 1.25 MB/day. |
| Client errors | 100% of the first occurrence of each fingerprint per session, then only a counter. Max 5 distinct fingerprints per session. | Prevents one looping error from flooding the table. |
| FPS | No samples sent; a histogram inside the summary | Constant size, whatever the Run length. |

- Store `sr` (sample rate) on each row and weight by `1/sr` when estimating totals from the trace.
- Make the rates **server-controlled** so the admin can turn them down if a quota gets close. Put them next to the Admin v1 on/off switches, not in the Balance Config (they are ops settings, not gameplay numbers).

## 5. Own tables vs free analytics services

| Option | Free quota (checked 2026-09-24) | Custom game events | Cohort retention | Data export | Where data lives / privacy | Fit for Pixel Horde |
|---|---|---|---|---|---|---|
| **Own tables** (Supabase / D1 / Firestore / Appwrite) | See section 3.3 | Anything | SQL (section 7) | It's ours | Region of our choosing (for example Singapore); no third party beyond the backend we already need | **Recommended.** Same rows as the leaderboard; Balance Config comparison is a `GROUP BY cfg`. Cost: we build the Admin charts. |
| **PostHog Cloud** | 1M events/month, 100k exceptions/month, 5k replays, **1-year retention, 1 project** ([pricing](https://posthog.com/pricing), [product analytics pricing](https://posthog.com/product-analytics/pricing)) | Yes (`capture()` with properties). Anonymous events do not create person profiles ([docs](https://posthog.com/docs/data/anonymous-vs-identified-events)) | Built-in retention insight, configurable by days/weeks ([docs](https://posthog.com/docs/product-analytics/retention)) | SQL (HogQL) API, up to 50k rows per query, rate-limited ([docs](https://posthog.com/docs/api/queries)); batch exports to S3/Postgres/BigQuery ([docs](https://posthog.com/docs/cdp/batch-exports)); free "Data Pipelines" allowance 10k events + 1M rows | US or EU (Frankfurt) cloud ([docs](https://posthog.com/docs/privacy/data-storage)), a cross-border transfer. PostHog says ad blockers block its domains; a reverse proxy recovers 10–30% ([docs](https://posthog.com/docs/advanced/proxy)) | **Best plan B.** Summary events fit even at 10k Runs/day. Downsides: extra SDK, ad-blocker loss, 1-year retention, data split from leaderboard DB. Behaviour at the free cap without a card is not documented on the pages checked (billing-limit docs say ingestion stops and "additional data is lost forever" ([docs](https://posthog.com/docs/billing/limits-alerts))). |
| **GameAnalytics** | Free, no MAU cap ([pricing](https://www.gameanalytics.com/pricing)) | Progression/design/resource/error events. Design event IDs are max 5 segments and must avoid high cardinality (no item names) ([design events](https://docs.gameanalytics.com/events-metrics-and-filtering/event-types/design-events/)). 3 custom dimensions, **20 values in the SDK** ([custom dimensions](https://docs.gameanalytics.com/event-tracking-and-integrations/advanced-tracking/custom-dimensions/)) | Yes (retention, funnels, cohorts on free) | Raw export / Data Warehouse = **PipelineIQ (paid, from $499/month)**. "Design Events and Custom Event Fields are only stored and available to query once you become a PipelineIQ Pro customer" ([data export](https://www.gameanalytics.com/pipelineiq/data-export)) | Third-party, cross-border. Design events are "no longer available" after 1–3 months ([retention practices](https://docs.gameanalytics.com/event-tracking-and-integrations/data-retention-and-limits/data-retention-practices/)) | **Not recommended.** Skill picks per Skill name would be high-cardinality; Balance Config versions would exceed 20 dimension values; no raw export on free. |
| **Cloudflare Web Analytics** | Free, 10 sites soft limit ([FAQ](https://developers.cloudflare.com/web-analytics/faq/)) | **No custom events** ("Not yet") | No | Dashboard only; unsampled 7 days, then about 10% sample, 6 months | "Does not collect or use your visitors' personal data" ([about](https://developers.cloudflare.com/web-analytics/about/)) | **Optional extra** for page views, referrers (itch.io vs direct) and Core Web Vitals of the landing page. Cannot answer any Admin v1 stat. |
| **Cloudflare Workers Analytics Engine** | 100k data points written/day, 10k read queries/day, currently not billed ([pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)) | Yes (20 blobs + 20 doubles per point) | Via SQL API, but only 3 months of data ([limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/)) | SQL API | Cloudflare | Interesting only if we choose Workers+D1: a good sink for errors/FPS, but 3-month retention is too short for version comparison over time. |
| **Google Analytics 4 (Firebase)** | Free; retention setting 2 or 14 months for explorations ([retention](https://support.google.com/analytics/answer/7667196)); BigQuery daily export 1M events/day ([export](https://support.google.com/analytics/answer/9823238)), but the BigQuery sandbox has 10 GiB lifetime storage, tables expire after 60 days, and no streaming ([sandbox](https://docs.cloud.google.com/bigquery/docs/sandbox)) | Yes | Yes (cohort exploration) | Only via BigQuery, which is constrained on free | Google, cookies, marketing-oriented. Hardest PDPA story. | **Not recommended.** |
| **Umami Cloud (Hobby)** | Free "Hobby" plan exists; exact event/site/retention limits could not be read from the JS-rendered pricing page ([FAQ](https://docs.umami.is/docs/cloud/faq)) | Yes (custom events + event data) | Limited | "All of your data can be exported" | Cookieless | Not needed; mention only as a privacy-friendly web-analytics alternative. |
| **Grafana Cloud Free** (Frontend Observability / Faro) | 50k RUM sessions/month, logs 50 GB, 14-day retention ([pricing](https://grafana.com/pricing/)) | Via logs | No (not product analytics) | Yes | Third-party | Overkill; 14-day retention too short. |

## 6. Errors and FPS: Sentry vs own storage

| | Sentry Developer (free) | Own `client_errors` table + FPS in summary |
|---|---|---|
| Quota | 5,000 errors/month, 5M spans, 50 replays, **1 user**, **30-day retention** ([pricing](https://sentry.io/pricing/)). Over quota, events are not accepted; spike protection and SDK `sampleRate`/`beforeSend` exist to limit usage ([quotas](https://docs.sentry.io/pricing/quotas/)) | Bounded by our DB. With one row per (day, build, fingerprint), a crash loop is 1 row with a large counter. |
| Stack traces | Source-map symbolication, breadcrumbs, grouping. Excellent. | Minified stack (trimmed to 1 KB). Symbolicate locally when needed with the build's source map. |
| FPS | Web vitals/tracing are page-oriented and do not measure canvas frame rate | Our own FPS histogram (per Run and per Stage), device class, peak enemy count. Exactly what the Admin needs. |
| Balance Config comparison | Via tags, in Sentry's UI only | `GROUP BY cfg, build` next to the other stats |
| Cost of integration | SDK (tens of KB) + a second dashboard + a cross-border transfer | About 60 lines: `window.onerror` + `unhandledrejection` → fingerprint (message + first frame) → outbox |

**Recommendation:** own storage for Admin v1 (errors per build/version and the FPS histogram). Optionally add Sentry free **during development/beta only**, with `sampleRate` ≤ 0.2 and `beforeSend` dedupe, for the richer stack traces. PostHog's free 100k exceptions/month is also an option if PostHog were chosen as plan B.

FPS measurement (client): record `dt` from the rAF loop into 5 buckets (<20, 20–30, 30–45, 45–55, 55+ fps) weighted by seconds, the running average, and a p5 from a 256-slot ring buffer. Report per Run, and optionally per Stage in `trace`. Also record `mob` (peak enemies alive) and `dev`, because FPS only means something next to load and device.

## 7. Computing stats in SQL

Suggested tables (Postgres syntax; SQLite/D1 is the same minus types):

```sql
create table runs (
  rid text primary key, pid text not null, sid text,
  cfg int not null, stage_cfg jsonb, build text not null,
  mode char(1), party smallint, ch text, lang text, dev char(1),
  received_at timestamptz not null default now(),
  day date not null,                 -- Bangkok date of received_at, set by the server
  dur_s int, end_reason text, stage_reached smallint, killer text,
  lv smallint, kills int, gold int, score int,
  stage_times jsonb, picks jsonb, final_build jsonb, evos jsonb, events jsonb,
  fps_avg real, fps_p5 real, fps_hist jsonb, max_mobs smallint, err_count smallint,
  sr real not null default 1, trace jsonb
);
create index runs_day_cfg on runs (day, cfg);        -- keep indexes minimal (D1 bills index writes)

create table players     (pid text primary key, first_day date not null, first_cfg int, first_build text);
create table player_days (pid text not null, day date not null, primary key (pid, day));
create table client_errors (
  day date, build text, cfg int, fp text, msg text, stack text, ua text, n int default 1,
  primary key (day, build, fp)
);
```

On ingest (one request): upsert `runs`; `insert … on conflict do nothing` into `players` and `player_days`; upsert `client_errors` with `n = n + excluded.n`. Use the **server receive time converted to Asia/Bangkok** for `day`, not the client clock.

### 7.1 Retention D1/D7 (classic "returned on exactly day N")

```sql
-- Postgres
with cohort as (
  select p.pid, p.first_day as d0, p.first_cfg
  from players p
)
select c.d0                                   as cohort_day,
       c.first_cfg                            as cfg,
       count(*)                               as new_players,
       avg((exists (select 1 from player_days x
                    where x.pid = c.pid and x.day = c.d0 + 1))::int)
         filter (where c.d0 + 1 < current_date) as d1,
       avg((exists (select 1 from player_days x
                    where x.pid = c.pid and x.day = c.d0 + 7))::int)
         filter (where c.d0 + 7 < current_date) as d7
from cohort c
group by c.d0, c.first_cfg
order by c.d0;
```

```sql
-- SQLite / Cloudflare D1 (day stored as 'YYYY-MM-DD' text)
SELECT p.first_day AS cohort_day, p.first_cfg AS cfg, COUNT(*) AS new_players,
  AVG(CASE WHEN date(p.first_day,'+1 day') < date('now','+7 hours')
           THEN EXISTS(SELECT 1 FROM player_days x WHERE x.pid=p.pid AND x.day=date(p.first_day,'+1 day')) END) AS d1,
  AVG(CASE WHEN date(p.first_day,'+7 day') < date('now','+7 hours')
           THEN EXISTS(SELECT 1 FROM player_days x WHERE x.pid=p.pid AND x.day=date(p.first_day,'+7 day')) END) AS d7
FROM players p GROUP BY p.first_day, p.first_cfg ORDER BY p.first_day;
```

Notes:
- Immature cohorts return NULL instead of a falsely low percentage (the `filter`/`CASE` guard).
- "Rolling" D7 (returned on day 7 **or later**) is a variant: replace `x.day = d0 + 7` with `x.day >= d0 + 7`. Pick one definition and show it in the Admin tooltip.
- `player_days` is tiny (one row per player per active day) and is **never pruned**, so retention survives the raw-Run prune. At about 3k DAU that is about 180 KB/day (about 65 MB/year); archive or compress it after 1–2 years if needed.
- Caveat: `pid` lives in `localStorage`. Incognito, cleared storage and a second device create "new players", so retention is a lower bound until Player Account linking merges ids (then update `players`/`player_days` to the merged id).

### 7.2 DAU, Runs, play time
```sql
select day, cfg, count(distinct pid) dau, count(*) runs, sum(dur_s)/3600.0 play_hours,
       percentile_cont(0.5) within group (order by dur_s) median_run_s
from runs group by day, cfg order by day;
```

### 7.3 Stage death funnel per Balance Config version
```sql
select cfg, stage_reached as stage, count(*) as died_here,
       round(100.0 * count(*) / sum(count(*)) over (partition by cfg), 1) as pct_of_deaths
from runs where end_reason = 'death'
group by cfg, stage_reached order by cfg, stage;
-- "% of Runs that reach at least Stage s" = 1 - running sum of died_here / total
```

### 7.4 Skill pick rate and "does it take you further" (offer-conditioned)
```sql
-- picks = ["bo,or,mg>0", ...]; unnest with jsonb_array_elements_text (Postgres) / json_each (SQLite)
with lu as (
  select r.rid, r.cfg, r.stage_reached, ord, split_part(e, '>', 1) as offered, split_part(e, '>', 2)::int as pick
  from runs r, jsonb_array_elements_text(r.picks) with ordinality as t(e, ord)
), offers as (
  select rid, cfg, stage_reached, ord, s.skill, (s.i - 1 = pick) as picked
  from lu, unnest(string_to_array(offered, ',')) with ordinality as s(skill, i)
)
select cfg, skill,
       count(*)                                           as times_offered,
       avg(picked::int)                                   as pick_rate,
       avg(stage_reached) filter (where picked)           as avg_stage_when_picked,
       avg(stage_reached) filter (where not picked)       as avg_stage_when_skipped
from offers group by cfg, skill order by cfg, pick_rate desc;
```
Comparing "offered and picked" against "offered and skipped" avoids **survivorship bias**: Skills that only appear late are naturally over-represented in long Runs, so "average stage of Runs containing Skill X" is misleading. The nightly rollup stores these sums in `daily_skill_stats`, so the Admin never scans raw rows.

## 8. Privacy / PDPA (Thailand) considerations

Not legal advice. These are engineering choices that reduce PDPA exposure.

- **Is this personal data?** PDPA s.6 covers information that identifies a person "directly or indirectly". A persistent random `pid` combined with IP or device details can be indirect identification, so treat telemetry as personal data and minimize it ([PDPA text, MDES](https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-), [English text](https://www.thailawforum.com/personal-data-protection-act-b-e-2562-2019/)).
- **Minimize:** no IP stored (the server derives nothing from it, and logs are not kept); UA reduced to `dev` m/d (plus browser family if needed); no fingerprinting; no nickname in telemetry rows (only `pid`); no free text except error messages (strip URLs and query strings from them).
- **Lawful basis:** game-balance and crash diagnostics on minimized data can plausibly rely on **legitimate interest (s.24(5))** with a clear privacy notice (s.23: purpose, retention, recipients, contact) and an **opt-out toggle** ("Send anonymous gameplay stats") in Settings. Consent (s.19) is harder here: it must be freely given and separate, and for players **under 10, parental consent is required (s.20)**. A casual game will have minors, which is another reason to avoid consent-dependent third-party marketing analytics (GA4).
- **Cross-border transfer (s.28):** every candidate (Supabase, Firebase, Cloudflare, PostHog, Sentry, GameAnalytics) processes data outside Thailand. Destinations need adequate protection or another permitted route. The PDPC's cross-border transfer notifications took effect on 24 March 2024, per law-firm summaries ([HSF Kramer](https://www.hsfkramer.com/notes/data/2024-01/thailands-new-legislation-on-cross-border-transfer-of-personal-data)). Fewer processors means fewer transfers to justify, which is a point for own tables in one backend (choose a Singapore region where offered).
- **Retention limits:** raw Runs at most 45 days, aggregates indefinitely (not personal), `player_days` pseudonymous. State this in the notice.
- **Data subject requests:** everything is keyed by `pid`, so "delete my data" = delete by `pid` across `runs`, `players`, `player_days`.
- **Breach:** s.37(4) requires notifying the regulator without delay, within 72 hours where feasible. Minimized data keeps the impact low.

## 9. Final recommendation

1. **Collect:** one `run_end` summary per Run (schema in section 2.1, about 0.8 KB), sent through a localStorage outbox, piggybacked on score submission, with a `sendBeacon` fallback on `visibilitychange`. Write `players` + `player_days` from the same request. Client errors are deduplicated per session and upserted by (day, build, fingerprint). FPS is a histogram in the summary.
2. **Sample:** summary 100%; packed action trace 5% of players (by `pid` hash) + 100% of debug Runs; error details first-occurrence only. Rates are server-controlled.
3. **Store:** own tables in the chosen backend. Nightly rollup into `daily_*` tables and prune raw Runs after min(45 days, about 150 MB), so about 14 days at 10k Runs/day. That keeps telemetry storage under about 200 MB even at 10k Runs/day (Supabase 500 MB, D1 500 MB/DB, Firestore 1 GiB with index exemptions on the non-queried fields).
4. **Backend implications for ticket 12:** at 10k Runs/day, Firestore's 20k writes/day is the tightest quota (telemetry alone uses about 70%); Supabase and D1 have comfortable headroom. Telemetry slightly favours Supabase (Postgres SQL for the rollups, `pg_cron`) or D1 (100k writes/day), over Firestore.
5. **Skip:** GameAnalytics (no free raw access, cardinality limits), GA4 (privacy, sandbox limits), Sentry as a requirement (optional in beta).
6. **Optional:** Cloudflare Web Analytics on the landing page (free, cookieless); PostHog as plan B if building Admin charts slips (summary events fit its 1M/month up to about 20k Runs/day).

## Open items / not verified

- **Appwrite Cloud** free-plan database read/write quota: the pricing page is JS-rendered and the docs page defers to it ([billing docs](https://appwrite.io/docs/advanced/billing/free)). Third-party listings mention 2 projects and a 1-week inactivity pause. Confirm on [appwrite.io/pricing](https://appwrite.io/pricing) before ticket 12.
- **Umami Cloud Hobby** limits: not readable from the primary page.
- **PostHog** behaviour at the free cap without a card is not stated on the pages checked. PostHog's 1-year free retention and "1 project" come from its product-analytics pricing page.
- **Supabase `pg_cron` on the free plan:** the Cron docs don't state plan restrictions ([docs](https://supabase.com/docs/guides/cron)). If it is unavailable, use a GitHub Actions scheduled workflow or an admin button to trigger the rollup.

## Sources (all accessed 2026-09-24)

- Supabase pricing: https://supabase.com/pricing
- Supabase database size / read-only mode: https://supabase.com/docs/guides/platform/database-size
- Supabase Cron: https://supabase.com/docs/guides/cron
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Workers Analytics Engine pricing: https://developers.cloudflare.com/analytics/analytics-engine/pricing/
- Workers Analytics Engine limits: https://developers.cloudflare.com/analytics/analytics-engine/limits/
- Cloudflare Web Analytics about: https://developers.cloudflare.com/web-analytics/about/
- Cloudflare Web Analytics FAQ: https://developers.cloudflare.com/web-analytics/faq/
- Firebase pricing: https://firebase.google.com/pricing
- Firestore storage size: https://firebase.google.com/docs/firestore/storage-size
- Firestore index overview: https://firebase.google.com/docs/firestore/query-data/index-overview
- Cloud Functions requires Blaze: https://firebase.google.com/docs/functions/get-started
- GA4 data retention: https://support.google.com/analytics/answer/7667196
- GA4 BigQuery export: https://support.google.com/analytics/answer/9823238
- BigQuery sandbox: https://docs.cloud.google.com/bigquery/docs/sandbox
- Appwrite free plan docs: https://appwrite.io/docs/advanced/billing/free
- PostHog pricing: https://posthog.com/pricing
- PostHog product analytics pricing: https://posthog.com/product-analytics/pricing
- PostHog anonymous vs identified events: https://posthog.com/docs/data/anonymous-vs-identified-events
- PostHog retention insight: https://posthog.com/docs/product-analytics/retention
- PostHog query API: https://posthog.com/docs/api/queries
- PostHog batch exports: https://posthog.com/docs/cdp/batch-exports
- PostHog data storage: https://posthog.com/docs/privacy/data-storage
- PostHog reverse proxy: https://posthog.com/docs/advanced/proxy
- PostHog billing limits: https://posthog.com/docs/billing/limits-alerts
- GameAnalytics pricing: https://www.gameanalytics.com/pricing
- GameAnalytics data export (PipelineIQ): https://www.gameanalytics.com/pipelineiq/data-export
- GameAnalytics design events: https://docs.gameanalytics.com/events-metrics-and-filtering/event-types/design-events/
- GameAnalytics custom dimensions: https://docs.gameanalytics.com/event-tracking-and-integrations/advanced-tracking/custom-dimensions/
- GameAnalytics data retention: https://docs.gameanalytics.com/event-tracking-and-integrations/data-retention-and-limits/data-retention-practices/
- Sentry pricing: https://sentry.io/pricing/
- Sentry quotas: https://docs.sentry.io/pricing/quotas/
- Grafana Cloud pricing: https://grafana.com/pricing/
- Umami Cloud FAQ: https://docs.umami.is/docs/cloud/faq
- MDN `navigator.sendBeacon`: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
- PostgreSQL page layout: https://www.postgresql.org/docs/current/storage-page-layout.html
- Thailand PDPA B.E. 2562 (MDES): https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-
- PDPA English text: https://www.thailawforum.com/personal-data-protection-act-b-e-2562-2019/
- PDPC cross-border notifications summary: https://www.hsfkramer.com/notes/data/2024-01/thailands-new-legislation-on-cross-border-transfer-of-personal-data
