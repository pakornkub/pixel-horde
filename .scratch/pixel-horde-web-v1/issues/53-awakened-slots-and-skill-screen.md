# 53: Three Awakened-only attack slots (7 in all) and an easier skill management screen

**What to build:** Owner decisions (2026-09-27):
1. After Awakening the Hero gets **3 extra attack slots that hold only Awakened skills** (4 normal + 3 = 7), instead of
   the one shared 5th slot (`awaken.slots` 1 today).
2. The skill management screen (Bench ↔ slots at the Stage end) should be easier, with a clear guide.

Proposed (to confirm with the owner):
- New Balance Config field `awaken.lineSlots` (default 0 = today; the pass sets 3 and `awaken.slots` 0). Slot counting
  splits into two groups: general Skills + Signature use `attackSlots()`, Awakened skills (`isLine`) use the line slots.
  Touch every `Object.keys(P.skills).length < attackSlots(s)` check (progress.ts buildOptions / swapBench / grant,
  overlays.ts `level.slots` + bench row, draw.ts HUD). The HUD gets an "AWK" row of 3.
- Skill screen laid out like the HUD: Attack 4 / Awakened 3 / Passive 3 / Bench. Tapping a Bench entry makes the slots it
  can go to blink; one guide line says what to do next. Each owned skill says what it still needs ("needs Might to
  Evolve", "Link 1/2 for Awakening"). The pause menu can open it read-only.
- Migration patching `shared.awaken` in the live config_schema; site guide + CLAUDE.md numbers.

**Blocked by:** 52

**Status:** needs-triage
