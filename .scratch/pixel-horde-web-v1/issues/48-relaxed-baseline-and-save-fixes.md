# 48: One difficulty for everyone (Relaxed becomes the base) + save / Continue fixes

**What to build:** Owner playtest (2026-09-27):
1. After Continue, "Save & Quit" is greyed out for the rest of the Chapter, so quitting meant losing the Run.
2. After closing the tab / reloading, the title had no "Continue" button, but "Play" asked to discard the saved Run.
3. "Relaxed" felt right, and Heart Crack already makes the game harder, so the difficulty picker is not needed.

Owner decisions (2026-09-27):
- Save lock stays (a resumed Chapter-start save is single use, no Chapter retries), but the pause menu says why.
- Remove the six difficulty presets entirely. Relaxed becomes the game's base difficulty, as the Admin default and in
  version 0, with Gold ×1 (not Relaxed's ×0.5). Every solo Run is ranked. Keep the current leaderboard (no new Season).

**Blocked by:** —

**Status:** ready-for-human (owner playtest; migration 0028 must be applied with the release)

- [x] Continue button: `refreshContinue()` also runs at page load and when the account is ready (`apps/game/src/main.ts`)
- [x] Pause menu: under a greyed-out "Save & Quit" after a Continue, `save.usedNote` explains the lock (th/en)
- [x] Deleted `packages/config/src/presets.ts` (+ test), `shared.presets`, the Settings picker, the title "Mode" badge,
      the save's `preset` field, `preset.*` strings and the website's preset grid
- [x] New Balance Config group `shared.difficulty` (`packages/config/src/difficulty.ts`): mobHp 0.6, mobDmg 0.45,
      bossHp 0.55, bossDmg 0.45, spawn 0.85, xp 1.3, warn 1.4, kingPace 1.35, hp 1.3, hearts 2, ultFill 0.8,
      director 0.75. `resolveConfig` applies it, so the sim, the website and every published version use it
      (versions published before it get the defaults). Thai help in `desc-th.ts`
- [x] Website guide: the difficulty paragraph now explains Heart Crack and Endless with live numbers
- [x] Playtest: `presets` suite → `cracks` (Heart Crack 0–3), `PT_CRACK` for the `patch` suite
- [x] Tests: `asWritten()` in `tests/bot.ts` for tests of exact mechanic numbers; golden replays re-recorded
- [x] Migration `20260930000030_base_difficulty.sql` (live `config_schema`: drop `presets`, add `difficulty`)
- [ ] Coordinator: apply migration 0028, deploy
- [ ] Owner playtest: a full Run at the new base, then Heart Crack 1–3 (tune `shared.difficulty.*` or
      `shared.heartCrack.*` from Admin → Balance). Heart Crack 3 on the new base ≈ old Balanced monster HP but
      much lower damage, so more tiers may be wanted later
- [ ] Release: changelog entry in Admin → อัปเดตเกม, kind `feature` + `fix`:
      th "ความยากเดียวสำหรับทุกคน: ค่าเริ่มต้นเป็นแบบเพลินๆ (ทองปกติ) ทุกรอบนับอันดับ อยากยากขึ้นเลือกหัวใจร้าวหลังชนะ Umbra" /
      en "One difficulty for everyone: the game now plays like the old Relaxed (normal Gold) and every Run is ranked; beat Umbra for Heart Crack";
      fix th "ปุ่มเล่นต่อหายหลังปิดแท็บหรือรีเฟรชหน้า" / en "The Continue button was missing after closing the tab or reloading"
