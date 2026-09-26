# 05: The room survives a host who drops for a moment

**What to build:** Found while checking ticket 04 with two browsers: freezing the host's page (what a phone does when
its screen turns off or the app goes to the background) makes the browser drop the host's WebSocket; the relay
(`RoomCore.leave`) then closes the room for every guest immediately. Keep the room open for a grace period instead and
let the same host (same `pid`) come back and carry on; guests keep showing "waiting for host" meanwhile.

**Blocked by:** 04

**Status:** needs-triage (owner: worth it? first see whether the playtest meter points at the network or the host)

- [ ] `RoomCore`: when the host leaves during a locked Run, mark the room host-away instead of closing; a host `join`
      with the same pid takes the host seat back; after the grace (Durable Object alarm; memory hub: a tick) it closes
- [ ] Guests learn the host's new connection id from `peers` (session `hostId`)
- [ ] Host client: on a network close during a Run, reconnect with the same code / pid (a few tries), keep its sim
- [ ] Host sim: its own co-op id changes on reconnect (`coop.self`; pot / acks keyed by id) — map or keep the old id
- [ ] Tests: memory hub (host drops, comes back, guests keep playing), Playwright with a frozen host page
