# 41: Co-op rooms on a Durable Object and the lobby

**What to build:** Friends play together again outside Claude: a host creates a room with a 5-character code and invite link, friends join, pick Hero and Weapon, ready up and the host starts. The host-authoritative protocol from the original game runs over the transport interface (WebSocket to a Durable Object via PartyServer). If the host drops, the room closes and everyone keeps collected rewards. "Co-op full today" and the co-op flag are respected.

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 03 (Move special events, hazards, dragon, rival and pet into the sim)

**Status:** done — room worker `pixel-horde-room` deployed by the Deploy workflow on every push to `main`, repo variable `ROOM_URL` set, deploy smoke test passing; awaiting the owner's real-network playtest (checked 2026-09-26)

- [x] Transport interface with a WebSocket adapter and an in-memory adapter
- [x] Room worker deployed; codes avoid ambiguous characters
- [x] In-memory tests: join/ready/start, damage aggregation, snapshots under 4 KB, host-drop close
- [x] Deploy-time smoke test against the real Durable Object

## Notes (implementation)

- Room rules (`packages/coop`): 5-character codes without I/L/O/0/1, first connection = host, up to 3 guests, joins only while waiting (a dropped player may come back with the same player id), host messages → all guests or one, guest messages → host only, host leaves → room closes for everyone.
- Worker (`workers/room`): one Durable Object per code (`locationHint: apac`), plain WebSocket relay (no PartyServer dependency — same behaviour, fewer moving parts), `/health`; a 503 or a socket closed before the welcome shows "co-op full" (room full or the free daily allowance used up; resets 07:00 Thai time). Deploy + smoke test (`scripts/room-smoke.mjs`) run in `deploy-pages.yml` on `main` once the Cloudflare secrets and the `ROOM_URL` repo variable exist; verified locally with `wrangler dev`.
- Transport (`apps/game/src/net/transport.ts`): WebSocket adapter + in-memory hub sharing the same room rules.
- Session (`apps/game/src/coop/session.ts`): lobby (Hero, Weapon, ready), start (seed + the host's Balance Config version), host snapshots 15 Hz (packed monsters 11 chars each, < 4 KB), guest presence + aggregated damage merged into one 10 Hz message (halves Durable Object requests), host-lost detection.
- Sim (`packages/sim/src/systems/coop.ts`): host/guest roles as in the original protocol (see ticket 42 notes).
- Lobby UI (`#ovCoop`, `apps/game/src/ui/lobby.ts`): create / join by code, invite link `?join=CODE`, player list, Ready / Start, clear messages for off / not set up / full / started / host left. The co-op flag is respected.
- PeerJS fallback adapter is not built (the DO relay covers every network; add it only if playtests show a need).
- Tests: `apps/game/src/net/transport.test.ts`, `apps/game/src/coop/session.test.ts`, `tests/coop.test.ts` (incl. snapshot size, host drop), `tests/browser/coop.spec.ts` (two browsers against `wrangler dev`, also in CI).

**Update 2026-09-26:** the deploy smoke test failed on 2 of the last 15 `main` deploys (PR #20: host-left not seen; PR #23: no relay either way) and passed on the next push — most likely its fixed 300 ms waits against the real network; worth hardening `scripts/room-smoke.mjs`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
