# 16: Admin tuning lab for Balance Config

**What to build:** The admin searches every Balance Config value, edits with live range validation, sees an impact chart and per-version history, stages changes with a note, tests them live on their own device with the draft config, and publishes or rolls back (always creating a new version).

**Blocked by:** 13 (Versioned Balance Config from the server); 15 (Admin Console shell, admin login, audit log and control-room home)

**Status:** in-progress — live: migrations applied and the Admin is deployed to Cloudflare Pages (`pixel-horde-admin`) and in use. Only open item: Cloudflare Access is **not** in front of it yet — an anonymous request to `pixel-horde-admin.pages.dev` gets the Admin page (the database still checks the admin role on every call); owner to add the Access application (docs/deploy.md) (checked 2026-09-26 against the live project)

- [x] Editor generated from the zod schema (no hand-written fields)
- [x] Staged-changes panel shows old → new; publish requires a note
- [x] "Test live" opens the game locally with the draft config without affecting players
- [x] Rollback creates a new version equal to the chosen old one
- [x] All actions appear in the audit log

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `apps/admin/src/pages/balance.tsx` builds the editor from `listFields()` (zod schema), validates ranges live, shows survival for the current vs previous version and the value per version, stages changes old → new, requires a note, publishes via `publish_config` (server re-validates with the JSON Schema), rolls back as a new version. "Test live" opens the game with `#draftcfg=<changed fields>`: that tab runs the draft locally, offline, with a badge, never replaced by the server config and never submitting scores.

**Update 2026-09-26:** balance passes stack onto one draft (`packages/config/src/pass-stack.ts`); a publish stores the pass report (`config_reports`, migration 0018, live — Admin → Balance → รายงาน) and writes a patch-notes entry (`changelog`, migration 0019, live — Admin → อัปเดตเกม, website `updates.html`). Difficulty-preset knobs `shared.presets.*` (migration 0017, live) are tuned here too.
