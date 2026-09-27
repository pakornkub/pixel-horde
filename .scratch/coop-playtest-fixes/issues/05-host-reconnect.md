# 05: The room survives a host who drops for a moment

**What to build:** Found while checking ticket 04 with two browsers: freezing the host's page (what a phone does when
its screen turns off or the app goes to the background) makes the browser drop the host's WebSocket; the relay
(`RoomCore.leave`) then closes the room for every guest immediately. Keep the room open for a grace period instead and
let the same host (same `pid`) come back and carry on; guests keep showing "waiting for host" meanwhile.

**Blocked by:** 04

**Status:** ready-for-human (owner co-op playtest; deploy the room worker and the game together — no migration)

- [x] `RoomCore`: when the host's connection drops during a locked Run (no `bye`), the room waits (`hostAway`) instead
      of closing; a host `join` with the same pid takes the seat back (anyone else: `taken`); guests who drop may still
      rejoin; everyone gone while waiting closes it; `hostTimeout(awaySeq)` closes it after `HOST_GRACE_MS` (45 s)
- [x] Leaving on purpose sends `{ ctl: 'bye' }` first (`Transport.close`): the room closes at once as before; the
      lobby (not locked) still closes at once
- [x] Durable Object: schedules `hostTimeout` when the host is away (open guest sockets keep the object alive);
      memory hub: the same in auto mode, `dropHost(code)` for tests
- [x] Guests learn the host's new connection id from `peers` (session `hostId`)
- [x] Host session: on a dropped connection during the Run it reconnects with the same code / pid
      (`REJOIN_DELAYS`: 0.5, 1, 2, 3 s then every 5 s, ending inside the grace); its world waits and
      "Connection lost, getting back into the room…" shows; `reconnecting` / `reconnected` events
- [x] Host: tries again at once when the network comes back (`online`) or the page is visible again (`retryNow()`)
- [x] Host sim: `coopId` command moves `coop.self` (and its pot entry) to the new connection id
- [x] Tests: `apps/game/src/net/transport.test.ts` (wait, rejoin, stranger refused, timeout, bye),
      `apps/game/src/coop/session.test.ts` (drop → retry → back, sim id, guests carry on)
- [x] Checked on the local room worker: `scripts/room-smoke.mjs` passes; two browsers — the host's room socket closed
      from inside its page (no bye): back in about a second with a new connection id, room and guest carry on;
      the host page cut off the network for 8 s: the guest waits, then both carry on
- [ ] Owner co-op playtest on phones (screen off / app switch as host)

## Notes

- Owner decision 2026-09-27: a host who reloads or closes the page mid-Run ends the room (everyone keeps what they
  earned). Resuming a co-op Run from a saved checkpoint was not taken (bigger job). The page says `bye` on a
  non-persisted `pagehide` (wsConnect), so the room closes at once instead of waiting 45 s; a screen turning off, an
  app switch or a page kept in the back/forward cache still get the grace.
- The host's world keeps its state while reconnecting (it pauses); a guest who waited longer than `coop.hostGone`
  (60 s) has left by then — the grace (45 s) is shorter on purpose.
- A host who comes back after the room closed claims a new empty room with the same code and plays on alone.
