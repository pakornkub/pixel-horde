# 39: Juice pass and performance budget

**What to build:** The game feels punchy and stays smooth: King intro cards, slow-motion King deaths, a zoom moment for Evolution/Awakening/fusion, "×50 KO!" Kill Streak popups, visible Statuses on monsters, per-family death animations and end-of-Stage pickup vacuum — all respecting Settings. Monster and particle caps differ for desktop/mobile and the game suggests lowering effects when FPS stays under 45.

**Blocked by:** 20 (King framework: phases, ultimates, dialogue, boss arrows); 22 (Statuses, Combos, Realm traits and resistances)

**Status:** ready-for-agent

- [ ] Caps: monsters 320/240, particles 900/500 (Balance Config)
- [ ] Every effect obeys the effects/shake/flash settings
- [ ] FPS histogram reported in telemetry

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
