# Deploying the website and the game

One Cloudflare Pages project (`pixel-horde`) serves both static Vite builds:

| Path | What | Built by |
|---|---|---|
| `/` | official website (`apps/site`) | `npm run build:site` → `apps/site/dist` |
| `/play/` | the game (`apps/game`) | `npm run build` → `apps/game/dist` |

`npm run build:pages` runs both builds and `scripts/assemble-pages.mjs`, which puts them together in
`dist/pages` and writes the root `_headers` / `_redirects` (Pages only reads them at the root).
Old links to the game at `/` keep working: the site's `index.html` forwards `?join=`, `?room=`, `?debug=`,
`?offline`, Google sign-in returns and `#draftcfg=` to `/play/`, and `/privacy.html` redirects to `/play/privacy.html`.

`.github/workflows/deploy-pages.yml` deploys on every push:

- push to `main` → production (`https://pixel-horde.pages.dev`, game at `https://pixel-horde.pages.dev/play/`)
- push to any other branch → preview deploy (`https://<branch>.pixel-horde.pages.dev`)

## One-time setup (owner)

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token** → template
   **"Edit Cloudflare Workers"** (or a custom token with *Account → Cloudflare Pages → Edit*).
2. Copy your **Account ID** (Workers & Pages overview, right sidebar).
3. GitHub repo → **Settings → Secrets and variables → Actions** → add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Push any commit (or run the workflow manually). The first run creates the Pages project.

Until both secrets exist the workflow still builds (so a broken build shows red) but skips the deploy step.

## Manual deploy from a machine

```sh
npm ci
npm run build:pages
npx wrangler login          # or set CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
npx wrangler pages deploy dist/pages --project-name=pixel-horde --branch=main
```

## Local development

```sh
npm install
npm run dev       # game    http://localhost:5173
npm run dev:site  # website http://localhost:5180 (its PLAY buttons open the game dev server)
npm run build && npm run preview
npm run build:pages && npx vite preview --outDir dist/pages   # the deployed layout: / and /play/
```

Website screenshots (`apps/site/public/shots`, also used by the README) are real captures:

```sh
npm run build && npx vite preview apps/game --port 4190   # leave running
npm run shots        # offline + god mode bot; needs Edge or Chrome installed (PW_CHANNEL=chrome)
```

## Database (Supabase)

The live project (`jqvgmkhzdhjreikjqhxt`) has every migration in `supabase/migrations/` applied,
through `20260925000012_shield_pickup` (patches `shared.loot`) and `20260926000012_coop_feedback`
(account suspension + the `shared.coop` part of the config schema; applied as `coop_feedback`),
`20260925000013_mob_skill_switches` (applied as `mob_skill_switches`),
`20260926000014_reward_switches` (applied as `reward_switches`)
and `20260926000015_player_feedback` (player Feedback button; applied as `player_feedback`).
Migration 0004 went in without its large `config_schema` insert,
which was loaded separately in chunks (`config_schema_load_staging` / `config_schema_load_finish`
in the project's migration history); the row is byte-identical to the one in the file.

`20260927000016_balance_pass_fields` (new `shared.awaken` / `shared.skills.hawk` fields) is applied as
`balance_pass_fields`; the 2026-09 balance pass (`packages/config/src/balance-pass.ts`) is published as config v4
(v3 + those changes).
`20260927000017_preset_knobs` (difficulty presets in `shared.presets`) is applied as `preset_knobs`.
`20260927000018_config_reports` (a report per config version; `publish_config(p_data, p_note, p_report)`) is applied as
`config_reports`; v4 carries the 2026-09 report.
`20260927000019_changelog` (patch notes: `changelog` table, `get_changelog` for the website, Admin RPCs; `publish_config`
gains `p_changelog` and always writes a `balance` entry) is applied as `changelog`, backfilled with 18 entries (PR #1–#15, config v1–v4).
`20260927000021_work_items` (Admin → งานแก้ไข: `work_items` table, `agent_report` for the daily triage routine, Admin RPCs)
is applied as `work_items`. Number 0020 is unused.
`20260927000022_bench_passives` (switch `shared.bench.passives`: passives can use the Bench) is applied as `bench_passives`.
`20260928000023_balance_followup_fields` (new `shared.awaken.{keep,slots}`, `shared.scaling.{lvCapBase,lvCapPerCh}`,
`shared.skills.hawk.{guardN,guardR}`, `shared.heroes.ranger.hp`) is applied as `balance_followup_fields` (it shows
twice in the migration history: two sessions applied the same idempotent SQL 25 s apart; the schema is identical).
`20260928000024_spawn_wave_fronts` (new `shared.spawn.front*` / `lull*` / `pincer*` and `shared.director.stageReset`)
is applied via the SQL editor (not in the migration history); the live `config_schema` has those fields. Their defaults
are neutral, so wave fronts stay off until a config version sets them.
`20260929000025_awakened_forms_fields` (new `shared.awaken.form/mark`, `skills.lance.aim`, Shield Bash and the
Awakened-form fields `skills.{shield,sigil,hawk,flask}.awk.*`; patches only `awaken` and those five skills) is applied.
Publish pass 2026-09d only after this code is deployed: an older client strips the unknown fields.
`20260930000030_base_difficulty` (ticket 48: drops `shared.presets`, adds `shared.difficulty`) is applied. Published
versions without the group get its defaults (the full old Relaxed preset, Gold ×0.2), so the live game got easier with the
client deploy of PR #34, without a publish.
Published configs: v4 = pass 2026-09, v5 = pass 2026-09b, v6 = pass 2026-09c (Director max 1.6, rise 0.04). Passes are
loaded onto one draft in Admin → Balance (they stack, oldest first) and published from there.

- New changes always go in a **new** migration file; never edit one that is already applied.
  `npm run db:sync-seeds` rewrites the JSON inside 0002/0004, so it is only for local experiments now.
- When the Balance Config schema (`packages/config`) gains or changes fields, update the live copy
  in a new migration, otherwise `publish_config` rejects the new fields. Patch only the object you
  changed (so parallel branches do not overwrite each other), taking it from
  `npx tsx scripts/config-json.ts schema`:
  `update public.config_schema set schema = jsonb_set(schema, '{properties,shared,properties,<object>}', $j$<its JSON>$j$::jsonb) where id = 1;`
  New defaults for players are then published from the Admin Console as a new config version.

Keep-alive: `workers/keepalive` pings `get_live_state` once a day (03:17 UTC) so the Free project is
never paused for inactivity. The same workflow deploys it on every push to `main`; open its
`workers.dev` URL once to trigger a ping by hand (`ok` = working).

Daily triage: a Claude Code cloud routine reads `client_errors` and player `feedback` every morning, opens
`triage/<date>-<slug>` PRs for clear bugs and reports to Admin → งานแก้ไข (`work_items`, via `agent_report`).
Its instructions are [docs/agents/triage-routine.md](agents/triage-routine.md).

## Balance AI (Admin Console → ผู้ช่วย AI)

Supabase Edge Function `supabase/functions/balance-ai` calls Gemini with the owner's API key.
It only answers admins (it calls `admin_configs()` as the signed-in user) and never publishes:
proposals go to the Tuning Lab draft, and the owner publishes from there.

1. Supabase → **Edge Functions → Secrets** → add `GEMINI_API_KEY` (optional `GEMINI_MODEL`,
   default `gemini-3.8-flash`).
2. Deploy: `supabase functions deploy balance-ai` (or the Supabase MCP `deploy_edge_function`),
   JWT verification on. Already deployed to the live project; redeploy after changing it.

## Admin Console

`apps/admin` deploys to a second Pages project, `pixel-horde-admin` (same workflow).
Protect it with **Cloudflare Zero Trust → Access → Applications → Add → Self-hosted**:
domain `pixel-horde-admin.pages.dev` (and `*.pixel-horde-admin.pages.dev` for previews),
policy "Allow" → your email only. The database still checks the admin role on every call.

Make your account an admin once the migrations are applied (Supabase SQL editor):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

Sign in to the Admin with Google (same account you linked in the game) or with an email magic
link. Try it without any backend at `…/?demo` (in-memory sample data).

Local: `npm run dev -w @pixel-horde/admin` → http://localhost:5174/?demo

## Co-op room worker (tickets 41–42)

Co-op rooms run on a Cloudflare Worker with one Durable Object per room (`workers/room`).

1. With the two Cloudflare secrets in place, every push to `main` deploys it (`deploy-pages.yml` → "Deploy co-op room worker").
   The first deploy prints its URL, e.g. `https://pixel-horde-room.<your-subdomain>.workers.dev`.
2. Add a GitHub **repository variable** (Settings → Secrets and variables → Actions → Variables) named `ROOM_URL`
   with that URL written as `wss://pixel-horde-room.<your-subdomain>.workers.dev`. The next build turns the Co-op
   button on, and the workflow smoke-tests the live room (`scripts/room-smoke.mjs`).
3. Free plan: about 6–12 hours of 4-player co-op per day; when the daily allowance is used up the game says
   "co-op full" until 07:00 Thai time.

Local test: `cd workers/room && npx wrangler dev --port 8787`, then open the game with `?room=ws://127.0.0.1:8787`
in two browser windows (host: Co-op → Create room; guest: the invite link).
