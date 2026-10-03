# 62: Show Kit's Hunter's Eye crit bonus (Hero panel + website)

**What to build:** `heroes.ranger.crit` ("Hunter's Eye": crit chance bonus, still under the crit cap) is a live,
player-facing Balance Config value, but neither the in-game Hero panel nor the website's Hero section mentions it
(only speed, pickup and the `hp` bonus appear). Show it the same way `hp` is shown: only when the live value is > 0,
so the line disappears if a config ever zeroes it.

- `apps/game/src/ui/text.ts` (`ranger` object): add `crit`, new i18n key `hero.ranger.crit` in `th.json` + `en.json`.
- `apps/site/src/data.ts` (`heroBonus('ranger')`): push `hero.b.rangerCrit`, guarded like `hero.b.rangerHp`;
  site text in `apps/site/src/text.ts`.
- Confirm both render sites pick the field up; screenshots before/after (in-game Hero panel, website Heroes section).
- Test: the line appears for a value > 0 and is hidden at 0.

No migration / pgTAP; no Balance Config publish. Review gate: Tester + UX/UI (player-visible text on both surfaces).

**Related:** 57 (Mora), Kit pass 2026-09b (`heroes.ranger.hp`).

**Status:** ready-for-human (owner review)
