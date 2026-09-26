# 18: Admin statistics page

**What to build:** The admin sees players per day, Runs, average play time, survival by Chapter (compared with the previous config version), Skill pick rate and reach, top errors and FPS.

**Blocked by:** 14 (Run statistics, error reporting, nightly rollups and keep-alive); 15 (Admin Console shell, admin login, audit log and control-room home)

**Status:** in-progress — live: migrations applied and the Admin is deployed to Cloudflare Pages (`pixel-horde-admin`) and in use. Only open item: Cloudflare Access is **not** in front of it yet — an anonymous request to `pixel-horde-admin.pages.dev` gets the Admin page (the database still checks the admin role on every call); owner to add the Access application (docs/deploy.md) (checked 2026-09-26 against the live project)

- [x] Charts with uPlot from `stats_daily`
- [x] Survival-by-Chapter chart can compare two config versions
- [x] Skill table flags over/under-performers
- [x] Needs-attention rules extended with Skill outliers and abnormal Gold

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`

**Notes (implementation):** `stats.tsx` with uPlot: players and Runs per day, average play time, survival by Chapter comparing two config versions (grouped bars), Skill pick rate / average level / reach Ch6+ with over/under flags, FPS histogram, top errors. Rollup v2 adds `skill_reach6`. Needs-attention gets Skill outliers (client) and abnormal Gold (server).
