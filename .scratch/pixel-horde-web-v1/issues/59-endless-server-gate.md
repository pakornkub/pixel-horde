# 59: The server checks the first win for title Endless Runs

**Status:** ready-for-human (merged in PR #59; migration `20260930000043_endless_gate.sql` is applied)
Blocked by: 55 (PR #51, merged)

**Problem:** the title screen's Endless button (ticket 55, `#endlessRunBtn`, sim `mode: 'endless'`) opens only after the
first win, but only the client checks that (`metaSync.hasWon()`). A title Endless Run is submitted as a solo Run with
score 0 plus `endlessScore`, and `record_leaderboard` puts any `endless_score > 0` on the Endless board. The server never
checked the win, so an edited local save could rank Endless scores without beating Umbra.

Owner decision (2026-09-27, option A): close it on the server, as a follow-up to #51.

**What was built:**
- Client: `RunResult.endlessStart` (`apps/game/src/net/backend.ts`). `main.ts` sets it when the sim's `mode` is
  `'endless'` (so a Continued title Endless Run carries it too) and the Supabase adapter sends it as `p.endlessStart`.
- Migration `20260930000043_endless_gate.sql`: `submit_run` (0033's, with the co-op `run_problem` args and `crack_max`
  clamps kept) stores the Endless Score only when
  - the player has won before (`public.has_won(uid)`, 0036: Heart Crack ≥ 1 or `heroesWon` non-empty), or
  - this Run beat Umbra itself (`victory`) and did not start as title Endless.
  Otherwise `endless_score` is stored as 0, so nothing reaches the Endless board. The check runs before this Run's own
  victory unlocks Heart Crack, so a title Endless Run cannot unlock itself by also claiming victory.
- A client that leaves `endlessStart` out gains nothing: an Endless Score without victory before a win is zeroed too.
- Zeroed, not rejected: the Run keeps its Gold, Weapons, facts and main Score (0 for title Endless). The only way to hit
  the gate is a save or client edited around the title button, and a rejection would also take the Run's Gold if some
  edge case was missed. Switching to a reject reason (`ENDLESS_LOCKED`) is one line if the owner prefers it.

**Tests:** `supabase/tests/021_endless_gate.test.sql` (before a win: title Endless and victory-less Endless scores are
0 and off the board; Umbra + Endless in one Run counts; title Endless after the win counts; title Endless claiming
victory before a win is 0). `019_title_endless.test.sql` (ticket 55) now gives its player a win first and sends
`endlessStart`. `tests/db.test.ts` checks that the client's flag and the latest `submit_run` use the same key, so a later
redefinition of `submit_run` (e.g. the 5th Hero's 0037) that drops the check fails.

**Owner steps:** apply `supabase/migrations/20260930000043_endless_gate.sql`. Until it is applied, the new client field is
ignored by the old `submit_run` (behaviour unchanged).

## Comments
