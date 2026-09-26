# 13: Versioned Balance Config from the server

**What to build:** The live game uses the latest published Balance Config: clients check the version over REST at each Stage start, cache the config locally, lock it for that Stage, and record the versions used on the Run. Published versions are immutable.

**Blocked by:** 05 (Balance Config schema with every tunable number); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** done — migrations applied; the game follows the published Balance Config (now v4) (checked 2026-09-26 against the live project)

- [x] `balance_configs` table with draft/published/archived; publish validated server-side with the same schema
- [x] A new version applies from the next Stage start, never mid-Stage
- [x] No player holds a Realtime subscription
- [x] Offline/failed fetch falls back to cached or built-in defaults
- [x] Tests: version switch at Stage boundary, fallback path

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `publish_config` validates against `config_schema` (JSON Schema generated from the zod schema by `scripts/config-json.ts schema`; a test keeps it in sync) with a plpgsql validator that names each bad field; published rows are immutable (trigger); rollback = a new version. Client: `apps/game/src/live.ts` checks at launch, every Stage start and before submitting, validates with the same zod schema, caches in `pixelhorde-config`, and hands it to the Run as a `setConfig` Command that the sim applies at the next Stage start (`configVersions` recorded on the Run).
