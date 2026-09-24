# 15: Admin Console shell, admin login, audit log and control-room home

**What to build:** The admin opens the Admin site (Cloudflare Pages behind Access, admin role enforced by the database), sees the sidebar shell and a control-room home with key numbers and a "needs attention" list with inline actions. Every admin RPC is written to an append-only audit log by a trigger.

**Blocked by:** 12 (Feature flags, maintenance mode, minimum build and announcements); 14 (Run statistics, error reporting, nightly rollups and keep-alive)

**Status:** ready-for-agent

- [ ] Admin app built with Preact; sidebar pages stubbed per the prototype on branch `prototype/admin-console`
- [ ] Non-admins cannot call admin RPCs (pgTAP)
- [ ] Audit trigger records actor, action, target, before/after; nobody can edit or delete rows
- [ ] Needs-attention rules v1: Chapter drop-off anomaly, suspicious scores, new/spiking errors, free-quota warnings
- [ ] Admin nav works on mobile as a scrollable top bar

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
