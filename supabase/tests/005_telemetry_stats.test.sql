-- Ticket 14: player days, error grouping, rollup correctness on fixture data, retention.
begin;
select plan(14);
-- "yesterday" pinned to noon Thai time: runs started a few minutes before it stay on the same Thai day even when
-- the test runs just after Thai midnight (the old now() - 1 day - 10 min crossed the day boundary then).
create function pg_temp.y() returns timestamptz language sql as $$ select ((public.thai_day() - 1) + time '12:00') at time zone 'Asia/Bangkok' $$;

insert into auth.users (id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', '{"nickname":"Alice"}'), ('22222222-2222-2222-2222-222222222222', '{"nickname":"Bob"}');
-- fixture: three finished Runs yesterday (Thai time), one rejected, one older than 30 days
insert into public.runs (user_id, hero, status, result, chapter, config_version, started_at, ended_at, paused_ms, summary) values
  ('11111111-1111-1111-1111-111111111111', 'mage', 'submitted', 'dead', 2, 3, pg_temp.y() - interval '10 min', pg_temp.y(), 60000,
     '{"skills":{"bolt":5,"nova":2},"fps":[0,1,2,30]}'),
  ('22222222-2222-2222-2222-222222222222', 'knight', 'submitted', 'dead', 2, 3, pg_temp.y() - interval '5 min', pg_temp.y(), 0,
     '{"skills":{"orbit":4,"nova":3},"fps":[1,0,0,20]}'),
  ('22222222-2222-2222-2222-222222222222', 'knight', 'offline', 'quit', 4, 3, pg_temp.y() - interval '8 min', pg_temp.y(), 0, '{"skills":{"orbit":6}}'),
  ('11111111-1111-1111-1111-111111111111', 'mage', 'rejected', 'dead', 9, 3, pg_temp.y() - interval '1 min', pg_temp.y(), 0, '{"skills":{"bolt":8}}'),
  ('11111111-1111-1111-1111-111111111111', 'mage', 'submitted', 'dead', 1, 0, now() - interval '40 days', now() - interval '40 days', 0, '{}');

select is((select count(*)::int from public.player_days where day = public.thai_day(now() - interval '1 day')), 2, 'Run starts mark player days (Thai time)');
select ok(public.rollup_day(public.thai_day(now() - interval '1 day')) > 0, 'rollup runs');

create function pg_temp.stat(m text, k text default '') returns numeric language sql as $$
  select value from public.stats_daily where day = public.thai_day(now() - interval '1 day') and config_version = 3 and metric = m and key = k
$$;
select is(pg_temp.stat('runs'), 3::numeric, 'counts submitted + offline Runs, not rejected ones');
select is(pg_temp.stat('deaths_by_chapter', '2'), 2::numeric, 'deaths per Chapter');
select is(pg_temp.stat('skill_picked', 'nova'), 2::numeric, 'how often a Skill was taken');
select is(pg_temp.stat('skill_level_sum', 'orbit'), 10::numeric, 'how far it was levelled');
select is(pg_temp.stat('play_seconds'), (540 + 300 + 480)::numeric, 'play time excludes pauses');
select is(pg_temp.stat('fps_bucket', '4'), 50::numeric, 'FPS histogram buckets add up');
select is((select value from public.stats_daily where day = public.thai_day(now() - interval '1 day') and metric = 'players' and config_version = 3), 2::numeric, 'players per day');

-- errors grouped by fingerprint
set local role anon;
select lives_ok($$ select public.report_errors('[{"fingerprint":"abc","message":"TypeError: x","count":2},{"fingerprint":"abc","message":"TypeError: x"}]') $$, 'anyone can report errors');
reset role;
select is((select count from public.client_errors where fingerprint = 'abc'), 3::bigint, 'repeats are grouped and counted');

-- retention
update public.profiles set last_seen = now() - interval '100 days' where id = '22222222-2222-2222-2222-222222222222';
select is((public.retention_cleanup() ->> 'runs')::int, 1, 'Runs older than 30 days are removed');
select is((select count(*)::int from auth.users where id = '22222222-2222-2222-2222-222222222222'), 0, 'unlinked anonymous accounts inactive for 90 days are removed');
select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 1, 'active accounts stay');

select * from finish();
rollback;
