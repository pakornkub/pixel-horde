# 58: Forge levels add Ultimate damage (+ special shop review notes)

**What to build:** Owner feedback after PR #46 (2026-09-27): the Ultimate feels weak. It barely scratches bosses and
late monsters survive it. The Weapon forge should add damage too, not only stretch each Weapon's own effect.

Owner decisions (2026-09-27, the recommended option):
- Every forge level adds `forge.dmg` +20% to the Ultimate strike (× the base strike, level 5 = ×2).
- Every level raises the boss cap: `forge.bossCap` +1 point for Kings and Guardians (8% → 13% at level 5),
  `forge.umbraCap` +0.5 for Umbra (5% → 7.5%).
- The base Ultimate for everyone is measured by the balance-audit session first (it is adding `ult.bossHit`, pass
  2026-09i). This ticket does not change base Ultimate numbers. The forge cap bonus is an input to the one cap helper
  (`ultCap(cfg, umbra, level)` in packages/sim/src/data/weapons.ts), so the audit's helper can take it over.
- Co-op: a guest caps its own strike at its forge level; the host allows a guest's strike at most a fully forged cap
  (it does not know the guest's level).

Review notes folded in (Tester + UX/UI on PR #46):
- O1 / F4: short Gold shows a red "Need 388G" button and "Not enough Gold" instead of the generic error.
- O2: stunned monsters (forged Judgement, Twin Hawks) show three little stars over the head (renderer only).
- F1: the level (`Lv x/5`) never wraps away from the Weapon name.
- F2: owned Weapons come first; the Back button is sticky at the bottom (like the clear screen's Next).
- F3 / F8: Weapons not owned yet are one line each under "Not owned yet (n)": "🔒 Thornwhip · King of Greenvale" (realm short name).
- O3 / F5: level-0 Judgement reads "none → 0.2s".
- F6 / O3 (owner, option A): before the first win the title button is a plain paper button "🔒 Special shop" with
  "Beat Umbra to unlock" under it, and it opens on the locked Forge tab (forge note + lock line). After the win: yellow
  with the NEW! badge, as before.

**Blocked by:** —

**Status:** ready-for-human (QA again: the forge now adds damage; migration 0040)

- [x] Balance Config `shared.forge.dmg / bossCap / umbraCap` (+ Thai descriptions); `forgeDmg`, `ultCap` helpers
- [x] Sim: Ultimate strike × `forgeDmg`; `rawHit` / `remoteHit` cap through `ultCap`
- [x] Shop: damage × and King cap now → next per Weapon; wording "never more damage" removed (i18n, website guide, ticket 56)
- [x] Migration `20260930000040_forge_damage.sql`: the full `shared.forge` subtree in config_schema (keeps every key of
      0036 and adds the three new ones)
- [x] Tests: tests/ultimate.test.ts (damage × per level, King 8% → 13%)
- [ ] Owner: playtest a forged Weapon against a King
