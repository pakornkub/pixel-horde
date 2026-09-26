# Deploying the game

The game is a static Vite build (`npm run build` → `apps/game/dist`) hosted on Cloudflare Pages
(project `pixel-horde`). `.github/workflows/deploy-pages.yml` deploys on every push:

- push to `main` → production (`https://pixel-horde.pages.dev`)
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
npm run build
npx wrangler login          # or set CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
npx wrangler pages deploy apps/game/dist --project-name=pixel-horde --branch=main
```

## Local development

```sh
npm install
npm run dev       # http://localhost:5173
npm run build && npm run preview
```

## Database (Supabase)

The live project (`jqvgmkhzdhjreikjqhxt`) has every migration in `supabase/migrations/` applied,
through `20260925000012_shield_pickup` (patches `shared.loot`) and `20260926000012_coop_feedback`
(account suspension + the `shared.coop` part of the config schema; applied as `coop_feedback`),
and `20260926000014_reward_switches` (applied as `reward_switches`).
Migration 0004 went in without its large `config_schema` insert,
which was loaded separately in chunks (`config_schema_load_staging` / `config_schema_load_finish`
in the project's migration history); the row is byte-identical to the one in the file.

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
