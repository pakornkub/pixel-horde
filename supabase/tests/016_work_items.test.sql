-- Work items: the routine writes progress (agent_report, owner role only), admins read it, answer decisions and close items.
begin;
select plan(15);

insert into auth.users (id, raw_user_meta_data) values ('22222222-2222-2222-2222-222222222222', '{"nickname":"Tester"}'), ('aaaaaaaa-0000-0000-0000-000000000002', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
insert into public.feedback (user_id, category, message) values ('22222222-2222-2222-2222-222222222222', 'bug', 'ต้องเลื่อนถึงเห็นปุ่มผูกบัญชี');

-- the routine (database owner) reports
select ok(public.agent_report(jsonb_build_object('kind', 'ux', 'source', 'feedback', 'title', 'Title screen too tall on phones',
  'refs', jsonb_build_array(jsonb_build_object('type', 'feedback', 'id', (select max(id) from public.feedback))), 'status', 'in_progress', 'note', 'reproduced at 377x648')) > 0, 'the routine creates an item');
select is((select jsonb_array_length(log) from public.work_items order by id desc limit 1), 1, 'creating adds one timeline entry');
select lives_ok($$ select public.agent_report(jsonb_build_object('id', (select max(id) from public.work_items), 'summary', 'looking')) $$, 'a summary-only update');
select is((select jsonb_array_length(log) from public.work_items order by id desc limit 1), 1, 'no status and no note: no timeline entry');
select throws_ok($$ select public.agent_report('{"id": 999999}') $$, 'NO_SUCH_ITEM', 'unknown id is refused');
select throws_ok($$ select public.agent_report('{"title":"x","pr_url":"https://evil.example/pr"}') $$, '23514', 'only GitHub PR links');
select public.agent_report('{"kind":"balance","title":"Vex flask misses bosses","status":"needs_decision","decision":{"question":"Aim the flask?","options":[{"key":"a","label":"Aim at the nearest enemy"},{"key":"b","label":"Keep random"}],"recommended":"a"}}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ select public.agent_report('{"title":"hack"}') $$, '42501', 'players cannot call agent_report');
select throws_ok($$ select public.admin_work_items() $$, 'NOT_ADMIN', 'players cannot read work items');

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$ select public.agent_report('{"title":"hack"}') $$, '42501', 'admins cannot call agent_report from the browser either');
select is(public.admin_work_items() -> 0 ->> 'status', 'needs_decision', 'decisions are listed first');
select throws_ok($$ select public.answer_work_item((select (public.admin_work_items() -> 0 ->> 'id')::bigint), 'z', '') $$, 'BAD_OPTION', 'the answer must be one of the options');
select public.answer_work_item((public.admin_work_items() -> 0 ->> 'id')::bigint, 'a', 'แต่ห้ามแรงขึ้น');
select is(public.admin_work_items('todo') -> 0 -> 'answer' ->> 'option', 'a', 'the answer is stored and the item goes back to todo');
select is(public.admin_work_items('todo') -> 0 -> 'answer' ->> 'by', 'Owner', 'with who answered');
reset role;

-- shipping closes the referenced feedback
select public.agent_report(jsonb_build_object('id', (select id from public.work_items where kind = 'ux'), 'status', 'shipped', 'pr_url', 'https://github.com/pakornkub/pixel-horde/pull/16'));
select is((select status from public.feedback order by id desc limit 1), 'done', 'the feedback is marked done when its item ships');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select public.set_work_item_status((select (public.admin_work_items('shipped') -> 0 ->> 'id')::bigint), 'todo', 'still scrolls on my phone');
select is(jsonb_array_length(public.admin_work_items('open')), 2, 'reopened: both items are open');
reset role;

select * from finish();
rollback;
