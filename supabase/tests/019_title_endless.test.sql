-- Ticket 55: an Endless Run started from the title (sim mode 'endless') is submitted as a solo Run with no main
-- Score (0), no victory and an Endless Score; it is accepted and ranks on the Endless board only.
-- The title button opens after the first win, and the server checks that too (ticket 59, 021_endless_gate): Endy has won.
begin;
select plan(8);

insert into auth.users (id, raw_user_meta_data) values ('55555555-5555-5555-5555-555555555555', '{"nickname":"Endy"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","session_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'the player claims a session');
create temp table t_run as select public.start_run('mage') as r;
reset role;
-- Chapter 10 needs 0.9 × (60+80+100+120+140+150+150+150+150) = 990 s of play
update public.runs set started_at = now() - interval '30 minutes' where user_id = '55555555-5555-5555-5555-555555555555';
update public.meta_progress set stats = stats || '{"heartCrack":1}'::jsonb where user_id = '55555555-5555-5555-5555-555555555555';
set local role authenticated;

create temp table t_out as
select public.submit_run(jsonb_build_object('runId', r ->> 'runId', 'token', r ->> 'token', 'result', 'dead', 'chapter', 10, 'kills', 2400,
  'level', 38, 'gold', 300, 'score', 0, 'endlessScore', 4321, 'endlessStart', true, 'victory', false, 'crack', 0, 'pausedMs', 0)) as o
from t_run;
select is((select o ->> 'status' from t_out), 'submitted', 'a title-Endless Run is accepted');
select is((select o ->> 'reason' from t_out), null::text, 'with no Run-check problem');

reset role;
select is((select status from public.runs where user_id = '55555555-5555-5555-5555-555555555555'), 'submitted', 'the Run is stored as submitted, not rejected');
select is((select reject_reason from public.runs where user_id = '55555555-5555-5555-5555-555555555555'), null::text, 'and not flagged');
select is((select score from public.leaderboard where board = 'endless' and user_id = '55555555-5555-5555-5555-555555555555'), 4321::bigint,
  'its Endless Score lands on the Endless board');
select is((select coalesce(max(score), 0) from public.leaderboard where board in ('solo', 'alltime') and user_id = '55555555-5555-5555-5555-555555555555'), 0::bigint,
  'no main Score on the Solo / all-time boards');
select is((select coalesce((stats ->> 'heartCrack')::int, 0) from public.meta_progress where user_id = '55555555-5555-5555-5555-555555555555'), 1,
  'no victory, so no higher Heart Crack tier is unlocked');

select * from finish();
rollback;
