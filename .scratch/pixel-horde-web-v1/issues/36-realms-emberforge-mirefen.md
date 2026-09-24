# 36: Realms: Emberforge and Mirefen

**What to build:** Emberforge and Mirefen are added as new Realms with full kits: mobs, Magma King and Bog Queen with wayfinder #21 moves and dialogue, Weapons Magma Maul and Plague Censer, music.

**Blocked by:** 34 (Hero art, prop-based scenes, and the Greenvale and Sunscar Realms)

**Status:** done — awaiting owner art review

- [x] Route choice includes them
- [ ] Owner art review (Sprite Lab: `npm run lab`)

## Notes (implementation)

- Emberforge (fire; fast, armored): fire bat · salamander (fast) · lava rock (armored). Magma King: ground-slam ring wave, lava drops in a ring, ERUPTION!! (waves of lava circles across the screen); shouts every line. Magma Maul: Meteor Crash (Burning + heavy knockback).
- Mirefen (poison; split, leech): poison frog (hops) · spore cap (splits into 2 sporelets) · giant leech (heals by the damage it deals). Bog Queen: poison spit cone, calls frogs, Gossip Swamp (everything but one safe pool is poisoned); gossips. Plague Censer: Miasma (Poisoned).
- Both are offered on the route; tiles (volcanic rock, swamp), sprites (`sprites/lumora/emberforge.ts`, `mirefen.ts`), bestiary lore, dialogue (th/en) and music themes.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
