# 34: Hero art, prop-based scenes, and the Greenvale and Sunscar Realms

**What to build:** The four Heroes are redrawn at Pokémon Red/Blue detail level in full color (16×16, 3 directions × 2 frames, body/head/held-Weapon layers). Scenes become prop-based (walk-through props, dithered textures). Greenvale and Sunscar get their full kits: ground and ~8 props each, their three Realm mobs, a redrawn 32×32 King (2 idle + wind-up), their Weapon and Ultimate form, and their ZzFXM music.

**Blocked by:** 33 (Sprite Lab and sprite files); 20 (King framework: phases, ultimates, dialogue, boss arrows); 22 (Statuses, Combos, Realm traits and resistances); 27 (Ultimate rebalance and the Weapon system)

**Status:** done — awaiting owner art review (Sprite Lab)

- [x] Props never block movement
- [x] King Slime and Sand King use their wayfinder #21 move sets and dialogue
- [x] Mob traits/resistances per wayfinder #09/#18
- [ ] Owner reviews art in Sprite Lab before merge

## Notes (implementation)

- Heroes (`apps/game/src/sprites/lumora/heroes.ts`): Lyra, Bram, Kit and Vex redrawn in layers — a shared body (down / up / side × 2 walk frames), a head per Hero and direction (wizard hat, plumed helmet, hood, goggles), and a held-Weapon sprite (11 shapes, coloured by the equipped Weapon) drawn in the hand, or on the back when walking up. The renderer picks the direction from movement (left = mirrored side view).
- Kings: King Slime, Sand King, Bone King and Frost King redrawn at 32×32 with two idle frames and a wind-up frame (used while a move plays out); the six new Kings follow the same format.
- Scenes: walk-through props (rocks, stumps, signs, grass tufts, crystals, bones) in each Realm's colours plus a dithered ground texture, on top of the existing tree/cactus/rock deco — 5 prop kinds per Realm so far (spec says ~8: more can be added in `apps/game/src/render/tiles.ts` → `PROPS`). Props are tiles only, so they never block movement.
- Greenvale / Sunscar kits: King Slime and Sand King use their #21 move sets and dialogue (ticket 20), Thornwhip / Sunblade (ticket 27), mob traits/resistances (ticket 22), music themes (tickets 36–38 work).
- **Owner:** review everything in the Sprite Lab (`npm run lab`) and `?debug=realm:<id>` in the game.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
