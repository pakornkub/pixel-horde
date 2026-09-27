# 55: Ending art and "what you unlocked" after the first win

**What to build:** Owner request (2026-09-27): after the first Run is won, the ending (`#ovEnding`, today three lines of
text) gets pictures made with Gemini, and a screen that lists what the win unlocked.

Today's unlocks after beating Umbra: Heart Crack tier 1 (then 2, 3), Endless (only from the victory screen), a missing
Weapon (or 500 Gold), achievements / titles. New ones would come from 56 (special shop) and 57 (5th Hero).

Proposed:
- 3–4 story panels (16:9 WebP ≤ 300 KB, a 9:16 crop for phones) under `apps/game/public/ending/`, generated with the
  image-generation skill in the game's pixel style; the raw renders stay in the git-ignored `generated-images/`.
  Note: the v1 spec said the title backgrounds are the only AI art; this extends that (owner decision).
- An "Unlocked" page after the story: icon + one line per unlock, only what this win really unlocked
  (first win vs a later win on a higher Heart Crack tier).
- A title-screen Endless button after the first win (the sim already has `mode: 'endless'`).

**Blocked by:** —

**Status:** needs-triage
