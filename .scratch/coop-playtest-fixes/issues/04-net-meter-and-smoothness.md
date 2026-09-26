# 04: Co-op net meter, never exceed the relay limit, "waiting for host", smoother guests

**What to build:** Owner co-op playtest: the friend's game stutters until it freezes (the host did not switch tabs).
Measured: host snapshots average 2.7 KB, max 7.2 KB in a 14-minute bot run (half of it hazards), under the 16 KB relay
limit, but a snapshot over the limit is dropped silently. There is no network measurement yet. Add one, fix what is
already known, then playtest again to decide whether the transport should change (WebRTC P2P behind `net/transport.ts`).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Net meter (co-op, in the I meter): ping, snapshot interval / jitter, bytes/s, host FPS (sent in the snapshot)
- [ ] Telemetry event when a guest sees a snapshot gap > 1 s
- [ ] Host trims hazards / drops / monsters so a snapshot never exceeds `MAX_MSG`
- [ ] Guest: "waiting for host" overlay instead of leaving after `coop.hostLost` s of silence (leave only much later)
- [ ] Guest interpolation buffer (render ~100 ms behind) for monsters, mates and drops
- [ ] Host: no per-comparison allocation when sorting drops (`packGems`)
