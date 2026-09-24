# 21: Skill slots v2, Bench and Stage-end swaps

**What to build:** Players have 4 attack slots (one reserved for the Signature Skill, temporarily the Hero's starting skill), 3 passive slots and a Bench that starts at 1 and grows after Chapters 2 and 4. Level-ups can place new Skills into the Bench; benched Skills keep level but are not offered upgrades. At Stage end players swap Bench ↔ attack slots for 20 × Chapter Gold (second swap doubles).

**Blocked by:** 19 (8-Chapter Run, route choice, King-must-die, Escape and the new Score)

**Status:** done (awaiting owner playtest)

- [x] Level-up cards show helper labels ("counts as a Link", "combos with …") where applicable
- [x] Swap costs draw from this Run's Gold first, then the wallet, showing both
- [x] Sim tests for offer rules, Bench growth, swap costs

## Notes (implementation)

- Balance Config: `maxAttackSlots` 4 (incl. Signature), `passiveSlots` 3, `bench.{start 1, growAt1 2, growAt2 4, swapBase 20, swapGrowth 2}`, `levelup.wSignature` 1.25.
- Signature Skill = the Hero's starting skill until ticket 23 (`signatureOf`); it can never be swapped out. Skill Lines (`SKILL_LINES`) drive the "counts as a Link" label.
- Level-up: new Skills go to the Bench (card tag "→ BENCH") only when the 4 attack slots are full and the Bench has room; benched Skills keep level/Evolution and are never offered; new passives only while a passive slot is free.
- Clear screen: Bench panel (tap a Bench skill, then an attack slot or an empty slot). Cost 20 × Chapter, ×2 per further swap at the same Stage end, paid from this Run's Gold first, then the wallet (both shown). The sim reports `walletSpent`; `submit_run` / `submit_offline_run` charge it (never below 0).
- The "combos with …" label needs Statuses/Combos (ticket 22) and is added there.
- Tests: `tests/slots.test.ts`, DB test for the wallet charge in `supabase/tests/002_*`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
