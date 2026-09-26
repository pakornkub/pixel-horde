# 45: Error / feedback triage — first fixes, a daily routine and Admin "งานแก้ไข"

**What to build:** Fix what the first live error list and player feedback showed, and set up a daily cloud routine
that keeps doing it: read `client_errors` + `feedback`, fix clear bugs through a PR, ask the owner about the rest.
The Admin Console shows the progress of every fix and the questions waiting for the owner.

**Blocked by:** 14 (telemetry), 15–18 (Admin Console), player feedback (migration `20260926000015`)

**Status:** done — PR #18 merged, migration 0021 live, Admin → งานแก้ไข in use; the daily routine runs (its first fixes merged as PRs #24 and #25 on 2026-09-26)

- [x] Feedback #1 "หน้าแรกบนมือถือต้องเลื่อนถึงจะเห็นปุ่มผูกบัญชี" (iPhone, Facebook in-app browser, 377×648)
- [x] Error `sqre4r` drawImage on a 0-size canvas — already fixed in `7ff4de5` (buffers ≥ 1 px); it came from the dev server
- [x] Error `1r2iryt` "browsing context is going away" — WebKit noise when a page closes, now filtered
- [x] Admin → งานแก้ไข: work items, owner decisions, timeline, PR links
- [x] Daily routine instructions: `docs/agents/triage-routine.md`

## Notes (implementation)

- Title screen: at 377×648 the content was 666 px in a 616 px box, the Google button ended at y = 661. A new
  `max-height: 720px` step (smaller logo, 64 px Hero, tighter gaps) makes it 614 px; the Google button is on screen.
- In-app browsers (`apps/game/src/platform/inapp.ts`): Facebook / Messenger / Instagram / LINE / TikTok / X and
  Android WebViews block Google sign-in (`403 disallowed_useragent`). There the link row says so and the button
  becomes "Open in Chrome" (Android intent URL) or "Copy game link" (iOS).
- Telemetry: errors are not recorded on a dev server or a local host (`isLocalHost`), and known browser noise is
  dropped (`NOISE` in `apps/game/src/telemetry.ts`).
- `public.work_items` (`supabase/migrations/20260927000021_work_items.sql`): `agent_report(jsonb)` is callable only
  by the database owner / service role (the routine's Supabase connector); admins read with `admin_work_items`,
  answer with `answer_work_item` (item goes back to `todo` for the next run) and close / reopen with
  `set_work_item_status`. Shipping an item marks its referenced feedback `done`.
- Admin: new page `apps/admin/src/pages/work.tsx`; the home "ต้องดู" list shows questions and open PRs; feedback
  rows link to their work item. Demo data in `?demo`.
- Tests: `apps/game/src/platform/inapp.test.ts`, `apps/game/src/telemetry.test.ts`, `supabase/tests/016_work_items.test.sql`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
