# 02: Guests see real monster HP and kills without waiting for the host

**What to build:** Owner co-op playtest: "my friend hits monsters and their HP does not go down". Guests never know
monster HP (`mirrorEnemies` sets it to 1e12), so Elite HP bars stay full on the guest, and a monster the guest killed
lives on for a round trip (~0.3–0.5 s): the guest's auto-aim keeps shooting it and the damage is wasted. Send each
monster's HP in the snapshot and let the guest predict: subtract its own damage the host has not confirmed yet; a
monster predicted dead disappears (death puff) and is no longer targeted; the host still decides real deaths.

**Blocked by:** 01 (same files; one PR per step)

**Status:** ready-for-agent

- [ ] Snapshot: HP per monster (compact, e.g. 2 chars log-scaled) + the last guest damage batch the host applied (per guest)
- [ ] Guest: unconfirmed damage per monster → predicted HP; hide + stop targeting at ≤ 0; restore if the host says it lives
- [ ] Elite HP bars on the guest use the predicted HP
- [ ] Snapshot size test stays under the relay limit
