# 06: Thai and English text

**What to build:** Players can switch the whole game between Thai and English. All UI, banners, skill descriptions and future story text come from the i18n package through `t(key)`.

**Blocked by:** 01 (Workspace scaffold and the original game running on Cloudflare Pages)

**Status:** ready-for-agent

- [ ] Every current Thai string is moved to a Thai dictionary with an English translation
- [ ] Language choice persists on the device and defaults from the browser language
- [ ] A check fails the build if any key is missing in either language
- [ ] Thai renders with the existing Thai font; English with the pixel font

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
