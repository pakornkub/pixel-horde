# 24: Awakening and Skill Line skills for Lyra and Bram

**What to build:** When a Signature Skill is evolved and 2 of 3 Skill Line Links have been max level and equipped for a full Stage, a Stage-end prompt offers Awakening (declining forfeits it for the Run). Accepting consumes the two Links, transforms the Signature Skill and adds the Hero's three Skill Line skills to level-up offers. Implemented for Lyra (Archmage: Mana Nova, Time Warp, Starfall) and Bram (Paladin: Sacred Blades, Judgement Pillar, Aegis Dome).

**Blocked by:** 23 (Signature Skills, their Evolutions and Hero stat/price changes); 22 (Statuses, Combos, Realm traits and resistances)

**Status:** done (awaiting owner playtest)

- [x] Link eligibility checks equipped, max level, and one full Stage at max
- [x] Decline requires a second confirmation
- [x] Sim tests: prompt appears exactly when conditions hold; Links consumed; line skills offered at level 1

## Notes (implementation)

- Framework in `packages/sim/src/systems/progress.ts` (`updateLinks`, `qualifiedLinks`, `awakenEligible`, `answerAwaken`) and `AWAKENING` in `data/heroes.ts`. Links = the Hero's Skill Line general skills (`SKILL_LINES`).
- A Link qualifies once it was max level and equipped at a Stage start and still is at that Stage's end (Balance Config `awaken.stages` = 1); unequipping or benching resets it. The prompt (`awakenOffer`) appears on the clear screen when the Signature is evolved and `awaken.links` (2) Links qualify.
- Accept (`{type:'awaken', accept:true}`) consumes two qualified Links (in Skill Line order if all three qualify), sets `awakened` (Signature damage × `awaken.sigDmg` 1.3, gold glow) and adds the three line skills to level-up offers at level 1. Decline needs a second click in the UI and forfeits for the Run. Leaving the prompt unanswered (Next) keeps it for the next Stage end.
- Lyra (Archmage): Mana Nova, Time Warp (survival: slow field + ticks), Starfall. Bram (Paladin): Sacred Blades (slash in the walking direction), Judgement Pillar (elites/bosses first), Aegis Dome (survival: invulnerable, pushes monsters out).
- Line skills have no Evolution and higher max level; numbers in Balance Config `skills.<lineSkill>`.
- Tests: `tests/awaken.test.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
