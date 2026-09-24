# 43: Title screen, first-login flow and Gemini backgrounds

**What to build:** The title screen has a big Play button with the animated Hero, "continue from Chapter N" when a save exists, menus (Hero+Weapon, Co-op, leaderboard, Shop, collection, settings), name + Google link, and admin announcements. Two Gemini-generated pixel-art backgrounds (16:9 and 9:16) with code-driven sparkle adapt to desktop and mobile. Google linking is suggested after the 3rd Run and first victory.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 11 (Link Google and merge accounts); 12 (Feature flags, maintenance mode, minimum build and announcements); 31 (Suspend and resume a Run)

**Status:** ready-for-agent

- [ ] Backgrounds are WebP ≤ ~300 KB each with a solid color while loading
- [ ] Owner chooses among several generated backgrounds
- [ ] Layout works in portrait mobile and landscape desktop

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
