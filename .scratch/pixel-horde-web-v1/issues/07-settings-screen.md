# 07: Settings screen

**What to build:** Players can tune music and effects volume separately, screen shake (off/light/full), mobile vibration (on/off), Ultimate flash (on/off), effects and damage numbers (off/some/all) and tips (off / replay), stored on the device.

**Blocked by:** 06 (Thai and English text)

**Status:** done

- [x] Settings open from the title and pause screens
- [x] Each option takes effect immediately and persists across reloads
- [x] Vibration uses the Vibration API where available and is hidden where not
- [x] Settings are never sent to the server

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `apps/game/src/settings.ts` (model + `parseSettings`, stored under `pixelhorde-settings`) and `ui/settings-screen.ts`. Effects volume drives the SFX bus now; the music slider is stored and takes effect when music arrives (ticket 40). "Some" damage numbers = crits only; "some" effects ≈ 40% of particles. Ultimate flashes are tagged in sim flash events (`ult: true`) so the setting can drop them. Tips on/off + "show tips again" clear `tipsSeen` for ticket 44.

**Update 2026-09-26:** Settings also has Camera distance (Normal / Far / Farthest = zoom-out ×1 / 1.25 / 1.5, picture only — the sim keeps the zoom-1 view) and Difficulty (solo presets Relaxed / Easy / Balanced / Challenge / Hard / Blitz from `packages/config/src/presets.ts`, applied from the next Run; only Balanced is ranked; knobs `shared.presets.*`, migration 0017, live).
