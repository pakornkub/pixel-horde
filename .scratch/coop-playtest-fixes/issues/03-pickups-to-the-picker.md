# 03: Pickups go to the player who takes them; Gold is split at each Stage end

**What to build:** Owner co-op playtest: "the friend picks items up but nothing reaches them, they just vanish". A local
two-browser test credited both players correctly, so the likely causes are a player on an old build (no version check
when joining) and no feedback (coins under 5G show no "+G"). Owner decisions: anyone can pick up any drop and it goes
to the picker; Gold collected during a Stage is split evenly at the Stage end; a dropped chest belongs to the picker
(King and Blood Moon chests still go to everyone). EXP stays team-shared (ticket 01).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Host credits the picker: per-pickup message/counter per player, "+G" / chest feedback on the picker every time
- [ ] Stage end: team Gold split evenly (shown on the clear screen: who collected how much, what each got)
- [ ] Dropped chest → only the picker spins it
- [ ] Build version in the lobby `hello`; a mismatched player is asked to reload before joining
- [ ] Balance Config switch keeps the old "everyone gets everything" rule available
