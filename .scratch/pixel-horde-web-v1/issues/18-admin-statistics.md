# 18: Admin statistics page

**What to build:** The admin sees players per day, Runs, average play time, survival by Chapter (compared with the previous config version), Skill pick rate and reach, top errors and FPS.

**Blocked by:** 14 (Run statistics, error reporting, nightly rollups and keep-alive); 15 (Admin Console shell, admin login, audit log and control-room home)

**Status:** ready-for-agent

- [ ] Charts with uPlot from `stats_daily`
- [ ] Survival-by-Chapter chart can compare two config versions
- [ ] Skill table flags over/under-performers
- [ ] Needs-attention rules extended with Skill outliers and abnormal Gold

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
