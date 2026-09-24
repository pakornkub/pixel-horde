# 22: Statuses, Combos, Realm traits and resistances

**What to build:** Skills leave Statuses (Frozen, Gathered, Burning, Shocked, Poisoned) and matching triggers fire the seven Combos (Shatter, Firestorm, Overload, Superconduct, Toxic Burst, Grinder, Catalyst) with a 1 s per-enemy repeat cooldown and a big Combo name popup. Realms get traits and a resisted element (−50%). Co-op Combos only use the owner's own Skills.

**Blocked by:** 21 (Skill slots v2, Bench and Stage-end swaps)

**Status:** ready-for-agent

- [ ] Status durations and Combo multipliers come from Balance Config; bosses are slowed, not frozen
- [ ] Existing mobs are tagged with the trait table from wayfinder #18/#09
- [ ] Sim tests: each Combo triggers only from its pair; cooldown respected; resistance applied

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
