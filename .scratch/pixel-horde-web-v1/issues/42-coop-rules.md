# 42: Co-op rules on the new Run structure

**What to build:** Co-op follows the full ruleset: route vote (15 s, host breaks ties), parallel personal Stage-end decisions (ready or 30 s), boss HP ×(1 + 0.6 × extra players), per-player rewards (team XP, Gold from team kills with own Greed, own King rewards and Companions), revive a downed ally by standing next to them for 3 s (once per player per Stage) with arrows to downed allies, Run ends when all are down, co-op Score to the co-op board, Endless continue vote.

**Blocked by:** 41 (Co-op rooms on a Durable Object and the lobby); 19 (8-Chapter Run, route choice, King-must-die, Escape and the new Score); 26 (Skill Points, King rewards, Gold-for-Skill-Points and the bought revive); 28 (Guardians, Companions and the Three-headed Dragon)

**Status:** done (awaiting owner playtest)

- [x] Guests load the host's Balance Config version
- [x] In-memory tests for vote, revive, all-down end, per-player rewards

## Notes (implementation)

- Host-authoritative: monsters chase the nearest living player; spawns +60% per living ally; boss / Guardian / Umbra HP ×(1 + 0.6 × extra players) (`coop.bossHpPerMate`).
- The room waits while anyone chooses a level-up or opens a chest ("WAITING FOR name"); the host's pause pauses everyone; a guest's pause menu never stops the room.
- Stage end: everyone uses their own clear screen at the same time; the host continues when all are ready or after 30 s. Route: vote for 15 s, most votes win, a tie goes to the host's pick (`apps/game/src/coop/team.ts`).
- Rewards per player: team EXP from every kill (with the player's own Wisdom), Gold 0.1 per team kill with their own Greed, their own King rewards (Skill Point, chest wheel, Gold, Weapon chance), their own Guardian Companion and Shadow Clone.
- Down: an ally standing next to you for 3 s revives you at 30% HP (once per player per Stage); arrows point to downed allies off screen; a downed player may buy the revive without stopping the room, or gets up at the next Chapter. The Run ends when everyone is down.
- Guests use the host's Balance Config version; co-op Runs are submitted with mode `coop` (co-op board, admin confirmation before Season rewards).
- Endless: when the host continues, guests continue too (their Endless Score starts there); a guest may finish instead and keeps their rewards; if the host finishes, the Run ends for all.
- Tests: `tests/coop.test.ts` (mirror, remote damage, boss HP, waiting, revive, all-down, next Stage, Endless, 4-minute 4-player stability), `apps/game/src/coop/team.test.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
