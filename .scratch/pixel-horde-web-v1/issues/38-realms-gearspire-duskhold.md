# 38: Realms: Gearspire and Duskhold

**What to build:** Gearspire and Duskhold complete the 10 Realms: mobs (incl. stationary turrets and splitting Haunted Armor), Golem King and Lich Queen, Weapons Gear Cannon and Lich Tome, music.

**Blocked by:** 34 (Hero art, prop-based scenes, and the Greenvale and Sunscar Realms)

**Status:** done — awaiting owner art review

- [x] All 10 Realms and 10 Weapons playable
- [ ] Owner art review (Sprite Lab: `npm run lab`)

## Notes (implementation)

- Gearspire (lightning; ranged, armored): iron spider (fast) · turret (stationary, two-shot volleys) · clockwork soldier (armored). Golem King: straight laser, deploys turrets, PROTOCOL: PURGE (a laser sweeping 360°); speaks in commands. Gear Cannon: Overdrive (a turret keeps shooting for 8 s).
- Duskhold (dark; ranged, split): flying tome (spinning three-way volleys) · lantern ghost (ranged) · haunted armor (breaks into 2 ghosts). Lich Queen: soul spiral, swaps places with a monster (blast where she lands), Requiem (a ring of books firing inward); speaks in verse. Lich Tome: Soul Harvest (pulls monsters in, heals up to 25% HP).
- All 10 Realms and 10 Weapons (+ Judgement) are playable. `?debug=realm:<id>` starts Chapter 1 in any Realm for reviews and playtests.
- Tests: `tests/realms.test.ts` (every King's moves/ultimate, turrets, frogs, leech, splits, new Ultimate forms).

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
