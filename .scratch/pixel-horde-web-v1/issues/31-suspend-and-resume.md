# 31: Suspend and resume a Run

**What to build:** Solo main-mode and Endless Runs auto-save at every Stage start and on Esc "save and quit"; the checkpoint is stored on the server with a hash plus a local copy. The title offers "continue from Chapter N" (also on another device); resuming restarts that Stage with its locked config version. Starting a new Run warns before discarding the save; if a Season ended meanwhile, the Run finishes unranked.

**Blocked by:** 19 (8-Chapter Run, route choice, King-must-die, Escape and the new Score); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** done (awaiting owner playtest)

- [x] Pause segments are excluded from the minimum-play-time check
- [x] A copied or stale checkpoint fails `submit_run`
- [x] Not available in co-op; daily challenge flag reserved
- [x] Backend-seam tests for cross-device resume and single-use checkpoints

## Notes (implementation)

- Sim: `Sim.checkpoint()` is taken automatically at every Stage start (state without live monsters/menus, RNG streams, ~a few KB; hash = two FNV-1a halves). `createSim({ resume, config })` restores it; resumed Stages replay bit-exactly (`tests/checkpoint.test.ts`).
- Client (`apps/game/src/save.ts`): auto-save at every Stage start to `pixelhorde-save` and the server; pause menu "Save and quit" (warns that the unfinished Stage's EXP/Gold are lost); title "Continue: Chapter N (Hero)" (server copy from another device wins when newer); a new Run asks before discarding the save. The resumed Stage uses the checkpoint's locked config version (fetched if needed). Draft-config sessions and daily mode never save.
- Single use: after continuing, that checkpoint is never saved again (client and server refuse — no Stage retries); the next Stage start makes the next save.
- Server (`supabase/migrations/20260925000008_checkpoints.sql` + edits): `save_checkpoint`, `get_checkpoint`, `resume_run` (latest hash only, consumes it, adds the suspended time to `runs.suspended_ms`), `submit_run` subtracts suspended time and rejects a Run continued from a stale checkpoint (`STALE_CHECKPOINT`), `start_run` records the Season and discards older saves, `record_leaderboard` skips Runs that began in an earlier Season (finish unranked; the player is told on resume).
- Co-op: not available (co-op arrives in ticket 41/42; saves are solo only by construction). Tests: `supabase/tests/008_checkpoints.test.sql`, `tests/browser/save.spec.ts`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
