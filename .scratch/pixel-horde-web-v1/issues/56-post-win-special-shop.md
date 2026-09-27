# 56: Special shop after the first win (hosts the Weapon forge, cosmetics, …)

**What to build:** Owner request (2026-09-27): a special shop that opens after the first win, built on systems the game
already has: upgrade Weapons, fashion / outfits, and more.

This is the gate and the home, not the items: the items are the balance audit's Gold-sink tickets
**49 (Weapon forge)** and **51 (cosmetics)**, possibly **50 (Hero Mastery)**. This ticket decides which of them wait for
the first win and puts them behind one "special shop" entry that appears (and is announced on the unlock screen, 55)
once the player has beaten Umbra.

Open questions for the owner:
- Which of 49 / 50 / 51 are locked until the first win, and which are open from the start?
- One shop screen with tabs (Forge / Outfits / Mastery) or separate buttons on the title?
- Server check: the RPCs of 49–51 refuse purchases before a win (`stats.heroesWon` non-empty or `heartCrack >= 1`).

**Blocked by:** 55 (the unlock screen announces it), 49, 51

**Status:** needs-info
