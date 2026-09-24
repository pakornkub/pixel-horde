# 31: Suspend and resume a Run

**What to build:** Solo main-mode and Endless Runs auto-save at every Stage start and on Esc "save and quit"; the checkpoint is stored on the server with a hash plus a local copy. The title offers "continue from Chapter N" (also on another device); resuming restarts that Stage with its locked config version. Starting a new Run warns before discarding the save; if a Season ended meanwhile, the Run finishes unranked.

**Blocked by:** 19 (8-Chapter Run, route choice, King-must-die, Escape and the new Score); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** ready-for-agent

- [ ] Pause segments are excluded from the minimum-play-time check
- [ ] A copied or stale checkpoint fails `submit_run`
- [ ] Not available in co-op; daily challenge flag reserved
- [ ] Backend-seam tests for cross-device resume and single-use checkpoints

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
