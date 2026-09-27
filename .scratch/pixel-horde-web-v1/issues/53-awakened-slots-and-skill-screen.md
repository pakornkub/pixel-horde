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

**Status:** ready-for-human (code done; migration + pass publish + playtest are owner steps)

## Owner decisions (2026-09-27, confirmed in session)
- HUD: a separate gold "AWK n/3" row above SKILL, shown only once Awakened.
- The skill board shows at every Stage end (even with an empty Bench) and read-only from the pause menu ("View skills").
- Before Awakening the board shows the 3 Awakened slots locked with the progress line (Signature evolved ✓/✗ · Links n/2).

## Done
- [x] `awaken.lineSlots` (0–3, default 0 = today) in `packages/config`; `lineSlots()`, `inLineSlot()`, `slotUse()`, `slotFree()`
      in `packages/sim/src/systems/progress.ts`: grant, buildOptions and swapBench count each group separately
      (general + Signature vs Awakened); an Awakened skill never swaps into a normal slot or the other way round
- [x] HUD AWK row (`apps/game/src/render/draw.ts`), level-up slot line with the Awakened count
- [x] Skill board (`apps/game/src/ui/overlays.ts` `renderBench` / `renderSkillView`): Attack / Awakened / Passive / Bench,
      blinking targets, per-skill "still needs" hints, Awakening progress line; pause menu "View skills" (`#ovSkills`)
- [x] Pass `2026-09h` (lineSlots 3, slots 0) first in BALANCE_PASSES; migration `20260930000038_awaken_line_slots.sql`
- [x] Site guide (slots demo + Awakening rule), CLAUDE.md
- [x] Tests: tests/awaken.test.ts (lineSlots), balance-pass.test.ts, tests/browser/skills.spec.ts (swap + blink, pause view)
- [ ] Owner: apply the migration, publish pass `2026-09h` after the build is live; playtest an Awakened Run
