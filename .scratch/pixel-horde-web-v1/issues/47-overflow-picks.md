# 47: Fillers once the upgrades run out — Limit Break, train the Bench, Gold bag, Recover

**What to build:** Owner playtest (Chapter 5, attack slots 5/5, Bench 3/3, everything max level): every chest and
level-up offered a single **Recover** card, and the "Reroll (1 SP)" button spent a Skill Point to draw the same card
again. Owner decision (2026-09-26): once too few upgrades are left, fill the offer up to `levelup.offers` (3) from a
pool of fillers — **Limit Break** (small stacking Run bonuses), **train a Bench entry** (+1 level), **Gold bag** and
**Recover** — and let the reroll draw a new set from that pool.

**Blocked by:** —

**Status:** ready-for-human (owner playtest; the migration goes live with the release)

- [x] Balance Config group `shared.overflow`: `dmg` 0.04, `hp` 0.05 (share of max HP), `spd` 0.03, `crit` 0.02 per pick,
      `max` 10 picks of each, `gold` 25 × Chapter, weights `wLb` 1 (each bonus), `wTrain` 1 (each Bench entry),
      `wGold` 0.8, `wHeal` 0.8; Thai help in `desc-th.ts`
- [x] `buildOptions()` (`packages/sim/src/systems/progress.ts`): real upgrades first, then `fillers()` fill the rest;
      a lone Recover only when every filler weight is 0
- [x] Limit Break is additive with the other bonuses in `recompute()` (crit still capped; crit not offered at the cap);
      max HP × (1 + hp·picks), and the HP gained is added to current HP
- [x] Train: +1 level to a Bench Skill or passive below its max; it keeps the level when swapped in at the Stage end
- [x] Gold bag: `overflow.gold × Chapter` into this Run's Gold (`goldBag()`)
- [x] Recover is only offered while HP is not full
- [x] Level-up / chest cards (`overlays.ts`): Limit Break shows the stat, picks `n → n+1 / max` and borrows the matching
      passive's picture; train shows the Bench entry's picture, `BENCH LV a → b` and its next-level stats
- [x] Migration `20260929000027_overflow_picks.sql` (live `config_schema`)
- [x] Tests `tests/overflow.test.ts`; golden replays unchanged (fillers draw only when an offer would have been short)
- [x] Playtest bot scores the new cards; telemetry pick ids `lb:dmg`, `train:frost`, `gold`, `heal`
- [ ] Owner playtest of a long Run (Chapter 5+ / Endless) → tune `overflow.*` from Admin → Balance if too strong
- [ ] Release: changelog entry in Admin → อัปเดตเกม (kind feature)

## Notes

- Player state: `P.lb` (optional, so older checkpoints still load).
- Co-op: each player draws their own fillers; the Gold bag goes to the picker's Run Gold like any other Gold.
- Suggested changelog lines — th: "สกิลตันหมดแล้วยังมีของให้เลือก: Limit Break (ดาเมจ/HP/ความเร็ว/คริ สะสมได้),
  ฝึกสกิลใน Bench, ถุงทอง และ Recover — กดสุ่มใหม่ได้ด้วย"; en: "Maxed out? Level-ups and chests now offer Limit Break
  (stacking Damage/HP/Speed/Crit), Bench training, a Gold Bag or Recover — and the reroll draws a new set."
