# 25: Awakening and Skill Line skills for Kit and Vex

**What to build:** Kit (Stormhunter: Arrow Rain, Gale Step, Thunder Hawk) and Vex (Grand Alchemist: Cauldron, Transmute into XP, Elixir Rain) gain their Awakening using the framework from ticket 24.

**Blocked by:** 24 (Awakening and Skill Line skills for Lyra and Bram)

**Status:** done (awaiting owner playtest)

- [x] Transmute produces XP, never Gold
- [x] Sim tests per line skill

## Notes (implementation)

- Built together with ticket 24 on the same framework.
- Kit (Stormhunter): Arrow Rain (volleys on a spot), Gale Step (survival: wind blades left while walking), Thunder Hawk (lightning chain, leaves Shocked).
- Vex (Grand Alchemist): Cauldron (puffs fire/ice/poison in turn, leaving Statuses), Transmute (monsters dying in the circle may drop a big EXP crystal — never Gold), Elixir Rain (survival: heals and cuts every cooldown).
- Tests in `tests/awaken.test.ts` (each line skill damages / heals; Transmute gives EXP and no Gold).

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
