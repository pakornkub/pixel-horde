# 16: Admin tuning lab for Balance Config

**What to build:** The admin searches every Balance Config value, edits with live range validation, sees an impact chart and per-version history, stages changes with a note, tests them live on their own device with the draft config, and publishes or rolls back (always creating a new version).

**Blocked by:** 13 (Versioned Balance Config from the server); 15 (Admin Console shell, admin login, audit log and control-room home)

**Status:** ready-for-agent

- [ ] Editor generated from the zod schema (no hand-written fields)
- [ ] Staged-changes panel shows old → new; publish requires a note
- [ ] "Test live" opens the game locally with the draft config without affecting players
- [ ] Rollback creates a new version equal to the chosen old one
- [ ] All actions appear in the audit log

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
