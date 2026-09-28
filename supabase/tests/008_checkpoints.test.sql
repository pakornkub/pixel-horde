-- Ticket 31: suspend and resume — cross-device resume, unlimited re-resume until the Chapter
-- clears (owner decision 2026-09-28), stale saves, paused time.
begin;
select plan(27);

insert into auth.users (id, raw_user_meta_data) values ('33333333-3333-3333-3333-333333333333', '{"nickname":"Cara"}');
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","session_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Cara claims (device A)');
create temp table t_run as select public.start_run('mage') as r;
grant select on t_run to authenticated;

select is(public.get_checkpoint(), null, 'no save yet');
select lives_ok(format($f$ select public.save_checkpoint('{"runId":"%s","token":"%s","chapter":2,"hash":"aaaaaaaa11111111","data":"{\"v\":1}","configVersion":0}') $f$,
  (select r ->> 'runId' from t_run), (select r ->> 'token' from t_run)), 'auto-save at a Stage start');
select lives_ok(format($f$ select public.save_checkpoint('{"runId":"%s","token":"%s","chapter":3,"hash":"bbbbbbbb22222222","data":"{\"v\":1}","configVersion":0,"quit":true}') $f$,
  (select r ->> 'runId' from t_run), (select r ->> 'token' from t_run)), 'save and quit keeps the newest checkpoint');

-- another device (new session of the same account) sees the save
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","session_id":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Cara claims on device B');
select is((public.get_checkpoint() ->> 'chapter')::int, 3, 'device B is offered "continue from Chapter 3"');
select is((public.get_checkpoint() ->> 'hash'), 'bbbbbbbb22222222', 'with the latest checkpoint');
select throws_ok(format($f$ select public.resume_run('%s', 'aaaaaaaa11111111') $f$, (select r ->> 'runId' from t_run)), 'STALE_CHECKPOINT', 'an older (copied) checkpoint cannot be resumed');

reset role;
update public.runs set suspended_at = now() - interval '2 hours', started_at = now() - interval '3 hours' where id = (select (r ->> 'runId')::uuid from t_run);
set local role authenticated;
select is((public.resume_run((select (r ->> 'runId')::uuid from t_run), 'bbbbbbbb22222222') ->> 'ok')::boolean, true, 'the latest checkpoint resumes');
select is((public.get_checkpoint() ->> 'hash'), 'bbbbbbbb22222222', 'the checkpoint is kept after a resume, not deleted (unlimited re-resume)');
select is((public.resume_run((select (r ->> 'runId')::uuid from t_run), 'bbbbbbbb22222222') ->> 'ok')::boolean, true, 'a disconnect after a resume can resume the same checkpoint again');
select lives_ok(format($f$ select public.save_checkpoint('{"runId":"%s","token":"%s","chapter":3,"hash":"bbbbbbbb22222222","data":"{\"v\":1}","configVersion":0,"quit":true}') $f$,
  (select r ->> 'runId' from t_run), (select r ->> 'token' from t_run)), 'saving and quitting with the resumed hash again is allowed (no CHECKPOINT_USED)');
select is((public.resume_run((select (r ->> 'runId')::uuid from t_run), 'bbbbbbbb22222222') ->> 'ok')::boolean, true, 'and it resumes a third time');

-- clearing the Chapter starts a new one: the fresh checkpoint supersedes the old
select lives_ok(format($f$ select public.save_checkpoint('{"runId":"%s","token":"%s","chapter":4,"hash":"cccccccc33333333","data":"{\"v\":1}","configVersion":0}') $f$,
  (select r ->> 'runId' from t_run), (select r ->> 'token' from t_run)), 'the next Chapter''s Stage-start save supersedes the old checkpoint');
select is((public.get_checkpoint() ->> 'hash'), 'cccccccc33333333', 'the newest checkpoint is offered');
select throws_ok(format($f$ select public.resume_run('%s', 'bbbbbbbb22222222') $f$, (select r ->> 'runId' from t_run)), 'STALE_CHECKPOINT', 'the superseded Chapter 3 checkpoint can no longer be resumed');
select is((public.resume_run((select (r ->> 'runId')::uuid from t_run), 'cccccccc33333333') ->> 'ok')::boolean, true, 'the Chapter 4 checkpoint resumes');

reset role;
select ok((select suspended_ms >= 7200000 from public.runs where id = (select (r ->> 'runId')::uuid from t_run)), 'the suspended time is recorded (excluded from play time)');
set local role authenticated;
select is((public.submit_run(jsonb_build_object('runId', (select r ->> 'runId' from t_run), 'token', (select r ->> 'token' from t_run),
  'chapter', 1, 'kills', 10, 'gold', 5, 'score', 1000, 'resumedHash', 'aaaaaaaa11111111')) ->> 'reason'), 'STALE_CHECKPOINT', 'a Run continued from a stale checkpoint is rejected');

-- O2 fix (20260930000048_resumed_hash_reset.sql): a Stage-start auto-save after an online resume
-- must not leave a stale resumed_hash pinned to the older, already-superseded checkpoint. Scenario:
-- resume Chapter 3 online (resumed_hash = H3), keep playing to a Chapter 4 auto-save (checkpoint_hash
-- = H4), lose the connection, "Save and quit", then Continue offline from H4 and submit.
create temp table t_run2 as select public.start_run('mage') as r;
grant select on t_run2 to authenticated;
select lives_ok(format($f$ select public.save_checkpoint('{"runId":"%s","token":"%s","chapter":3,"hash":"eeeeeeee55555555","data":"{\"v\":1}","configVersion":0,"quit":true}') $f$,
  (select r ->> 'runId' from t_run2), (select r ->> 'token' from t_run2)), 'O2 setup: Chapter 3 save and quit');
select is((public.resume_run((select (r ->> 'runId')::uuid from t_run2), 'eeeeeeee55555555') ->> 'ok')::boolean, true, 'O2 setup: resume Chapter 3 online (resumed_hash = H3)');
select lives_ok(format($f$ select public.save_checkpoint('{"runId":"%s","token":"%s","chapter":4,"hash":"ffffffff66666666","data":"{\"v\":1}","configVersion":0}') $f$,
  (select r ->> 'runId' from t_run2), (select r ->> 'token' from t_run2)), 'O2 setup: keep playing to a Chapter 4 auto-save (H4), online, no further resume_run call');
reset role;
update public.runs set started_at = now() - interval '3 hours' where id = (select (r ->> 'runId')::uuid from t_run2);
set local role authenticated;
select is((public.submit_run(jsonb_build_object('runId', (select r ->> 'runId' from t_run2), 'token', (select r ->> 'token' from t_run2),
  'chapter', 4, 'kills', 10, 'gold', 5, 'score', 1000, 'resumedHash', 'ffffffff66666666')) ->> 'reason'), null,
  'O2: Continue offline from the latest (post-resume) auto-save is no longer wrongly rejected as stale');

-- and the exact hash that was once legitimately resumed, since superseded by real further play, still fails
create temp table t_run3 as select public.start_run('mage') as r;
grant select on t_run3 to authenticated;
select lives_ok(format($f$ select public.save_checkpoint('{"runId":"%s","token":"%s","chapter":3,"hash":"eeeeeeee55555555","data":"{\"v\":1}","configVersion":0,"quit":true}') $f$,
  (select r ->> 'runId' from t_run3), (select r ->> 'token' from t_run3)), 'O2 negative setup: Chapter 3 save and quit');
select is((public.resume_run((select (r ->> 'runId')::uuid from t_run3), 'eeeeeeee55555555') ->> 'ok')::boolean, true, 'O2 negative setup: resume Chapter 3 online');
select lives_ok(format($f$ select public.save_checkpoint('{"runId":"%s","token":"%s","chapter":4,"hash":"ffffffff66666666","data":"{\"v\":1}","configVersion":0}') $f$,
  (select r ->> 'runId' from t_run3), (select r ->> 'token' from t_run3)), 'O2 negative setup: keep playing to a Chapter 4 auto-save');
reset role;
update public.runs set started_at = now() - interval '3 hours' where id = (select (r ->> 'runId')::uuid from t_run3);
set local role authenticated;
select is((public.submit_run(jsonb_build_object('runId', (select r ->> 'runId' from t_run3), 'token', (select r ->> 'token' from t_run3),
  'chapter', 4, 'kills', 10, 'gold', 5, 'score', 1000, 'resumedHash', 'eeeeeeee55555555')) ->> 'reason'), 'STALE_CHECKPOINT',
  'O2: a copied Chapter 3 save is still rejected once real play has moved past it');

select * from finish();
rollback;
