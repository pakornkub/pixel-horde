# supabase/

Migrations, RLS policies, RPCs and pg_cron jobs for the Supabase project `pixel-horde`
(id `jqvgmkhzdhjreikjqhxt`, ap-southeast-1).

- `migrations/` — applied in filename order (`supabase db push`, or the Supabase MCP `apply_migration`).
- `tests/*.test.sql` — pgTAP tests. On Supabase: `supabase test db`. In CI they run inside PGlite
  with a tiny pgTAP shim (`tests/db/*.sql`, `tests/db.test.ts`), so every push checks them.
- `profanity.json` — basic Thai/English nickname word list shared by the SQL filter and the client
  (a test keeps them in sync).

## Rules
- Players never write tables: every table has RLS; writes go through `SECURITY DEFINER` RPCs.
- Every gameplay RPC starts with `public.assert_session()` → raises `SESSION_REPLACED` when the JWT's
  `session_id` is not the account's latest `claim_session()` (latest login wins).

## One-time project settings (dashboard, owner)
1. **Authentication → Sign In / Providers → Allow anonymous sign-ins: ON.**
2. **Authentication → Rate Limits**: raise "anonymous sign-ins per hour" (e.g. 300).
3. **Authentication → Attack Protection → CAPTCHA**: Cloudflare Turnstile with the Turnstile
   *secret* key; put the *site* key in the GitHub repository variable `TURNSTILE_SITE_KEY` (the build passes it on as
   `VITE_TURNSTILE_SITE_KEY`). Add the variable and let one deploy finish BEFORE switching CAPTCHA on,
   otherwise anonymous sign-in is refused and players fall back to offline.
4. **Authentication → Sign In / Providers → Google**: enable, paste the Google Cloud OAuth client ID
   and secret (authorised redirect URI = the one Supabase shows). Also turn on
   **"Allow manual linking"** (Authentication → Sign In) so anonymous players can link Google.
   Add the game URLs (`https://pixel-horde.pages.dev/play/`, `https://pixel-horde.pages.dev/**` for previews and
   older links, itch.io) to **URL Configuration → Redirect URLs** (the game sends players back to `…/play/` after
   Google), and set **Site URL** to `https://pixel-horde.pages.dev` (not `localhost`): a
   redirect that is not allowed falls back to the Site URL.
   Without "Allow manual linking" the auth log shows `manual_linking_disabled` and the game says so.
