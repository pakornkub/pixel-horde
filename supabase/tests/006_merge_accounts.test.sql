-- Ticket 11: merge rules when a Google identity already has a save.
begin;
select plan(12);

-- U1 = anonymous device save, U2 = existing Google account
insert into auth.users (id, is_anonymous, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', true, '{"nickname":"Anon"}'), ('22222222-2222-2222-2222-222222222222', false, '{"nickname":"Google"}');
insert into public.meta_progress (user_id, gold, shop, heroes) values
  ('11111111-1111-1111-1111-111111111111', 900, '{"power":3,"greed":1}', array['mage','knight','ranger']),
  ('22222222-2222-2222-2222-222222222222', 400, '{"power":1,"vigor":4}', array['mage','knight','alchemist']);
insert into public.runs (id, user_id, hero, status, score, chapter, ended_at) values
  ('c1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ranger', 'submitted', 5000, 4, now()),
  ('c2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'mage', 'submitted', 3000, 3, now());
select public.record_leaderboard('c1111111-0000-0000-0000-000000000001');
select public.record_leaderboard('c2222222-0000-0000-0000-000000000002');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'anonymous device claims');
create temp table t_ticket as select public.create_merge_ticket() as t;
grant select on t_ticket to authenticated;

-- now signed in as the Google account
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","session_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select throws_ok($$ select public.merge_accounts(gen_random_uuid()) $$, 'MERGE_TICKET_INVALID', 'a made-up ticket does nothing');
select lives_ok($$ select public.merge_accounts((select t from t_ticket)) $$, 'merge with the real ticket');
select throws_ok($$ select public.merge_accounts((select t from t_ticket)) $$, 'MERGE_TICKET_INVALID', 'a ticket works once');

reset role;
select is((select gold from public.meta_progress where user_id = '22222222-2222-2222-2222-222222222222'), 900::bigint, 'the higher Gold is kept, never the sum');
select is((select shop from public.meta_progress where user_id = '22222222-2222-2222-2222-222222222222'), '{"power":3,"greed":1,"vigor":4}'::jsonb, 'higher Shop level per item');
select is((select heroes from public.meta_progress where user_id = '22222222-2222-2222-2222-222222222222'), array['alchemist','knight','mage','ranger'], 'unlocks are united');
select is((select score from public.leaderboard where user_id = '22222222-2222-2222-2222-222222222222' and board = 'solo'), 5000::bigint, 'the best score is kept');
select is((select count(*)::int from public.leaderboard where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'no rows left for the old account');
select is((select count(*)::int from public.runs where user_id = '22222222-2222-2222-2222-222222222222'), 2, 'Run history moves over');
select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0, 'the anonymous account is deleted');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 0, 'with its profile');

select * from finish();
rollback;
