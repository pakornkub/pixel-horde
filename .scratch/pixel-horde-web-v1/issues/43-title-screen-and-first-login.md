# 43: Title screen, first-login flow and Gemini backgrounds

**What to build:** The title screen has a big Play button with the animated Hero, "continue from Chapter N" when a save exists, menus (Hero+Weapon, Co-op, leaderboard, Shop, collection, settings), name + Google link, and admin announcements. Two Gemini-generated pixel-art backgrounds (16:9 and 9:16) with code-driven sparkle adapt to desktop and mobile. Google linking is suggested after the 3rd Run and first victory.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 11 (Link Google and merge accounts); 12 (Feature flags, maintenance mode, minimum build and announcements); 31 (Suspend and resume a Run)

**Status:** done — owner reviewed the Gemini backgrounds in-game and decided to keep the live procedural tile scene instead; `TITLE_BG` stays empty on purpose

- [x] Backgrounds are WebP ≤ ~300 KB each with a solid color while loading
- [x] Owner chooses among several generated backgrounds (decision: keep the procedural scene, no static image)
- [x] Layout works in portrait mobile and landscape desktop

## Notes (implementation)

- Title (`apps/game/index.html` `#ovTitle`, `apps/game/src/ui/title.ts`): logo, tagline, animated Hero (tap = Hero panel) with "Hero · Weapon" label, "Continue: Chapter N" when a save exists, big PLAY, a 3×2 menu (Hero & Weapon, Co-op — disabled "coming soon" until tickets 41/42, Leaderboard, Upgrades, Collection, Settings), announcements, and a footer with wallet/best, name + rename, language and the Google link hint.
- Hero & Weapon moved to its own panel (`#ovHero`: how-to-play text, Heroes, Weapon, Heart Crack, keys).
- Background: until pictures are chosen, the live Greenvale tile scene drifts slowly with code-drawn sparkles. To use the Gemini pictures, put them in `apps/game/public/bg/` and set `TITLE_BG` in `apps/game/src/ui/title.ts` (`wide` 16:9, `tall` 9:16); a solid colour shows while one loads, and the right one is picked by orientation.
- Google linking is suggested on the Run-end screen after the 3rd Run **or** the first victory (the title hint shows whenever the account is anonymous and online).
- Daily challenge has no menu entry yet (no daily mode ticket in v1 scope).
- Test: `tests/browser/title.spec.ts` (landscape + portrait, no horizontal scroll, Hero panel).
- **Owner:** generate several 16:9 and 9:16 pixel-art backgrounds (Gemini), choose one of each, export WebP ≤ ~300 KB.

**Update 2026-09-26:** the title fits small phones (a `max-height: 720px` step), shows a "New update! {date}" notice with the latest patch note linking to the website Updates page (`apps/game/src/ui/update-note.ts`), has a Feedback button, and in in-app browsers explains that Google sign-in is blocked (Open in Chrome / Copy game link, `apps/game/src/platform/inapp.ts`). `TITLE_BG` is still empty, so the backgrounds are still with the owner.

**Update 2026-09-28:** owner picked the "daytime crossroad meadow" style from 3 Gemini-generated 16:9 candidates (2026-09-28, via the game Q&A Operator session). Final WebPs (`title-wide.webp` 87 KB, `title-tall.webp` 105 KB) were wired into `TITLE_BG` and verified in-browser at desktop and mobile widths (no layout shift or horizontal scroll).

**Update 2026-09-28 (later same day):** after seeing the wired background live in-game, the owner reversed the call — the procedural Greenvale tile scene (moving camera + code-drawn sparkles) reads as much more consistent with the game's own pixel art than the static Gemini image. Reverted `TITLE_BG.wide`/`.tall` to `null` and removed the two WebP files from `apps/game/public/bg/`; the title keeps the live tile-scene background going forward. Ticket closed out on that final decision — no outstanding Gemini-background work remains for v1.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
