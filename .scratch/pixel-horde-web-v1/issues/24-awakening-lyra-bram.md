# 24: Awakening and Skill Line skills for Lyra and Bram

**What to build:** When a Signature Skill is evolved and 2 of 3 Skill Line Links have been max level and equipped for a full Stage, a Stage-end prompt offers Awakening (declining forfeits it for the Run). Accepting consumes the two Links, transforms the Signature Skill and adds the Hero's three Skill Line skills to level-up offers. Implemented for Lyra (Archmage: Mana Nova, Time Warp, Starfall) and Bram (Paladin: Sacred Blades, Judgement Pillar, Aegis Dome).

**Blocked by:** 23 (Signature Skills, their Evolutions and Hero stat/price changes); 22 (Statuses, Combos, Realm traits and resistances)

**Status:** ready-for-agent

- [ ] Link eligibility checks equipped, max level, and one full Stage at max
- [ ] Decline requires a second confirmation
- [ ] Sim tests: prompt appears exactly when conditions hold; Links consumed; line skills offered at level 1

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
