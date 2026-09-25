# 03: Move special events, hazards, dragon, rival and pet into the sim

**What to build:** Blood Moon, Inferno Dragon, Shadow Rival, counter enemies (boar, eye caster, split slime, armored), all telegraphed hazards, the dragon pet and the shadow clone run inside the sim with identical behaviour.

**Blocked by:** 02 (Extract the headless deterministic sim core)

**Status:** in-progress — code done (with ticket 02); waiting for the owner's playtest

- [x] All hazard shapes (cone, circle, line, projectile, ring) are simulated in the sim and exposed through `view()`
- [x] Event rolls and pity counters use the seeded RNG
- [x] Debug URL flags `?debug=dragon|rival|bloodmoon|god` still force events
- [ ] Playtest confirms events look and behave as before

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `packages/sim/src/systems/events.ts`. Debug flags are comma-separated (`?debug=god,dragon`); `dragon`/`bloodmoon`/`rival` force the event on every Stage including Stage 1.
