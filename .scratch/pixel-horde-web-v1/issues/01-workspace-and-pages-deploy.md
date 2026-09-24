# 01: Workspace scaffold and the original game running on Cloudflare Pages

**What to build:** Players can open a public Cloudflare Pages URL and play the current game exactly as today. The repo becomes an npm-workspaces monorepo with the game app built by Vite + TypeScript; the original game code is moved in with no gameplay change. The `window.claude` features degrade gracefully (co-op/leaderboard hidden, no errors).

**Blocked by:** None (can start immediately)

**Status:** in-progress — code done; live deploy waits for the owner to add Cloudflare secrets (docs/deploy.md)

- [x] Workspace layout matches `CLAUDE.md` → Structure (game app, admin app, sim/config/i18n packages, room worker, supabase folder), even if some are empty stubs
- [x] `npm run dev` serves the game locally; `npm run build` produces a static bundle
- [ ] The build deploys to a Cloudflare Pages project with preview deploys per branch
- [x] Gameplay, sprites, sound, meta progression (localStorage) behave as in `pixel-horde.html`
- [x] No console errors when `window.claude` is absent

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
