# 02: Guests see real monster HP and kills without waiting for the host

**What to build:** Owner co-op playtest: "my friend hits monsters and their HP does not go down". Guests never know
monster HP (`mirrorEnemies` sets it to 1e12), so Elite HP bars stay full on the guest, and a monster the guest killed
lives on for a round trip (~0.3–0.5 s): the guest's auto-aim keeps shooting it and the damage is wasted. Send each
monster's HP in the snapshot and let the guest predict: subtract its own damage the host has not confirmed yet; a
monster predicted dead disappears (death animation) and is no longer targeted; the host still decides real deaths.

**Blocked by:** 01 (same files; one PR per step)

**Status:** ready-for-human (owner co-op playtest; code only, no migration or config)

- [x] Snapshot `eh`: 4 characters per monster in `e` order — HP as a 3-character float rounded UP (`encHp`/`decHp`,
      ±0.03%) + share of max HP (0–63); `ak`: last damage batch applied per guest
- [x] Guest `me` message carries the batch number `q`; the host session passes it to the sim (`remoteHits.from/q`),
      which records `coop.acks`
- [x] Guest: `hp` = host HP − unconfirmed damage (`out` + `outU` + `pend`); its own hits lower it at once; at ≤ 0 the
      monster dies on the guest (`ghostKill`: `kill` event → death animation) and leaves the mirror
- [x] Elite HP bars on the guest now move (real HP); Kings / Guardian / Rival keep the boss HP % as before
- [x] Fix: a guest's normal and Ultimate damage to one monster in the same 0.1 s batch were summed with opposite signs
      and cancelled out (`out` / `outU` kept apart)
- [x] Tests in `tests/coop.test.ts`; checked with two browsers through the local room worker (guest HP matches the
      host's, batches acknowledged, nothing pending left)

## Notes

- Rounding HP up means a predicted kill is always a real one; at worst a monster lives one snapshot longer (as before).
- An older host sends no `eh`/`ak`: the guest keeps the old behaviour (HP unknown, nothing predicted).
- Snapshot grows by 4 characters per monster (≤ 920); the pack test limit is now 6 KB (relay limit 16 KB).
