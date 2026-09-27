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

**Owner decisions (2026-09-27):**
- Title Endless = an Endless Run from Chapter 1: Greenvale, then a random Realm every Chapter (no route choice, no Umbra),
  until you fall. No main Score (not on the Solo board); the Endless Score counts from Chapter 9, exactly like Endless
  after Umbra, so both share the Endless board fairly. No server change (the Run is submitted as a solo Run with score 0).
- Story: the first win shows all 4 pictures (tap / Next, Skip); later wins open on the "Unlocked" page over picture 4,
  with "Watch the story again".
- Pictures: (1) Umbra shatters, the last shard breaks free (2) the Heart beats whole, light over every Realm ("Lumora is
  saved") (3) the Kings wake up embarrassed, the four Heroes celebrate (4) a new red crack in the Heart. Drafts approved.

**Built:**
- `apps/game/public/ending/p1–p4-{wide,tall}.webp` (Gemini, 1376×768 / 768×1376, 51–163 KB); raw renders in `generated-images/ending/`.
- `apps/game/src/ui/unlocks.ts` (pure rules + test), `ui/ending.ts` (story, Unlocked page, `winUnlocks()` read before the win is
  recorded, `?debug=ending|ending:later`). Heart Crack line uses `heartCrack.maxTier` when the config has it (pass 2026-09e), else 3.
  Special shop line (56) shows when `#specialBtn` exists; 5th Hero line (57) when `HERO_IDS` has `necromancer` and it is not owned.
- Sim: `mode: 'endless'` starts `endless` with a frozen main Score of 0; `endlessFrom` is set when Chapter 9 starts.
- Title: `#endlessRunBtn` next to Play when `crackMax ≥ 1` or `heroesWon` is not empty. Retry repeats the mode.
- Tests: `tests/endgame.test.ts` (Endless Run), `apps/game/src/ui/unlocks.test.ts`, `tests/browser/ending.spec.ts` (desktop + phone).

**Status:** ready-for-human (owner playtest: beat Umbra once on a fresh account, then an Endless Run from the title)
