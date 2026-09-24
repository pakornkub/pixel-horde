# 33: Sprite Lab and sprite files

**What to build:** A developer-only Sprite Lab lets the owner paint sprites on a grid with a Realm palette, preview animation at game scale on Realm ground, and copy rows in/out. All sprites move out of code into per-Realm sprite files with a validator.

**Blocked by:** 01 (Workspace scaffold and the original game running on Cloudflare Pages)

**Status:** done — the owner reviews art in the Lab

- [x] Validator fails on unequal row lengths or characters outside the palette
- [x] Existing sprites load from the new files with no visual change
- [x] Sprite Lab is excluded from the production build

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** sprite files `apps/game/src/sprites/lumora/*.ts`, format + validator `apps/game/src/sprites/types.ts`, builder `apps/game/src/render/sprites.ts`, Lab `apps/game/sprite-lab.html` + `src/lab/` (`npm run lab`, see `docs/sprite-lab.md`). A pixel-by-pixel comparison of all 33 frames against the old in-code sprites showed 0 differences. Boss crowns now use their own palette char `Y` (same pixels as before).
