# 06: Thai and English text

**What to build:** Players can switch the whole game between Thai and English. All UI, banners, skill descriptions and future story text come from the i18n package through `t(key)`.

**Blocked by:** 01 (Workspace scaffold and the original game running on Cloudflare Pages)

**Status:** done

- [x] Every current Thai string is moved to a Thai dictionary with an English translation
- [x] Language choice persists on the device and defaults from the browser language
- [x] A check fails the build if any key is missing in either language
- [x] Thai renders with the existing Thai font; English with the pixel font

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `packages/i18n` (`th.json`, `en.json`, `t()`, `setLang`, `detectLang`, `checkCompleteness`); `npm run check -w @pixel-horde/i18n` runs before every game build and fails on a missing key or mismatched `{placeholders}`. World content keys are namespaced `lumora.*`. Language lives in device settings (`pixelhorde-settings`), toggled on the title screen. The Alchemist description now says −10% cooldown (the code always gave 10%; the old text said 12%). The artifact-only co-op/leaderboard boxes were removed from the title screen (rebuilt in tickets 10 and 41).
