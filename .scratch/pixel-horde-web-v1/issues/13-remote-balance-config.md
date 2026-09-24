# 13: Versioned Balance Config from the server

**What to build:** The live game uses the latest published Balance Config: clients check the version over REST at each Stage start, cache the config locally, lock it for that Stage, and record the versions used on the Run. Published versions are immutable.

**Blocked by:** 05 (Balance Config schema with every tunable number); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** ready-for-agent

- [ ] `balance_configs` table with draft/published/archived; publish validated server-side with the same schema
- [ ] A new version applies from the next Stage start, never mid-Stage
- [ ] No player holds a Realtime subscription
- [ ] Offline/failed fetch falls back to cached or built-in defaults
- [ ] Tests: version switch at Stage boundary, fallback path

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
