-- Player feedback: validated, rate-limited per account and day, readable and triaged by admins only.
begin;
select plan(12);

insert into auth.users (id, raw_user_meta_data) values ('22222222-2222-2222-2222-222222222222', '{"nickname":"Tester"}'), ('aaaaaaaa-0000-0000-0000-000000000002', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","session_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'the player claims a session');
select throws_ok($$ select public.submit_feedback('rant', 'hello', '{}') $$, 'BAD_CATEGORY', 'unknown category is refused');
select throws_ok($$ select public.submit_feedback('bug', '   ', '{}') $$, 'BAD_MESSAGE', 'an empty message is refused');
select throws_ok($$ select public.submit_feedback('bug', repeat('x', 1001), '{}') $$, 'BAD_MESSAGE', 'over 1000 characters is refused');
select ok(public.submit_feedback('bug', '  บอสตายแล้วค้าง  ', '{"build":"123","chapter":3,"evil":"drop me","hero":{"x":1}}') > 0, 'a bug report is stored');
reset role;
select is((select message from public.feedback order by id desc limit 1), 'บอสตายแล้วค้าง', 'the message is trimmed');
select is((select context from public.feedback order by id desc limit 1), '{"build":"123","chapter":"3"}'::jsonb, 'only known scalar context keys are kept');
set local role authenticated;
select lives_ok($$ select public.submit_feedback('idea', 'a', '{}'), public.submit_feedback('idea', 'b', '{}'), public.submit_feedback('idea', 'c', '{}'), public.submit_feedback('idea', 'd', '{}') $$, 'five per day are allowed');
select throws_ok($$ select public.submit_feedback('idea', 'e', '{}') $$, 'FEEDBACK_LIMIT', 'the sixth one today is refused');
select throws_ok($$ select public.admin_feedback() $$, 'NOT_ADMIN', 'players cannot read the feedback list');

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select is(jsonb_array_length(public.admin_feedback('', 'bug')), 1, 'admin filters by category');
select public.set_feedback_status((public.admin_feedback('', 'bug') -> 0 ->> 'id')::bigint, 'done');
select is(public.admin_feedback('done') -> 0 ->> 'name', 'Tester', 'status change shows, with the nickname');

select * from finish();
rollback;
