# 35: Realms: Deepdark Hollow and Frostpeak

**What to build:** Deepdark Hollow and Frostpeak get the full Realm kit (ground, props, three mobs incl. the Skeleton Archer, 32×32 Bone King and Frost King art, Weapons Bone Scythe and Glacier Lance, music).

**Blocked by:** 34 (Hero art, prop-based scenes, and the Greenvale and Sunscar Realms)

**Status:** done — awaiting owner art review

- [x] Traits and resistances per wayfinder #09
- [ ] Owner art review (Sprite Lab: `npm run lab`)

## Notes (implementation)

- Skeleton Archer (`archer`, ranged: arrows from range, backs off when close) replaces the plain skeleton in Deepdark's pool (Deepdark: bat · Skeleton Archer · ghost; the Bone King still raises skeletons). Frostpeak keeps ice slime · ice bat · armored snowman.
- Traits/resistances: Deepdark ranged / resists dark; Frostpeak armored / resists ice (unchanged, per #09).
- Bone Scythe and Glacier Lance were already playable (ticket 27). Realm music themes for all 10 Realms + the Crater were added with ticket 36–38 work (`apps/game/src/audio/music.ts`).
- Art draft: `apps/game/src/sprites/lumora/deepdark.ts` (archer). The Bone King and Frost King are still the ×3 crown-on-mob drawings; their 32×32 redraw goes with the King Slime / Sand King redraw in ticket 34 (done there: all Kings are 32×32 now).

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
