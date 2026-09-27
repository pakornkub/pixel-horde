# 04: Co-op net meter, never exceed the relay limit, "waiting for host", smoother guests

**What to build:** Owner co-op playtest: the friend's game stutters until it freezes (the host did not switch tabs).
Measured: host snapshots average 2.7 KB, max 7.2 KB in a 14-minute bot run (half of it hazards), under the 16 KB relay
limit, but a snapshot over the limit is dropped silently. There is no network measurement yet. Add one, fix what is
already known, then playtest again to decide whether the transport should change (WebRTC P2P behind `net/transport.ts`).

**Blocked by:** 03

**Status:** ready-for-human (owner: apply the migration, deploy, co-op playtest with the I meter open on the guest)

- [x] Net meter (co-op lines in the I meter): guest — ping, snapshot interval ± jitter and max, in/out KB/s, host FPS,
      trimmed snapshots; host — out/in KB/s, own FPS, trimmed (`session.stats()`, `Transport.stats()`, snapshot `n`)
- [x] Telemetry event `netGap` when a guest sees a snapshot more than 1 s after the previous one
- [x] `fitSnap`: the host trims hazards, then drops, then monsters (bosses packed first) so a snapshot always fits
      `MAX_MSG` − 1.5 KB; `n.tr` counts trimmed snapshots
- [x] Guest: after `coop.hostWait` (1.5 s) without a snapshot its world pauses and "Waiting for the host… N s" shows
      (nobody gets hit by frozen monsters); it leaves only after `coop.hostGone` (60 s); `coop.hostLost` is unused now
- [x] Dead reckoning instead of a render buffer: monsters (host tick `ck` between snapshots) and mates keep moving at
      their last speed for 0.25 s when the next position is late (speeds over 400 px/s are not used)
- [x] Host: no per-comparison allocation when sorting drops (`packGems`)
- [x] Migration (whole `shared.coop`, earlier co-op fields included); Thai help; tests in `tests/coop.test.ts` and
      `apps/game/src/coop/session.test.ts`
- [x] Two-browser check through the local room worker: meter readings (ping 4 ms, snapshots 71 ± 1 ms), freezing the
      host page shows the wait after ~2 s, the guest's world holds still and does not leave at 5 s
- [ ] Owner co-op playtest: read the meter when it stutters (ping? snapshot max? host FPS? trimmed?) → decide on 05 / WebRTC

## Notes

- Found in the two-browser check: when the host's page is frozen (a phone screen turning off does this), the browser
  drops its WebSocket and the room closes for everyone at once. The guest's wait cannot help there → ticket 05.
