-- Owner-approved (2026-09-28): admin review of Runs that flushed via submit_offline_run while
-- `maintenance` blocked the server-verified path, so record_leaderboard "kept them unranked".
begin;
select plan(18);

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '{"nickname":"Alice"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Alice's client queues a Run while offline, then flushes it once the server is reachable again
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Alice claims a session');
select is(public.submit_offline_run('{"clientRunId":"m1","chapter":4,"kills":300,"gold":80,"playMs":240000,"hero":"mage","score":9000}') ->> 'status',
          'offline', 'the queued Run flushes as offline');

reset role;
create temp table t_run as select id from public.runs where status = 'offline' and client_run_id = 'm1';
grant select on t_run to authenticated;

-- non-admins are refused
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$ select public.admin_offline_runs() $$, 'NOT_ADMIN', 'listing offline Runs is admin-only');
select throws_ok(format($f$ select public.admin_rank_offline_run('%s') $f$, (select id from t_run)), 'NOT_ADMIN', 'ranking is admin-only');

-- the admin lists it (defaulting to the maintenance window) and ranks it
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(jsonb_path_exists(public.admin_offline_runs(now() - interval '1 hour', now()), '$.rows[*] ? (@.userId == "11111111-1111-1111-1111-111111111111")'),
          'the offline Run is listed for review');
select is(jsonb_array_length(public.admin_offline_runs(now() - interval '1 hour', now(), true) -> 'rows'), 1, 'one Run in the given window');
select is((public.admin_rank_offline_run((select id from t_run)) ->> 'appliedSolo')::boolean, true, 'ranking adds it to the solo board');

reset role;
select is((select verified from public.leaderboard where board = 'solo' and user_id = '11111111-1111-1111-1111-111111111111'), false,
          'as an unverified entry, same as a co-op one');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(format($f$ select public.admin_rank_offline_run('%s') $f$, (select id from t_run)), 'ALREADY_REVIEWED', 'cannot rank the same Run twice');
select is(jsonb_array_length(public.admin_offline_runs(now() - interval '1 hour', now()) -> 'rows'), 0, 'reviewed Runs drop off the default (unreviewed) listing');
select lives_ok($$ select public.verify_score('11111111-1111-1111-1111-111111111111', 'solo') $$, 'admin verifies the ranked entry, same flow as verify_coop');

reset role;
select is((select verified from public.leaderboard where board = 'solo' and user_id = '11111111-1111-1111-1111-111111111111'), true,
          'now verified like any other solo score');
select is((select offline_review from public.runs where id = (select id from t_run)), 'ranked', 'the Run is marked reviewed');

-- a second offline Run gets rejected instead of ranked
insert into public.runs (user_id, client_run_id, hero, mode, status, score, chapter, kills, gold_earned, started_at, ended_at) values
  ('11111111-1111-1111-1111-111111111111', 'm2', 'mage', 'solo', 'offline', 500, 1, 10, 5, now() - interval '10 min', now());
create temp table t_run2 as select id from public.runs where client_run_id = 'm2';
grant select on t_run2 to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(format($f$ select public.admin_reject_offline_run('%s', 'looks off') $f$, (select id from t_run2)), 'admin rejects a Run instead');

reset role;
select is((select offline_review from public.runs where client_run_id = 'm2'), 'rejected', 'marked rejected, not ranked');
select is((select count(*)::int from public.leaderboard where user_id = '11111111-1111-1111-1111-111111111111' and board = 'solo'), 1,
          'the rejected Run never touches the leaderboard');

-- ranking a Run that scores lower than the player's existing best marks it reviewed but never overtakes the board
insert into public.runs (user_id, client_run_id, hero, mode, status, score, chapter, kills, gold_earned, started_at, ended_at) values
  ('11111111-1111-1111-1111-111111111111', 'm3', 'mage', 'solo', 'offline', 100, 1, 5, 2, now() - interval '5 min', now());
create temp table t_run3 as select id from public.runs where client_run_id = 'm3';
grant select on t_run3 to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select is((public.admin_rank_offline_run((select id from t_run3)) ->> 'appliedSolo')::boolean, false, 'a lower-scoring Run does not overtake the existing best');
select is((
  select (elem ->> 'onSolo')::boolean from jsonb_array_elements(public.admin_offline_runs(now() - interval '1 hour', now(), true) -> 'rows') elem
  where elem ->> 'id' = (select id::text from t_run3)
), false, 'the listing reflects that ranking did not put it on the solo board');

select * from finish();
rollback;
