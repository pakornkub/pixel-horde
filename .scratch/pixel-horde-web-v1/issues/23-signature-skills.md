# 23: Signature Skills, their Evolutions and Hero stat/price changes

**What to build:** Lyra (Arcane Sigil), Bram (Holy Shield, blocks enemy projectiles), Kit (Hawk Companion) and Vex (Volatile Flask, random element) get their Signature Skills in the locked slot with their Evolutions (Might/Vitality/Swift/Haste), the new stat bonuses and prices (Kit 500, Vex 1,000 Gold).

**Blocked by:** 21 (Skill slots v2, Bench and Stage-end swaps)

**Status:** done (awaiting owner playtest)

- [x] Signature Skill is offered slightly more often at level-up
- [x] Holy Shield blocks hazard projectiles; Volatile Flask applies Statuses
- [x] Hero select shows role, Signature Skill and price
- [x] Sim tests per Signature Skill behaviour

## Notes (implementation)

- Signature Skills (`SIGNATURE_IDS`, never offered to other Heroes, locked slot, ×1.25 offer weight): Arcane Sigil (ground circle, damage per tick; + Might → Grand Sigil: bigger, two at a time), Holy Shield (1–3 shields bash and block monster projectiles; + Vitality → Aegis: 3 shields, heal 3 HP per block, −15% damage taken), Hawk Companion (dives at the biggest monster in range, heavy hit; + Swift → Twin Hawks: 2 hawks, stun 0.8 s, bosses slowed), Volatile Flask (random fire/ice/poison splash leaving Burning/Frozen/Poisoned; + Haste → Smart Flask: 2 flasks, fire where it combos, otherwise sets one up).
- Heroes: Lyra +10% skill damage · Bram +40 HP, −5% speed · Kit +12% speed, +30% pickup · Vex −8% cooldowns, Statuses +20% · prices Kit 500 / Vex 1,000 (server prices come from the same Balance Config).
- Hero select shows name, role, Signature and bonus. Balance Config `skills.sigil|shield|hawk|flask`, `heroes.*`.
- Tests: `tests/signatures.test.ts`; DB test updated for the new prices.

**Update 2026-09-26:** the Hawk defends Kit when crowded (`skills.hawk.guardN/guardR`: dives the nearest monster instead of the biggest), Hawk dive splash `skills.hawk.r`, Kit max HP bonus `heroes.ranger.hp`; the Volatile Flask aims at bosses first, then the densest crowd, and follows its target. New fields are neutral by default; live values come from passes 2026-09 / 2026-09b.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
