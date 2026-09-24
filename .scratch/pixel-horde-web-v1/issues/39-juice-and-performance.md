# 39: Juice pass and performance budget

**What to build:** The game feels punchy and stays smooth: King intro cards, slow-motion King deaths, a zoom moment for Evolution/Awakening/fusion, "×50 KO!" Kill Streak popups, visible Statuses on monsters, per-family death animations and end-of-Stage pickup vacuum — all respecting Settings. Monster and particle caps differ for desktop/mobile and the game suggests lowering effects when FPS stays under 45.

**Blocked by:** 20 (King framework: phases, ultimates, dialogue, boss arrows); 22 (Statuses, Combos, Realm traits and resistances)

**Status:** done (awaiting owner playtest on a phone)

- [x] Caps: monsters 320/240, particles 900/500 (Balance Config)
- [x] Every effect obeys the effects/shake/flash settings
- [x] FPS histogram reported in telemetry

## Notes (implementation)

- Caps (Balance Config): `spawn.capMobile` 240 / `swarmCapMobile` 260 next to the desktop 320/340; `fx.particles` 900 / `fx.particlesMobile` 500. Phones/tablets = coarse pointer without hover (`apps/game/src/platform/device.ts`); the sim gets `mobile` as an option (kept in replays, so still deterministic; a resumed save follows the resuming device).
- New `fx` config section (client only, never changes the simulation): King slow-motion length/speed, zoom strength/length, intro card length, low-FPS threshold (45) and how long it must last (8 s).
- King intro card (sim event `kingIntro`: sprite, name, "Ruler of <Realm>"); slow-motion after a King/Umbra dies (the client slows the tick accumulator — replays and co-op hashes are unaffected); zoom moment on Evolution / Awakening / fusion; "×50 KO!" popups every `streak.popupEvery` (25) kills of a streak; per-family death animations (slime splat, ghost wisps, bones, feathers, spores, snow; a ring for Kings) from the enriched `kill` event; Status visuals (chill mark, burning embers, poison bubbles on top of the existing marks); end-of-Stage vacuum pulls every pickup left on the floor.
- Settings: effects "off" disables death animations, zoom, slow-motion and streak popups; "some" thins particles; shake and Ultimate flash settings keep working as before.
- Low FPS: after 8 s under 45 FPS in play, a small bar suggests lowering effects (one tap: all → some → off), once per session. The FPS histogram (<30, 30–45, 45–55, ≥55) is already in each Run summary (ticket 14).
- Tests: `tests/juice.test.ts` (mobile cap, kill/streak/intro events, vacuum), `apps/game/src/fpswatch.test.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
