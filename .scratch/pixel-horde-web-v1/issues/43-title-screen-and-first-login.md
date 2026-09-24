# 43: Title screen, first-login flow and Gemini backgrounds

**What to build:** The title screen has a big Play button with the animated Hero, "continue from Chapter N" when a save exists, menus (Hero+Weapon, Co-op, leaderboard, Shop, collection, settings), name + Google link, and admin announcements. Two Gemini-generated pixel-art backgrounds (16:9 and 9:16) with code-driven sparkle adapt to desktop and mobile. Google linking is suggested after the 3rd Run and first victory.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 11 (Link Google and merge accounts); 12 (Feature flags, maintenance mode, minimum build and announcements); 31 (Suspend and resume a Run)

**Status:** needs-info — code done; waiting for the owner to generate/choose the two Gemini backgrounds

- [x] Backgrounds are WebP ≤ ~300 KB each with a solid color while loading
- [ ] Owner chooses among several generated backgrounds
- [x] Layout works in portrait mobile and landscape desktop

## Notes (implementation)

- Title (`apps/game/index.html` `#ovTitle`, `apps/game/src/ui/title.ts`): logo, tagline, animated Hero (tap = Hero panel) with "Hero · Weapon" label, "Continue: Chapter N" when a save exists, big PLAY, a 3×2 menu (Hero & Weapon, Co-op — disabled "coming soon" until tickets 41/42, Leaderboard, Upgrades, Collection, Settings), announcements, and a footer with wallet/best, name + rename, language and the Google link hint.
- Hero & Weapon moved to its own panel (`#ovHero`: how-to-play text, Heroes, Weapon, Heart Crack, keys).
- Background: until pictures are chosen, the live Greenvale tile scene drifts slowly with code-drawn sparkles. To use the Gemini pictures, put them in `apps/game/public/bg/` and set `TITLE_BG` in `apps/game/src/ui/title.ts` (`wide` 16:9, `tall` 9:16); a solid colour shows while one loads, and the right one is picked by orientation.
- Google linking is suggested on the Run-end screen after the 3rd Run **or** the first victory (the title hint shows whenever the account is anonymous and online).
- Daily challenge has no menu entry yet (no daily mode ticket in v1 scope).
- Test: `tests/browser/title.spec.ts` (landscape + portrait, no horizontal scroll, Hero panel).
- **Owner:** generate several 16:9 and 9:16 pixel-art backgrounds (Gemini), choose one of each, export WebP ≤ ~300 KB.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
