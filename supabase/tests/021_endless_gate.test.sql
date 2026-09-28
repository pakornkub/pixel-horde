-- Ticket 59: a title Endless Run ranks its Endless Score only after the player's first win (has_won);
-- Endless after beating Umbra in the same Run still counts.
begin;
select plan(15);

insert into auth.users (id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', '{"nickname":"Alice"}'), ('22222222-2222-2222-2222-222222222222', '{"nickname":"Bob"}');
-- finished Runs waiting for their submit: started long enough ago for any Chapter
insert into public.runs (user_id, hero, token, started_at) values
  ('11111111-1111-1111-1111-111111111111', 'mage', 'a0000000-0000-0000-0000-000000000001', now() - interval '2 hours'),
  ('11111111-1111-1111-1111-111111111111', 'mage', 'a0000000-0000-0000-0000-000000000002', now() - interval '2 hours'),
  ('11111111-1111-1111-1111-111111111111', 'mage', 'a0000000-0000-0000-0000-000000000003', now() - interval '2 hours'),
  ('11111111-1111-1111-1111-111111111111', 'mage', 'a0000000-0000-0000-0000-000000000004', now() - interval '2 hours'),
  ('22222222-2222-2222-2222-222222222222', 'mage', 'b0000000-0000-0000-0000-000000000001', now() - interval '2 hours');
create temp table t_sub (tok uuid primary key, p jsonb);
grant select on t_sub to authenticated;
insert into t_sub select token, jsonb_build_object('runId', id, 'token', token, 'kills', 300, 'gold', 0, 'level', 20, 'pausedMs', 0) from public.runs;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Alice claims');

-- before any win: a title Endless Run is accepted, but its Endless Score is not
select is((select public.submit_run(p || '{"chapter":5,"score":0,"endlessScore":5000,"endlessStart":true}') ->> 'status' from t_sub where tok = 'a0000000-0000-0000-0000-000000000001'),
          'submitted', 'title Endless before a win: the Run itself is accepted');
select is((select endless_score from public.runs where token = 'a0000000-0000-0000-0000-000000000001'), 0::bigint, 'its Endless Score is stored as 0');
select is(public.get_leaderboard('endless') -> 'me', 'null'::jsonb, 'and nothing lands on the Endless board');
-- a client that leaves out endlessStart: an Endless Score without beating Umbra is still not ranked
select is((select public.submit_run(p || '{"chapter":5,"score":0,"endlessScore":6000}') ->> 'status' from t_sub where tok = 'a0000000-0000-0000-0000-000000000002'),
          'submitted', 'Endless Score without victory: accepted');
select is((select endless_score from public.runs where token = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'but its Endless Score is 0');

-- the first win: Umbra beaten and Endless played on in the same Run counts
select is((select public.submit_run(p || '{"chapter":10,"score":40000,"endlessScore":7000,"victory":true}') ->> 'status' from t_sub where tok = 'a0000000-0000-0000-0000-000000000003'),
          'submitted', 'Umbra beaten, then Endless in the same Run');
select is((select endless_score from public.runs where token = 'a0000000-0000-0000-0000-000000000003'), 7000::bigint, 'its Endless Score counts');
select is((public.get_leaderboard('endless') -> 'me' ->> 'score')::bigint, 7000::bigint, 'and lands on the Endless board');

-- after the win: title Endless counts
select is((select public.submit_run(p || '{"chapter":6,"score":0,"endlessScore":9000,"endlessStart":true}') ->> 'status' from t_sub where tok = 'a0000000-0000-0000-0000-000000000004'),
          'submitted', 'title Endless after a win');
select is((select endless_score from public.runs where token = 'a0000000-0000-0000-0000-000000000004'), 9000::bigint, 'counts in full');
select is((public.get_leaderboard('endless') -> 'me' ->> 'score')::bigint, 9000::bigint, 'and raises the Endless board entry');

-- a title Endless Run cannot unlock itself by also claiming victory
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","session_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Bob claims');
select is((select public.submit_run(p || '{"chapter":10,"score":0,"endlessScore":8000,"endlessStart":true,"victory":true}') ->> 'status' from t_sub where tok = 'b0000000-0000-0000-0000-000000000001'),
          'submitted', 'title Endless claiming victory before a win: accepted');
select is((select endless_score from public.runs where token = 'b0000000-0000-0000-0000-000000000001'), 0::bigint, 'but its Endless Score is 0');

select * from finish();
rollback;
