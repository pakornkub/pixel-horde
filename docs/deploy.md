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
