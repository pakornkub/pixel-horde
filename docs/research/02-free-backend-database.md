# 02 — Free backend + database: which one for accounts, Balance Config, scores and cron?

- **Date checked:** 2026-09-24 (all quotas and rules below were read from the linked first-party pages on that date)
- **Budget:** 0 THB, free tiers only, no credit card on file
- **Players:** Thai-first, desktop and mobile web. The game is a static site (see `01-free-static-hosting.md`).
  Co-op transport is covered separately (see `03-coop-transport.md`, which recommends Cloudflare Durable Objects).
- **Vocabulary:** Player Account, Balance Config, Admin Console, Season. See `CONTEXT.md`.

## TL;DR

**Recommendation: Supabase Free plan.** It is the only candidate that covers every need on the free tier
without us writing our own auth:

- anonymous sign-in, then `linkIdentity()` to attach Google to the same account
- Postgres row-level security (RLS) with an admin role via the Custom Access Token hook, which is available on Free
- server-side score validation in a `security definer` Postgres function or an Edge Function
  (500 k invocations/month)
- `pg_cron` jobs for timed events and daily rollups
- Realtime Broadcast to announce a new Balance Config version

The main risk is that **free projects are paused after about a week without enough database activity**. We
handle that with a daily keep-alive request (see §5). We also keep Balance Config downloads small so we
stay under the 5 GB egress limit.

**Fallback: Cloudflare Workers + D1 (+ Durable Objects / KV).** It never pauses, its daily quotas are
generous, and D1 is plain SQLite that we can export. We already plan to use Cloudflare for co-op. The
catch is that **it has no auth product**. We would have to build anonymous tokens, Google ID-token
verification, account linking and every access check ourselves, and the free plan allows only
100 k Worker requests/day **in total, shared with co-op**.

**Rejected:**
- **Firebase Spark:** it can't deploy Cloud Functions, so there is no server-side score validation and no
  scheduled jobs without the Blaze plan. Its auth is the best of the five, though.
- **Appwrite Cloud Free:** projects are paused after 7 days with no *Console development activity*
  (player traffic does not count) and **deleted after 90 days paused**. It also allows only 2 functions
  per project and 500 k reads/month.
- **PocketBase:** no free host that stays up (PocketHost has no free tier, Fly.io has no free allowance,
  Oracle Always Free reclaims idle VMs). It has no anonymous auth, and it is pre-1.0 and "NOT recommended
  for production critical applications yet".

---

## 1. Requirements checklist

| # | Need | Why |
|---|---|---|
| R1 | Anonymous **Player Account** behind a nickname, **linkable to Google later without losing data** | Meta Progression and scores belong to the account from the first run |
| R2 | **Admin role** separate from players | The Admin Console edits Balance Config, opens Seasons, moderates boards |
| R3 | Client fetches the **versioned Balance Config at stage start**, ideally with a push when a new version is published | A run locks to the version current at each stage start (`CONTEXT.md`) |
| R4 | **Row-level security** | Players may only write their own rows. Scores and config are read-only to players. |
| R5 | **Server-side functions** to validate scores | Stops trivially forged leaderboard entries |
| R6 | **Scheduled jobs (cron)** | Timed events and daily stats rollups for the Admin Console |
| R7 | 0 THB, survives quiet weeks, low lock-in | Solo admin, hobby budget |

## 2. Comparison table

✅ = on the free tier, ⚠️ = with caveats or DIY, ❌ = not on the free tier.

| | **Supabase Free** | **Firebase Spark** | **Cloudflare Free** (Workers + D1 + KV + DO) | **Appwrite Cloud Free** | **PocketBase** (self-host) |
|---|---|---|---|---|---|
| R1 Anonymous auth | ✅ `signInAnonymously()` | ✅ `signInAnonymously()` | ❌ none built in, DIY | ✅ anonymous session | ❌ not built in (password, OTP, OAuth2, MFA only) |
| R1 Link to Google, keep data | ✅ `linkIdentity()` (manual linking must be enabled; beta) | ✅ `linkWithCredential` / `linkWithPopup`, same UID | ⚠️ DIY: verify Google ID token, attach to our user row | ✅ convert anonymous to OAuth2 account, data inherited | ⚠️ DIY guest record, then OAuth2 |
| R2 Admin role | ✅ Custom Access Token hook (Free) + RLS, or `admins` table | ✅ custom claims (Admin SDK) or `admins` doc in rules | ⚠️ DIY in Worker code | ✅ Teams/labels + permissions | ✅ superusers + API rules |
| R3 Config fetch + push | ✅ REST/RPC + Realtime Broadcast (200 conns, 2 M msg/mo) | ✅ Remote Config + `onConfigUpdate` on web (SDK ≥ 12.3.0), or a Firestore listener | ⚠️ KV/D1 fetch; push via DO WebSocket (DIY) | ✅ Realtime (250 conns, 2 M msg/mo) | ✅ realtime subscriptions (SSE) |
| R4 Row-level security | ✅ Postgres RLS | ✅ Security Rules | ⚠️ DIY in Worker code | ✅ document/row permissions | ✅ API rules |
| R5 Server functions | ✅ Edge Functions 500 k/mo + Postgres functions (RPC) | ❌ **Cloud Functions need Blaze** | ✅ Workers (100 k req/day, 10 ms CPU) | ⚠️ 750 k executions/mo but **2 functions/project** | ✅ JS/Go hooks |
| R6 Cron | ✅ Supabase Cron (`pg_cron`), second-level granularity, SQL or HTTP | ❌ scheduled functions need Blaze + Cloud Scheduler | ✅ Cron Triggers (5 per account, UTC) | ✅ scheduled function executions (counts against the 2 functions) | ✅ `cronAdd()` |
| Inactivity pause | ⚠️ **paused after ~1 week without enough database activity**; player API calls count | ✅ none | ✅ none | ❌ **paused after 7 days without Console development activity; player traffic does not count; deleted after 90 days paused** | depends on host (Oracle reclaims idle VMs) |
| Lock-in | Low: Postgres, `pg_dump`, open-source and self-hostable | High: NoSQL data model + proprietary rules + SDK | Medium: D1 = SQLite (portable); Workers/DO code is Cloudflare-specific | Medium: open-source and self-hostable, but its own data API | Lowest: one SQLite file + one binary |

### Free quotas in detail

| | Supabase Free | Firebase Spark | Cloudflare Free | Appwrite Cloud Free | PocketBase |
|---|---|---|---|---|---|
| Projects | 2 active | (per project quotas) | 100 Workers, 10 D1 DBs | 2 projects, 1 DB each | n/a |
| Auth MAU | 50,000 | 50 k MAU | n/a (DIY) | 75 k MAU | unlimited (self) |
| Database size | 500 MB (shared CPU, 500 MB RAM) | Firestore 1 GiB; RTDB 1 GB | D1 500 MB/DB, 5 GB/account; DO SQLite 5 GB | 2 GB storage (shared) | disk of host |
| Reads / writes | not metered (egress-bound) | Firestore 50 k reads, 20 k writes, 20 k deletes **per day** | D1 5 M rows read, 100 k rows written **per day**; KV 100 k reads, **1 k writes/day** | 500 k reads, 250 k writes **per month** | host-bound |
| Egress / bandwidth | 5 GB + 5 GB cached | Firestore 10 GiB/mo; Hosting 360 MB/day | not metered for Workers | 5 GB/month | host-bound |
| File storage | 1 GB | 5 GB (legacy buckets) | R2 not evaluated | 2 GB, 50 MB file limit | host-bound |
| Functions | 500 k Edge invocations/mo; 2 s CPU, 150 s wall, 256 MB | none on Spark | 100 k requests/day, 10 ms CPU/invocation, 50 subrequests | 750 k executions/mo, 100 GB-h, 2 functions/project | n/a |
| Realtime | 200 concurrent, 2 M messages/mo, 100 msg/s, 256 KB payload | RTDB 100 simultaneous connections; Remote Config 100 k req/day | DO 100 k req/day (WebSocket messages billed 20:1), 13,000 GB-s/day | 250 concurrent, 2 M messages/mo, 256 KB | SSE, host-bound |
| Cron | `pg_cron`, ≤ 8 concurrent jobs recommended, 10 min max per run | Blaze only | 5 Cron Triggers/account | via the 2 functions | unlimited |
| **When quota is exceeded** | notification, **grace period**, then Fair Use restrictions: pause project, **database read-only**, or **HTTP 402 on all API requests** | "usage of that specific product will be shut off" until the quota resets (Firestore resets daily around midnight Pacific) | "further operations of that type will fail with an error"; Workers return Error 1027 once 100 k/day is used (fail open or closed per route) | "Your project will freeze, and Appwrite Console will continue running in read-only mode" until upgrade or next cycle | nothing is metered; the host may throttle or reclaim |

## 3. Notes per candidate

### Supabase Free (recommended)

- **Anonymous → Google.** `signInAnonymously()` creates a normal `authenticated` user with an `is_anonymous`
  JWT claim, which RLS can check. `linkIdentity()` attaches an OAuth provider such as Google to the
  signed-in anonymous user, and "manual linking" must be enabled first (beta).
  If the Google identity already belongs to another account, the docs describe a manual merge: sign in to
  the existing account and reassign the anonymous user's rows. We should put that merge in one RPC.
- **Abuse guard.** Anonymous sign-ins are rate-limited per IP to **30/hour by default**. The limit can be
  changed under Authentication → Rate Limits. That matters for shared IPs (Thai mobile CGNAT, net cafés).
  Supabase strongly recommends Turnstile or invisible CAPTCHA on anonymous sign-in.
  **Automatic cleanup of anonymous users is not available.** A `pg_cron` job can delete stale
  anonymous users that have no progress.
- **Admin role.** The Custom Access Token hook is available on Free. It adds a `user_role` claim from a
  `user_roles` table, and RLS policies call an `authorize()` helper. The Admin Console signs in with
  Google and gets the `admin` role. Players can never write `user_roles`.
- **Balance Config (R3).** Use a table `balance_config(version, published_at, data jsonb)`, readable by
  everyone and writable only by admins. At stage start the client calls a tiny RPC that returns the current
  version number (bytes). It downloads `data` only when that version is not already cached in
  localStorage. When the admin publishes, a trigger calls `realtime.broadcast_changes()`. Supabase
  recommends Broadcast over Postgres Changes "for scalability and security". Clients hold one
  connection, and the free plan allows 200 concurrent connections. This hint is optional: if the socket
  is closed or full, the stage-start version check still works.
  - *Why this matters:* re-downloading a 10 KB config at every stage start would cost
    1,000 DAU × 5 runs × 8 stages × 10 KB ≈ 400 MB/day ≈ 12 GB/month, which is over the 5 GB egress limit.
    With the version check, egress is close to zero.
- **Score validation (R5).** Players get no `insert` policy on `scores`. The only way in is a
  `security definer` function `submit_score(run_id, …)`. It checks plausibility: kills/sec for the
  stage timer, level against the XP curve, the Balance Config version, and one run per `run_id`.
  Plain SQL uses no Edge Function invocations. Use an Edge Function only if we need a replay check.
- **Cron (R6).** Supabase Cron runs SQL, database functions or HTTP calls on a schedule from every
  second up to yearly. Use it for daily rollups into a `stats_daily` table, for starting and ending timed
  events, and for anonymous-user cleanup.
- **Pausing.** "A Free plan project is considered inactive if it does not receive sufficient user database
  activity over the past week"; "a few user requests to the database each day" is typically enough. There is a
  warning email about a week in advance. After a pause, the project can be restored from Studio (the pausing doc
  now says a 1-year window; an older changelog said 90 days). Real player traffic counts, unlike Appwrite.
- **Lock-in.** The data is plain Postgres (`pg_dump`), auth users live in the `auth` schema, and the whole
  stack is open-source and can be self-hosted. The code that would need porting is the RLS policies and the
  `supabase-js` calls.

### Firebase Spark

- Best anonymous auth: `signInAnonymously` → `linkWithCredential` / `linkWithPopup` keeps the same UID.
  Conflicts (`auth/credential-already-in-use`) need a manual merge. Identity Platform can auto-delete
  anonymous accounts older than 30 days.
- Remote Config fits Balance Config well. It has 100 k requests/day on Spark, and real-time `onConfigUpdate`
  works on web with JS SDK v12.3.0 or later.
- **Blocking gaps:** "to deploy functions, your project must be on the Blaze pricing plan". Scheduled
  functions also need Blaze plus Cloud Scheduler ($0.10/job/month after 3 free jobs). Blaze needs a
  billing account, which breaks the 0 THB rule.
- Firestore quotas are **per day** (50 k reads). A leaderboard read by 1,000 players a few times a day
  could use them up. Once exceeded, the product shuts off until the quota resets.
- Highest lock-in: document model, Security Rules language, Firebase-only SDK.

### Cloudflare Free (Workers + D1 + KV + Durable Objects) — fallback

- No pausing ever, D1 has 5 M rows read/day, and it runs at the edge close to Thailand. Durable Objects on the
  free plan are SQLite-backed only, and the WebSocket Hibernation API keeps a "config published" push
  channel cheap.
- **We must build auth.** That means issuing our own signed anonymous tokens, verifying Google ID tokens
  (JWKS), linking accounts, checking the admin role, and writing every "RLS" check by hand in Worker code.
  It is the largest amount of security-sensitive code of any option.
- The **100 k requests/day** limit covers all Workers, and DO requests have their own 100 k/day. Co-op
  already uses DO (doc 03), so backend and co-op would share these limits. KV allows only **1,000 writes/day**,
  so use it for the published Balance Config only and never for per-player data. Only **5 Cron Triggers**
  per account.
- Lock-in is medium: D1 is SQLite and can be exported, but Workers/DO code is Cloudflare-specific.

### Appwrite Cloud Free

- Features are complete (anonymous → OAuth2 conversion, permissions, realtime, scheduled functions).
  The free tier is narrow: **2 functions per project** (score validation plus a cron job already uses
  both), 1 database, and 500 k reads/250 k writes **per month**.
- **Pausing is the deal-breaker.** Free projects are paused after "no development activity for 7 consecutive
  days". On Appwrite's forum, a team member stated (2026-03-12) that "Runtime traffic such as API calls, SDK
  usage, or end-user visits does not count toward this". Projects paused for
  90 days are **deleted with all resources**. A solo admin on holiday could lose the live game.
- Realtime overage has been charged since 2026-04-30, but only for paid plans. On Free, going over freezes
  the project.

### PocketBase

- A single Go binary with SQLite. It has realtime (SSE), OAuth2 (Google), API rules, superusers, JS hooks
  and `cronAdd()`, and the lowest lock-in.
- **No anonymous auth**, so we would fake a guest record and write our own linking code. The docs warn that
  backward compatibility is not guaranteed before v1.0 and that it is not recommended for production critical
  applications yet (current v0.40.x).
- **No zero-cost host found:** PocketHost has no permanent free tier (7-day trial, then from $59.99/yr), and
  Fly.io's docs show no free allowance for new orgs. Oracle Cloud Always Free (A1 up to 2 OCPU/12 GB) works,
  but "Idle Always Free compute instances may be reclaimed" when CPU p95, network and memory all stay under
  20% for 7 days. A quiet game server fits that pattern. We would also own backups, TLS and updates.

## 4. Recommendation

1. **Primary: Supabase Free.** Build the Player Account, admin role, Balance Config, scores, Seasons and
   stats on it. Keep all validation in Postgres functions and RLS so it stays portable.
2. **Fallback: Cloudflare Workers + D1**, used if Supabase changes its free tier, pauses us anyway, or we
   hit the 5 GB egress / 500 MB DB limits. Because the schema is SQL, the port from Postgres to SQLite
   is mostly mechanical. Auth is the expensive part. To keep the move cheap, the client should talk to the
   backend through one `net/backend.ts` interface (`signInAnon`, `linkGoogle`, `getConfigVersion`,
   `getConfig`, `submitScore`, `onConfigPublished`) instead of calling `supabase-js` all over the game.

## 5. Guardrails if we choose Supabase

- **Keep-alive.** A daily Cloudflare Worker Cron Trigger (we already have a Cloudflare account for co-op)
  calls one cheap RPC such as `select current_balance_version()`. The docs say a few database requests a
  day are enough. We should also watch for the one-week warning email.
- **Egress.** Use the version check plus the localStorage cache for Balance Config. Page leaderboards
  (top 50). Never serve images or audio from Supabase Storage; they belong on the static host.
- **Backups.** Do not count on platform backups on Free. Run a weekly `pg_dump` from a scheduled job we
  control, and keep the schema and RLS in SQL migrations in the repo.
- **Anonymous abuse.** Enable Turnstile on anonymous sign-in and raise the per-IP anonymous limit
  above 30/hour for shared-IP mobile networks. Clean up stale anonymous users with `pg_cron`.
- **Projects.** Free allows 2 active projects: use one for prod and one for dev/staging.

## 6. Open questions (not answerable from docs; verify in a spike)

- Whether anonymous users count toward the 50 k MAU (the docs don't say; it is not a problem at our scale).
- The exact error and flow when `linkIdentity()` targets a Google identity already linked to another user.
  Prototype the merge RPC.
- Whether `pg_cron` activity alone counts as "user database activity" for pausing. Assume not, and
  keep the external keep-alive.

## Sources (all checked 2026-09-24)

**Supabase**
- Pricing: https://supabase.com/pricing
- Free project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Paused projects restorable for 90 days (older changelog): https://supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days
- Billing FAQ (grace period, read-only, 402): https://supabase.com/docs/guides/platform/billing-faq
- Anonymous sign-ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Identity linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Auth hooks (plan availability): https://supabase.com/docs/guides/auth/auth-hooks
- Custom claims & RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Realtime limits: https://supabase.com/docs/guides/realtime/limits
- Subscribing to database changes (Broadcast vs Postgres Changes): https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- Edge Function limits: https://supabase.com/docs/guides/functions/limits
- Supabase Cron: https://supabase.com/docs/guides/cron

**Firebase**
- Pricing: https://firebase.google.com/pricing
- Pricing plans (quota exceeded behaviour): https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Anonymous auth (web): https://firebase.google.com/docs/auth/web/anonymous-auth
- Account linking (web): https://firebase.google.com/docs/auth/web/account-linking
- Cloud Functions get started (Blaze requirement): https://firebase.google.com/docs/functions/get-started
- Scheduled functions: https://firebase.google.com/docs/functions/schedule-functions
- Real-time Remote Config (web): https://firebase.google.com/docs/remote-config/web/real-time

**Cloudflare**
- Workers pricing (Workers, KV, D1, DO free quotas): https://developers.cloudflare.com/workers/platform/pricing/
- Workers limits (Cron Triggers, Error 1027): https://developers.cloudflare.com/workers/platform/limits/
- Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/

**Appwrite**
- Pricing and compare-plans table (free limits read from the page's plan data): https://appwrite.io/pricing
- Free plan docs: https://appwrite.io/docs/advanced/billing/free
- Automatic pausing of inactive projects (2026-02-20): https://appwrite.io/changelog/entry/2026-02-20-1
- Paused free projects deleted after 90 days (2026-06-29): https://appwrite.io/changelog/entry/2026-06-29
- Realtime usage limits (2026-03-19): https://appwrite.io/changelog/entry/2026-03-19
- Anonymous login: https://appwrite.io/docs/products/auth/anonymous
- Function executions / schedules: https://appwrite.io/docs/products/functions/execute
- Appwrite team member's answer that runtime traffic doesn't prevent pausing (official forum thread, 2026-03-12): https://appwrite.io/threads/1481574986136158322

**PocketBase and hosts**
- PocketBase docs (version, stability warning): https://pocketbase.io/docs/
- Authentication: https://pocketbase.io/docs/authentication/
- Jobs scheduling: https://pocketbase.io/docs/js-jobs-scheduling/
- PocketHost pricing: https://pockethost.io/pricing
- Fly.io pricing: https://docs.fly.io/about/pricing/
- Oracle Cloud Always Free resources (idle reclaim): https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
