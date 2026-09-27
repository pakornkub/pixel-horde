# 03: Pickups go to the player who takes them; Gold is split at each Stage end

**What to build:** Owner co-op playtest: "the friend picks items up but nothing reaches them, they just vanish". A local
two-browser test credited both players correctly, so the likely causes are a player on an old build (no version check
when joining) and no feedback (coins under 5G show no "+G"). Owner decisions: anyone can pick up any drop and it goes
to the picker; Gold collected during a Stage is split evenly at the Stage end; a dropped chest belongs to the picker
(King and Blood Moon chests still go to everyone). EXP stays team-shared (ticket 01).

**Blocked by:** 02

**Status:** ready-for-human (owner: apply migration 0028, deploy, then load pass 2026-09-coop2 in Admin → Balance and publish)

- [x] `coop.goldSplit` (default 0 = today): coins go to the team pot `coop.pot` per picker (a "+NG" on the picker every
      time); when the Stage-end vacuum is done (or everyone is down) the host splits it once (`splitGold`): each player
      gets pot ÷ players × their own Greed; guests apply the same split from the snapshot (`gp` pot, `gs` split)
- [x] HUD: "123 G (+45)" = your share of the pot so far; clear screen row "Team Gold this Stage: 40G ÷ 2 (you picked
      up 30G) → you get 20G"
- [x] Dropped chest → only the picker spins it (`coop.chestsTo`, snapshot `cp`); King chest (wheel) and the Blood Moon
      chest still go to everyone
- [x] Fix (both modes): guests got a King's Gold twice (the King coin through the team Gold and again with the King
      kill); the King coin (`Gem.king`) no longer goes to the team
- [x] Build number in the lobby `hello`; a player on another build is named, the host cannot start, the guest is asked
      to reload (`otherBuild()` in `coop/session.ts`, lobby message)
- [x] Pass `2026-09-coop2` (`goldSplit` 1) with Thai report and patch notes; migration `20260929000028_coop_gold_split.sql`
      (whole `shared.coop`, 0026's fields included); Thai help in `desc-th.ts`
- [x] Tests: `tests/coop.test.ts` (pot, split, chest to the picker, King Gold once), `apps/game/src/coop/session.test.ts`
      (build mismatch)
- [ ] Owner co-op playtest after publishing

## Notes

- Gold per player drops to about 1 / players of before (monster Gold only; King Gold is unchanged). The co-op
  anti-cheat ceilings only get safer.
- A player who leaves mid-Stage loses their unsplit pot; what they picked up is split among those still in the room.
- A guest who (re)joins later does not receive splits made before it joined.
