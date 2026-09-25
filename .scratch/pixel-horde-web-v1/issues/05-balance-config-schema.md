# 05: Balance Config schema with every tunable number

**What to build:** Every tunable gameplay number lives in one zod schema (default, allowed range, description) with shared and per-World sections; the sim reads all numbers from a resolved config object and the game ships the defaults so it works offline.

**Blocked by:** 02 (Extract the headless deterministic sim core)

**Status:** done

- [x] All numbers from the original game (stage length, spawn, Director, enemy scaling, skills, economy, events) are schema fields
- [x] Loading a config validates it; out-of-range values are rejected with a clear error
- [x] Defaults reproduce current gameplay exactly (golden replay unchanged)
- [x] Config schema tests cover defaults, rejection and shared + per-World merge

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `packages/config/src/schema.ts` (≈560 fields: `shared` rules + `worlds.lumora` enemy stats), `parseBalanceConfig` / `resolveConfig` / `withOverrides` / `listFields` (for Admin forms), feature-flag schema in `flags.ts`. The sim reads `s.cfg` everywhere; `createSim({config})` defaults to `DEFAULT_RESOLVED`; the game passes `apps/game/src/config.ts` → `active.cfg`. Golden replays unchanged. Remaining literals in the sim are presentation or geometry details (hazard spreads, Shadow Clone projectile shapes, pet breath arc) — add them to the schema when someone wants to tune them.
