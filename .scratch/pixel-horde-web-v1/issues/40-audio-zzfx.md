# 40: Sound effects and core music with ZzFX/ZzFXM

**What to build:** Every Skill, Combo and Ultimate form has a ZzFX sound; the title, King fights and Umbra have ZzFXM tracks; music and effects volumes follow Settings.

**Blocked by:** 07 (Settings screen)

**Status:** done (the owner judges the sound by ear)

- [x] Realm music is added by each Realm ticket
- [x] No audio files are shipped

## Notes (implementation)

- `apps/game/src/audio/zzfx.ts`: a TypeScript reimplementation of ZzFX's sample builder (same 20 parameters, MIT, credit to Frank Force). `sounds.ts`: every sim sound key, a cast sound per Skill (general, Signature and line), a sting per Combo, an Ultimate sound per Weapon form, a dialogue blip — all as parameter arrays, easy to tweak.
- `music.ts`: a tiny ZzFXM-style tracker (note patterns per track, ZzFX instruments, rendered once into a looping buffer). Themes: title, King fight, Umbra. Music follows the game: title outside Runs, King theme while a King/Guardian is up, Umbra theme in the Heart Crater; Realm themes will be added by the Realm tickets (Stages are quiet until then).
- Separate effects and music buses follow the Settings volumes; M mutes both. The sim now emits presentation-only `cast` events (no effect on replays).
- No audio files ship. Tests: `apps/game/src/audio/audio.test.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
