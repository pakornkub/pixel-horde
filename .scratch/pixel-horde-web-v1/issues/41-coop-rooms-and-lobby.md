# 41: Co-op rooms on a Durable Object and the lobby

**What to build:** Friends play together again outside Claude: a host creates a room with a 5-character code and invite link, friends join, pick Hero and Weapon, ready up and the host starts. The host-authoritative protocol from the original game runs over the transport interface (WebSocket to a Durable Object via PartyServer). If the host drops, the room closes and everyone keeps collected rewards. "Co-op full today" and the co-op flag are respected.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 03 (Move special events, hazards, dragon, rival and pet into the sim)

**Status:** ready-for-agent

- [ ] Transport interface with a WebSocket adapter and an in-memory adapter
- [ ] Room worker deployed; codes avoid ambiguous characters
- [ ] In-memory tests: join/ready/start, damage aggregation, snapshots under 4 KB, host-drop close
- [ ] Deploy-time smoke test against the real Durable Object

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
