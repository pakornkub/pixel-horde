# 33: Sprite Lab and sprite files

**What to build:** A developer-only Sprite Lab lets the owner paint sprites on a grid with a Realm palette, preview animation at game scale on Realm ground, and copy rows in/out. All sprites move out of code into per-Realm sprite files with a validator.

**Blocked by:** 01 (Workspace scaffold and the original game running on Cloudflare Pages)

**Status:** ready-for-agent

- [ ] Validator fails on unequal row lengths or characters outside the palette
- [ ] Existing sprites load from the new files with no visual change
- [ ] Sprite Lab is excluded from the production build

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
