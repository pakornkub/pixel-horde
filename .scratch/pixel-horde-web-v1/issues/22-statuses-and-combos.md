# 22: Statuses, Combos, Realm traits and resistances

**What to build:** Skills leave Statuses (Frozen, Gathered, Burning, Shocked, Poisoned) and matching triggers fire the seven Combos (Shatter, Firestorm, Overload, Superconduct, Toxic Burst, Grinder, Catalyst) with a 1 s per-enemy repeat cooldown and a big Combo name popup. Realms get traits and a resisted element (−50%). Co-op Combos only use the owner's own Skills.

**Blocked by:** 21 (Skill slots v2, Bench and Stage-end swaps)

**Status:** done (awaiting owner playtest)

- [x] Status durations and Combo multipliers come from Balance Config; bosses are slowed, not frozen
- [x] Existing mobs are tagged with the trait table from wayfinder #18/#09
- [x] Sim tests: each Combo triggers only from its pair; cooldown respected; resistance applied

## Notes (implementation)

- `packages/sim/src/systems/combos.ts` + tags in `data/skills.ts`. Every Skill hit carries a tag (element, heavy, sweeper, Status it leaves); `hit()` checks Combos, Realm resistance and applies Statuses.
- Statuses: Frozen (Frost Aura ticks stack 3 → 1.5 s; bosses only slowed), Gathered (pulled by Cyclone/Black Hole + 1 s), Burning 3 s (Fire Nova, Meteor, pet dragon), Shocked 2 s (Chain, Laser), Poisoned 4 s (Toxic Pool).
- Combos: Shatter (Frozen + Lance/Meteor/Black Hole collapse ×2.5 + shards), Firestorm (Gathered + fire spreads Burning through the pack), Overload (Shocked + fire 150% blast), Superconduct (Frozen + lightning: armour off 5 s), Toxic Burst (Poisoned + fire: remaining poison ×2 as a blast), Grinder (Gathered + Orbit/Disc/Cyclone +50%), Catalyst (Arcane Bolt on any Status +50%). 1 s per-monster cooldown per Combo; big popup; counted for the Score.
- Realm resistance −50% to the Realm's element (Deepdark dark, Frostpeak ice …); dragon/whelps/Shadow Rival are exempt. Realm traits: armoured Realms double the armour chance from Chapter 2, fast Realms add and speed up fast mobs, ranged/split/charge Realms add Eye Casters/Split Slimes/Wild Boars. Mobs tagged with traits in `data/enemies.ts`.
- Level-up cards now show "combos with …" for owned partner Skills.
- Co-op: Statuses live on the owner's machine only, so Combos use only the owner's Skills (enforced when ticket 42 wires co-op).
- Every number is in Balance Config `status`, `combos`, `realms`. Tests: `tests/combos.test.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
