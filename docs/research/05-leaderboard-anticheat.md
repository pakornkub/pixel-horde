# 05 — Leaderboard anti-cheat: what is worth it?

- **Ticket question:** Which anti-cheat is worth it for the Season leaderboards (solo and co-op) and the daily
  challenge? Compare plausibility checks, replay validation, per-Run tokens, rate limiting, and manual review. Also: what
  a fair same-seed daily needs, and what the TypeScript port should prepare now.
- **Constraints:** budget 0 THB, one admin. The whole simulation runs in the player's browser (in co-op, in the Host's
  browser). Backend is expected to be Supabase (see `CLAUDE.md`).
- **Date checked:** 2026-09-24. All limits and prices below were read from the vendor pages on that date.

## TL;DR (recommendation)

Use a **tiered** approach and put the expensive part (determinism) into the TypeScript port now, while it costs almost
nothing:

| Tier | When | What | Cost |
|---|---|---|---|
| **0: "honest by default"** | The day the leaderboard ships | No direct client writes (RLS). A **Run token** is issued by the server at run start (server-chosen seed, server clock, single use). **Plausibility checks** run against the Balance Config version, including a wall-clock floor. **Rate limits** live in Postgres, with Turnstile on anonymous sign-up. The **Admin Console** can hide scores, ban accounts, and work a flag queue. | About 2–3 days, 0 THB |
| **1: "replayable"** | During the TS port | Fixed-step sim, seeded named RNG streams, deterministic math module, input log, state hashes. The client uploads the replay with any score that would enter the top N. The Admin Console gets a **replay viewer** (watch the run). | Mostly discipline; ~2–4 extra days spread over the port |
| **2: "verified"** | When the daily challenge launches | **Async replay validation** in Node, run on GitHub Actions (free for public repos), for the daily board and the top N of each solo Season board. Season and daily ranks only count verified runs. | About 3–5 days, 0 THB |
| Not worth it | — | Client obfuscation and integrity checks, signing keys shipped in the client, synchronous re-simulation in edge functions, replay validation for co-op | — |

Co-op boards stay at Tier 0 plus manual review and are labelled lower-trust. Co-op cannot be replay-verified with the
current protocol (see §5).

---

## 1. Threat model for this game

What the codebase does today (`pixel-horde.html`):

- `const R=Math.random` (line 194) feeds both gameplay (spawns, crits, drops) and cosmetics (particles at line 755, bolt
  trails in `update`).
- The loop is `dt=clamp((now-last)/1000,0,0.05)` (line 1712), so it is variable-step. `hitstop` and `slowT` also scale time.
- Frame-rate-dependent constants are computed on the fly, e.g. knockback decay `Math.pow(0.02,dt)` in `casterAI`.
- The score is `stage*1e6+min(kills,999999)`, written **directly from the client** to `scores/<uid>` (lines 1050–1052).
  Anyone can write any number.

Because the sim is client-side, the client is untrusted. OWASP: validation "must be implemented on the server-side ...
as any JavaScript-based input validation performed on the client-side can be circumvented" ([OWASP Input Validation
Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)).

Realistic attackers for a free browser game, cheapest first:

1. **Forged request:** POST a score with curl or devtools without playing.
2. **Devtools edit before submit:** e.g. `kills=5e5; stage=30` in the console.
3. **Played-but-modified run:** god mode, damage ×100, or a speedhack (fake `performance.now`). All reported numbers
   are internally consistent, because the run really happened, just under different rules.
4. **Seed scumming:** restart until a lucky seed or event roll (Blood Moon, Dragon, Rival).
5. **Bots / tool-assisted play:** legitimate inputs produced by a program, slow-motion play, or searching a known seed
   offline.
6. **Co-op collusion:** a modified Host, or guests reporting inflated `[id, dmg]` packets.
7. **Account farming:** many anonymous accounts to get extra daily attempts or to spam.

---

## 2. Comparison

| Technique | Stops | Does NOT stop | Effort (solo admin) | Free-tier fit |
|---|---|---|---|---|
| **Server-side plausibility checks** (bounds vs Balance Config version, per-stage breakdown, wall-clock floor, outlier flags) | 1, 2, most of crude 3 (speedhack is caught by the wall-clock floor; absurd kills or levels are caught by bounds) | Careful fakes just above #1 that stay in bounds; god-mode runs with plausible numbers; bots | **S**, ~1 day. One Postgres `security definer` function plus bound formulas derived from `balance.ts` | Pure Postgres, free |
| **Per-Run tokens issued at run start** (server row with `run_id`, seed, Balance Config version, `started_at`; single-use) | 1 (no run means no score); resubmitting the same run; seed scumming on daily (server picks the seed); provides the **server clock** the wall-clock floor needs | 2 and 3: a token only proves a run *started*, not what happened in it | **S**, ~0.5–1 day | Postgres RPC via PostgREST, free; does not use Edge Function invocations |
| **Rate limiting** (runs per account/hour, one submit per run, sign-ups per IP, Turnstile) | Spam, scripted mass submissions, probing the hidden plausibility thresholds, cheap alt farming (7) | One patient cheater | **XS**, hours. Supabase anonymous sign-in already rate-limits at 30/h per IP; the rest is `count(*)` in the RPC | Free (Turnstile free and unlimited; Upstash optional) |
| **Replay validation** (seed + config + loadout + input log, re-simulated in Node, result and state hash compared) | 1, 2, **all of 3** (the server recomputes the result from inputs; god mode or damage edits change the outcome), 4 when combined with server seeds | 5 (bots and tool-assisted play produce valid inputs); 6 (guest damage is computed off-host); runs that were never uploaded | **L**: a determinism discipline across the whole sim, plus a runner. Cheap if built into the port, expensive to retrofit | **Not** inside Supabase Edge (2 s CPU) or Cloudflare Free (10 ms CPU). Fits GitHub Actions (free on public repos), async |
| **Manual review in Admin Console** (flag queue, top-N view, hide score, ban/shadow-ban, replay viewer) | Anything a human can see: obvious bots, impossible-looking replays, reported players. Final backstop for co-op | Does not scale; subtle cheats; costs admin time | **S–M**. Mostly part of the Admin Console anyway; the replay viewer is nearly free once replays exist | Free |

Precedents for this mix of cheap filters plus review at the platform level:

- **Google Play Games:** optional leaderboard score *limits* "can help you discard score submissions that are clearly
  fraudulent", plus automatic tamper protection and a `Players.hide` API
  ([Android Developers — Leaderboards](https://developer.android.com/games/pgs/leaderboards)).
- **Apple Game Center:** an optional **score range**; "any scores outside of this range are deleted"
  ([App Store Connect — Leaderboards reference](https://developer.apple.com/help/app-store-connect/reference/game-center/leaderboards/)).
  The admin can view the top 100, remove scores, and block players
  ([Manage scores and players](https://developer.apple.com/help/app-store-connect/configure-game-center/manage-scores-and-players)).
- **Steam:** a "Trusted" writes setting means scores "cannot be set by clients, and can only be set via
  SetLeaderboardScore WebAPI" from a server
  ([Steamworks — Leaderboards](https://partner.steamgames.com/doc/features/leaderboards)). This is the same idea as "no
  direct client writes, only via RPC".
- **Trackmania:** as documented by a community replay-validation tool, TM2 validated replays **only for top-10 records,
  overnight**, and removed invalid ones automatically; TM Turbo validated only the world record per platform
  ([BigBang1112/revalidate README](https://github.com/BigBang1112/revalidate); community source, medium trust). That
  supports "replay-validate only the top N, asynchronously".

---

## 3. Details per technique

### 3.1 Plausibility checks (Tier 0)

Each score row records the Balance Config version (per `CONTEXT.md`: a run locks to the version current at each stage
start). The bounds are therefore computed from the **exact numbers that were live**. Have the client submit a
**per-stage breakdown**, not just the final score: `[{stage, cfgVersion, gameTime, kills, lvAtEnd, events}]`. Each
stage row can then be checked independently.

Checks, cheapest and strongest first:

1. **Wall-clock floor (the most useful single check).** Stage durations are fixed: `min(150, 60+20(s−1))` s. The
   cumulative game time needed to *reach* stage N is 60, 140, 240, 360, 500, 650, 800, 950, 1100 s for N = 2..10. An
   honest client can never run game time faster than wall time, because `dt` is clamped at 0.05 s and pauses and
   level-ups only add wall time. So `server_now − run.started_at ≥ Σ duration(1..N−1)` must hold. This alone defeats
   speedhacks and "submit stage 30 after 10 seconds". It needs the Run token's server timestamp (§3.2).
2. **Hard bounds per stage from Balance Config:**
   - Max kills in stage *s* ≤ the integral of the spawn-rate formula at director max (2.4), Blood Moon ×2.3 if the stage
     was flagged special, and max `aliveMates`. Add swarm rings (`16+6s` every 10 s in Blood Moon or 18 s otherwise),
     split-slime children (×3 for splitter spawns), and a safety margin (e.g. ×1.5).
   - Max level ≤ the level reachable with all XP from max kills (XP curve `5+4lv+0.5lv²+1.4·max(0,lv−8)²`).
   - Stage ≤ a config max; the character must be unlocked on the account; `mode` must match how the run was started.
3. **Consistency checks:** the level must be consistent with kills (too high a level for too few kills means edited
   XP); special events must be allowed for that stage (Dragon only in Blood Moon at stage ≥3; Rival only on normal
   stages ≥2).
4. **Statistical outlier flags (not rejects):** kills/min or stage reached beyond, say, the 99.9th percentile of that
   Season and mode go into the Admin Console queue. They are not auto-deleted, so a skilled player is never silently
   punished.

**Stops:** forged and edited numbers that break any bound; speedhacks. **Does not stop:** a cheater who plays with god
mode (every number is real) or who submits a carefully chosen "just better than #1" score that stays in bounds.

### 3.2 Per-Run tokens (Tier 0)

- `start_run(mode, character, dailyId?)` is an RPC (a Postgres function via PostgREST, so no Edge Function
  invocations are used). It inserts `runs(id, account, season, mode, seed, cfg_version, build_id, started_at=now())` and
  returns `id` and `seed`.
- `submit_run(run_id, breakdown, replay?)` succeeds **once** per run, only for the owning account, only if the run is
  not expired (e.g. 3 h), and then applies §3.1.
- A plain DB row *is* the token; no HMAC is needed while Supabase is the authority. If a stateless token is ever
  wanted (e.g. a Cloudflare Worker in front), sign it with Web Crypto HMAC **on the server**. A signing key embedded in
  the JS bundle is readable by anyone and is worthless.
- **The server picks the seed** (`crypto.getRandomValues`). Players cannot choose or scum seeds for verified boards,
  and the daily seed stays secret until the day opens.

**Stops:** scores without a run, re-submits, fake timing; enables the wall-clock floor and server-chosen seeds. **Does
not stop:** lying about what happened inside a real run.

### 3.3 Rate limiting (Tier 0)

- Supabase anonymous sign-ins: "An IP-based rate limit is enforced at 30 requests per hour", and the docs "strongly
  recommend" invisible CAPTCHA or Cloudflare Turnstile to prevent abuse
  ([Supabase — Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)). Turnstile is free with
  "Unlimited challenges" ([Cloudflare Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)).
- Inside `start_run` and `submit_run`: reject if the account started more than ~20 runs in the last hour, or has an
  open daily run already. This is a `count(*)` over `runs`, with no extra infrastructure. Supabase also documents
  Upstash Redis rate limiting for Edge Functions
  ([Supabase — Rate limiting Edge Functions](https://supabase.com/docs/guides/functions/examples/rate-limiting); Upstash
  free tier is 500K commands/month per [Upstash pricing](https://upstash.com/pricing/redis)), but it is not needed at
  this scale.

**Stops:** spam, threshold probing, cheap alt farming. **Does not stop:** a single deliberate cheater.

### 3.4 Replay validation (Tiers 1–2)

**Idea:** the result of a deterministic sim is a pure function
`simulate(seed, cfgVersions, build, loadout, inputLog) → {score, stateHashes}`. The server re-runs it and compares.
This is the same "send only inputs" property that deterministic-lockstep networking relies on
([Gaffer On Games — Deterministic Lockstep](https://gafferongames.com/post/deterministic_lockstep/)). Factorio notes
that replays "would not be possible if the results changed each time"
([Factorio FFF #188](https://factorio.com/blog/post/fff-188)).

#### What determinism requires in *this* codebase

| Requirement | Why | Evidence |
|---|---|---|
| **Fixed timestep** (e.g. 60 Hz sim ticks with an accumulator; render interpolates) | With variable `dt`, the same inputs give different results at different frame rates. Today's `clamp(dt,0,0.05)` loop cannot be replayed. | "The behavior of your physics simulation depends on the delta time you pass in" ([Gaffer — Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/)) |
| **One seedable PRNG owned by the sim, split into named streams; cosmetics use a separate RNG** | `Math.random` cannot be seeded: the seed "cannot be chosen or reset by the user" ([MDN Math.random](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random)). Its algorithm is implementation-defined (ECMA-262 §Math.random; V8 uses xorshift128+ since Chrome 49 per [v8.dev](https://v8.dev/blog/math-random)). Today particles call `R()`, so changing particle counts *changes gameplay*. | Riot unified all game-affecting PRNGs into one XOR-shift API seeded per game ([Determinism in LoL: Implementation](https://www.riotgames.com/en/news/determinism-league-legends-implementation)) |
| **Only exactly-specified float ops in the sim** | ECMA-262 specifies `+ − × ÷` and `Math.sqrt` exactly (IEEE 754 roundTiesToEven; `Math.sqrt` returns "𝔽(the square root of ℝ(n))"). But `Math.sin/cos/atan2/hypot/pow/exp/...` return "an implementation-approximated Number value"; fdlibm is only "recommended (but not specified)" ([ECMA-262 source](https://github.com/tc39/ecma262/blob/main/spec.html), sections Number type and Math). MDN: "different browsers can give a different result. Even the same JavaScript engine on a different OS or architecture can give different results!" ([MDN Math](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math)). Firefox used platform libm for sin/cos/tan until an fdlibm option was added in 2021 ([Mozilla dev-platform intent](https://groups.google.com/a/mozilla.org/g/dev-platform/c/0dxAO-JsoXI/m/eEhjM9VsAgAJ); [SpiderMonkey newsletter FF 92–93](https://spidermonkey.dev/blog/2021/09/10/newsletter-firefox-92-93.html)). A Safari (JavaScriptCore) client and a Node (V8) validator must not depend on these functions. | Factorio hit exactly this: a replay "desynchronized immediately" on another OS because C++ trig functions differ; they wrote their own ([FFF #36](https://www.factorio.com/blog/post/fff-36)). Gaffer: cross-machine float determinism needs the same ops everywhere ([Floating Point Determinism](https://gafferongames.com/post/floating_point_determinism/)) |
| **One sim clock in ticks**, no `performance.now`/`Date.now` in the sim; `hitstop`/`slowT` as tick counters | Multiple clocks and float time accumulation diverge. | Riot had "8 clock instances with 6 unique implementations" and cites float precision loss when accumulating small deltas ([LoL: Unified Clock](https://www.riotgames.com/en/news/determinism-league-legends-unified-clock)) |
| **Deterministic iteration order** | Iteration keyed on pointer/identity diverges. JS `Map`/`Set`/arrays iterate in insertion order, which is fine; avoid sorting with inconsistent comparators, and avoid object-key order tricks with numeric-string ids. | Riot: `std::map` keyed by pointers caused divergences ([LoL: Implementation](https://www.riotgames.com/en/news/determinism-league-legends-implementation)) |
| **Inputs sampled once per tick and recorded**, including UI decisions (level-up pick index, chest stop tick, pause) | The replay must contain everything that affects the sim, and nothing else. The analog joystick must be quantized (e.g. int8 x/y) before the sim sees it. | Riot recorded app-level messages "in the order in which they're received" ([LoL: Implementation](https://www.riotgames.com/en/news/determinism-league-legends-implementation)) |
| **Versioned sim**: `build_id` + Balance Config version per stage stored with the run; the validator runs the matching build | A balance patch or bug fix changes outcomes for old replays. | — (follows from the above) |
| **Periodic state hashes** in the replay (e.g. every 60 ticks) | Find the first divergent tick instead of only "final score differs". | Factorio CRC per tick for desync debugging ([FFF #47](https://www.factorio.com/blog/post/fff-47)); Riot "Fixing Divergences" ([link](https://technology.riotgames.com/news/determinism-league-legends-fixing-divergences)) |

#### Re-simulation cost vs free serverless limits

- **Measured proxy (this machine, Node 22.14):** 320 enemies chasing, 80 projectiles × 320 enemies and 6 area effects ×
  320 distance checks per tick, 60 Hz, no rendering. This came to **≈70–75 µs per tick, ≈5.2–5.6 s CPU** for 75,000
  ticks (1,250 s ≈ a run to stage 10). The real sim does more (skills, hazards, pickups, boss AI), so budget **10–30 s
  CPU per long run**. Measure again with the Vitest harness after the port.
- **Supabase Edge Functions:** "Maximum CPU Time: 2s" per request, 150 s wall clock on Free
  ([Supabase — Edge Function limits](https://supabase.com/docs/guides/functions/limits)). **Too small.**
- **Cloudflare Workers Free:** "10 ms" CPU per request ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).
  **Far too small.**
- **Vercel Hobby:** 300 s max duration, 2 GB / 1 vCPU ([Vercel Functions limits](https://vercel.com/docs/functions/limitations)).
  It would fit, but it is a synchronous HTTP function and a second platform to run.
- **GitHub Actions:** "free for ... public repositories that use standard GitHub-hosted runners"; private repos on GitHub
  Free get 2,000 min/month ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).
  **Best fit.** A scheduled workflow (min interval 5 min, may be delayed at high load, and **auto-disabled after 60 days
  without repo activity** in public repos, per [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows))
  pulls `runs where status='pending_verify'` with the service key, re-simulates with `node`, and writes
  `verified|rejected|diverged@tick`. Even 100 top runs/day × 30 s = 50 min/day (~1,500 min/month) is free on a public repo and
  just fits the 2,000 min/month of a private one. Runner startup overhead counts too, so batch many replays per job.
- **Storage:** a 60 Hz movement log run-length-encoded (keyboard changes a few times per second) is roughly a few KB to
  ~15 KB per 20-minute run before gzip. Keep replays only for pending and top-N runs. The Supabase Free plan has 500 MB
  DB and 1 GB file storage, and **pauses projects after 1 week of inactivity**
  ([Supabase pricing](https://supabase.com/pricing)).

**Stops:** every "played under different rules" cheat (god mode, damage edits, fake kills, speedhack), and it makes
seeds meaningful. **Does not stop:** bots and tool-assisted play (inputs are valid; a known seed can even be searched
offline), co-op (§5), and anything that is not uploaded. Treat it as a **gate for the top N**, not for every run.

### 3.5 Manual review via the Admin Console (all tiers)

- A top-N view per board (Season × mode, daily). Flagged rows from §3.1 are listed first, with the per-stage breakdown.
- Actions: hide score, shadow-ban (the player still sees their own score), ban the Player Account, restore. This mirrors
  Game Center (remove, block, 30-day restore) and Play Games `Players.hide`.
- **Replay viewer:** once Tier 1 replays exist, the Admin Console can load the same sim build and *play back* a
  suspicious run at 4× speed. Bots and god mode become visible to a human long before automated validation exists. This
  is the best effort/value item in Tier 1.

---

## 4. A fair same-seed daily challenge

1. **Server-issued, unguessable seed** per UTC day (e.g. `HMAC(serverSecret, 'daily:'+date)` or a stored random row),
   revealed at 00:00 UTC. The same **Balance Config version is pinned for the whole day** (the daily keeps the version it
   opened with even if the admin patches mid-day).
2. **Normalized loadout:** a fixed (or per-day chosen) character, and **Meta Progression disabled** (no shop Power,
   Vigor, Second Wind, ...). Otherwise the daily ranks grind, not skill. Slay the Spire's Daily Climb uses a preselected
   character, fixed seed, and daily modifiers for everyone
   ([Mega Crit patch notes, Mar 2018](https://store.steampowered.com/news/posts/?feed=steam_community_announcements&appids=646570&enddate=1523579064)).
3. **Named RNG streams so the world does not depend on unrelated player choices:**
   - `spawn` for the spawn schedule, swarm types, and edge positions.
   - `events` for Blood Moon, Dragon, and Rival rolls, and their **pity counters, which must come from the seed, not the
     player's history** (today pity is "+6% per miss" of *that player*).
   - `levelup` for level-up offers, derived per level index so everyone at level *k* is offered the same cards, e.g.
     `rng(seed,'levelup',k)`.
   - `chest` for chest results.
   - `combat` for crits and damage jitter.
   - Cosmetics use a separate, unseeded RNG.

   Full independence is impossible because enemies react to the player, but this removes most divergence.
4. **One counted attempt** per Player Account per day (the first `start_run` for that daily counts; quitting counts as
   finished). Spelunky's daily is "one chance each day" and "everyone plays the same adventure"
   ([spelunkyworld.com/dailychallenge](https://spelunkyworld.com/dailychallenge/)). Alts are the loophole, so combine
   this with §3.3 (Turnstile, per-IP sign-up limits) and accept the residual risk.
5. **Solo only**, at least at first.
6. **Final ranking after verification:** the board is "live, unverified" during the day. After close, the verification
   job replays the top N and publishes the final ranking. The daily is the **best first target for replay validation**
   because seed, config, and loadout are all server-fixed, so the only thing to trust is the input log.

---

## 5. Co-op

Co-op is host-authoritative, but the Host is a player's browser, and guests "run their OWN skills locally, send
aggregated damage" (`CLAUDE.md`). A modified Host can fabricate everything; a modified guest can inflate damage. Replay
validation would need every participant's inputs *and* a deterministic guest sim with a shared RNG. That is a different
netcode (lockstep), not a v1 feature.

- Co-op boards get Tier 0. `start_run` registers the Host and the guest accounts; the plausibility bounds use the
  `aliveMates` spawn factor.
- **Cross-check:** each guest also submits its own summary (team kills and XP deltas it observed). If one participant
  disagrees with the others, the run is flagged. This catches a single cheater, but not a room where everyone colludes.
- Have the Host record guest damage packets in its input log anyway. That gives the Admin Console a viewable replay for
  review, even though it cannot be *verified*.
- Label co-op ranks as "unverified" in the UI.

---

## 6. What the TypeScript port should prepare now

These are cheap during the port and expensive to retrofit. Riot's LoL determinism work (clock unification, PRNG
unification, divergence hunting) was a multi-article project on a mature codebase.

1. **`core/rng.ts`:** a small seedable PRNG using 32-bit integer ops (`Math.imul`, `>>>`), which are exact in every
   engine, e.g. sfc32, xoshiro128\*\*, or PCG32. Make its state serializable. Add `stream(name)` to derive named streams
   from the run seed. **No `Math.random` anywhere under `src/core`, `src/systems`, or `src/data`.**
2. **Separate `fxRng`** for particles, shake, and damage-number jitter. This can stay `Math.random`.
3. **Fixed-step loop in `main.ts`:** `SIM_HZ` in `data/balance.ts` (60 or 30), an accumulator, and a max-steps-per-frame
   guard; render interpolates. Express timers (stage length, cooldowns, `hitstop`, `slowT`) in **integer ticks** where
   practical.
4. **`core/fmath.ts`:** deterministic `sin/cos/atan2/pow/exp` written only with `+ − × ÷` and `Math.sqrt` (fdlibm
   ports, or tables for angles). Use `hypot(x,y) = Math.sqrt(x*x+y*y)`. Precompute per-tick constants such as the
   knockback decay `0.02^(1/SIM_HZ)`. Add an ESLint `no-restricted-properties` rule banning `Math.random`, `Math.sin`,
   `Math.cos`, `Math.tan`, `Math.atan2`, `Math.hypot`, `Math.pow`, `Math.exp`, `Math.log`, `Date.now`, and
   `performance.now` in sim folders.
5. **Input boundary:** the sim reads `InputFrame {mx:int8, my:int8}` per tick, never `keys` or `joy` directly. UI
   decisions enter as `Command {tick, kind:'pick'|'chestStop'|'pause', arg}`. Keep an **input recorder** always on (RLE),
   so every run can export a replay.
6. **Headless sim:** no DOM or canvas imports in the sim. Expose
   `simulate(seed, cfgVersions, build, loadout, inputs) → {score, breakdown, hashes}`. The Vitest harness from
   `CLAUDE.md` (Testing) and the server validator are then the **same code**.
7. **State hash** (FNV-1a over quantized positions, HP, RNG state) every 60 ticks, stored in the replay.
8. **Record** `build_id`, the Balance Config version per stage, character, and Meta Progression levels in the run header.
9. **One `scoreOf(state)`** in the sim that produces the score and the per-stage breakdown (not the UI).
10. **Determinism test in CI:** a golden replay test in Vitest, plus the same replay run in Chromium, Firefox, and
    WebKit (e.g. Playwright), asserting equal hashes.
11. **Net layer outside the sim:** guest damage becomes a `Command`, so co-op runs are at least recordable.
12. **Remove the direct client write to `scores`** (current lines 1050–1052); only `submit_run` may write.

---

## 7. Recommendation

Tier 0 at leaderboard launch, Tier 1 inside the TS port, Tier 2 when the daily ships. That order follows from the
evidence:

- **Tier 0 at leaderboard launch:** Run tokens with server-picked seeds and server timestamps, plausibility checks
  against the Balance Config version (with the wall-clock floor), Postgres rate limits with Turnstile, and Admin
  Console moderation. This removes the cheap cheats (forged, edited, sped-up) that make up most leaderboard abuse. It
  costs about 2–3 days and 0 THB, and needs nothing from the game except a per-stage breakdown.
- **Tier 1 inside the TS port:** the determinism checklist in §6, input logs, state hashes, and an Admin Console replay
  viewer. This is almost free now, and it is the only thing that keeps "played under different rules" cheats
  detectable later. Without it, Tier 2 is impossible.
- **Tier 2 when the daily ships:** async replay validation of the daily board and each solo Season's top N, on GitHub
  Actions. Only verified runs get final rank or the top-10 display.
- **Do not** try synchronous re-simulation on Supabase or Cloudflare (CPU limits of 2 s and 10 ms). Do not spend time on
  client obfuscation or embedded keys; they only slow down a determined cheater and stop nobody. Do not attempt co-op
  replay validation with the current guest-side-damage protocol; co-op stays "unverified" with cross-checks and review.

## Sources (checked 2026-09-24)

- ECMA-262 source, Number type rounding (roundTiesToEven), `Math.sqrt` exact, `Math.sin`/`Math.hypot`
  "implementation-approximated", fdlibm "recommended (but not specified)", `Math.random` implementation-defined:
  https://github.com/tc39/ecma262/blob/main/spec.html (rendered: https://tc39.es/ecma262/)
- MDN, Math (precision is implementation-dependent): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math
- MDN, Math.random (cannot be seeded; not crypto-secure): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
- V8 blog, "There's Math.random(), and then there's Math.random()": https://v8.dev/blog/math-random
- Mozilla dev-platform, "Intent to Implement: Use fdlibm for Math.cos, Math.sin, and Math.tan" (2021): https://groups.google.com/a/mozilla.org/g/dev-platform/c/0dxAO-JsoXI/m/eEhjM9VsAgAJ
- SpiderMonkey Newsletter, Firefox 92–93: https://spidermonkey.dev/blog/2021/09/10/newsletter-firefox-92-93.html
- Gaffer On Games, Fix Your Timestep!: https://gafferongames.com/post/fix_your_timestep/
- Gaffer On Games, Floating Point Determinism: https://gafferongames.com/post/floating_point_determinism/
- Gaffer On Games, Deterministic Lockstep: https://gafferongames.com/post/deterministic_lockstep/
- Riot Games, Determinism in League of Legends, Implementation / Unified Clock / Fixing Divergences:
  https://www.riotgames.com/en/news/determinism-league-legends-implementation,
  https://www.riotgames.com/en/news/determinism-league-legends-unified-clock,
  https://technology.riotgames.com/news/determinism-league-legends-fixing-divergences
- Factorio Friday Facts #36 (custom trig for cross-OS replays): https://www.factorio.com/blog/post/fff-36
- Factorio Friday Facts #47 (CRC): https://www.factorio.com/blog/post/fff-47 ; #188 (desync): https://factorio.com/blog/post/fff-188
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- Android Developers, Play Games Services leaderboards (limits, tamper protection): https://developer.android.com/games/pgs/leaderboards
- Apple, App Store Connect leaderboard reference (score range): https://developer.apple.com/help/app-store-connect/reference/game-center/leaderboards/
- Apple, Manage scores and players: https://developer.apple.com/help/app-store-connect/configure-game-center/manage-scores-and-players
- Steamworks, Leaderboards (Trusted writes): https://partner.steamgames.com/doc/features/leaderboards
- Trackmania replay validation notes (community tool README, medium trust): https://github.com/BigBang1112/revalidate
- Supabase, Edge Function limits: https://supabase.com/docs/guides/functions/limits
- Supabase, Pricing (Free plan): https://supabase.com/pricing
- Supabase, Anonymous sign-ins (rate limit, CAPTCHA): https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase, Rate limiting Edge Functions: https://supabase.com/docs/guides/functions/examples/rate-limiting
- Upstash Redis pricing: https://upstash.com/pricing/redis
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Turnstile plans: https://developers.cloudflare.com/turnstile/plans/
- Vercel Functions limits: https://vercel.com/docs/functions/limitations
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub Actions, schedule event: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Spelunky Daily Challenge: https://spelunkyworld.com/dailychallenge/
- Slay the Spire patch notes (Daily Climb leaderboards and mods, Mar 2018): https://store.steampowered.com/news/posts/?feed=steam_community_announcements&appids=646570&enddate=1523579064
- Local measurement: a synthetic Node 22.14 benchmark (320 enemies, 80 projectiles, 6 area effects, 60 Hz, 75,000
  ticks). This is a rough proxy, not the real sim; re-measure after the port.
