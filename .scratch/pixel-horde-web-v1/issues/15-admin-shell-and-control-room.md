# 15: Admin Console shell, admin login, audit log and control-room home

**What to build:** The admin opens the Admin site (Cloudflare Pages behind Access, admin role enforced by the database), sees the sidebar shell and a control-room home with key numbers and a "needs attention" list with inline actions. Every admin RPC is written to an append-only audit log by a trigger.

**Blocked by:** 12 (Feature flags, maintenance mode, minimum build and announcements); 14 (Run statistics, error reporting, nightly rollups and keep-alive)

**Status:** in-progress — live: migrations applied and the Admin is deployed to Cloudflare Pages (`pixel-horde-admin`) and in use. Only open item: confirm Cloudflare Access sits in front of it (docs/deploy.md) (checked 2026-09-26 against the live project)

- [x] Admin app built with Preact; sidebar pages stubbed per the prototype on branch `prototype/admin-console`
- [x] Non-admins cannot call admin RPCs (pgTAP)
- [x] Audit trigger records actor, action, target, before/after; nobody can edit or delete rows
- [x] Needs-attention rules v1: Chapter drop-off anomaly, suspicious scores, new/spiking errors, free-quota warnings
- [x] Admin nav works on mobile as a scrollable top bar

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `apps/admin` (Preact): sidebar shell (becomes a scrollable top bar under 900 px), control-room home with KPIs and needs-attention rules v1 from `admin_overview()` (Chapter drop-off anomaly, suspicious scores, new/spiking errors, abnormal Gold, free-quota, co-op review) plus Skill outliers computed from rollups. `?demo` runs on in-memory sample data. Admin RPCs: migration `20260925000007_admin.sql`; audit trigger/table from `…0004…`.
