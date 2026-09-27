-- Owner-approved (2026-09-28): while `maintenance` is on, submit_run/submit_offline_run are
-- unreachable (assert_session raises MAINTENANCE), so queued Runs flush later via
-- submit_offline_run and land as status='offline' -- permanently skipped by record_leaderboard
-- ("kept unranked", see 20260925000002). An admin can now review one such Run and add it to the
-- leaderboard as an unverified entry, the same pattern the coop board already uses.

alter table public.runs add column if not exists offline_review text check (offline_review in ('ranked', 'rejected'));
alter table public.runs add column if not exists offline_reviewed_at timestamptz;
alter table public.runs add column if not exists offline_reviewed_by uuid references auth.users (id) on delete set null;

/** Generalizes verify_coop to any board: promote a player's leaderboard row to verified. */
create or replace function public.verify_score(p_user uuid, p_board text, p_season int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare season int := case when p_board = 'alltime' then 0 else coalesce(p_season, public.active_season('lumora')) end;
begin
  perform public.assert_admin();
  update public.leaderboard set verified = true where user_id = p_user and board = p_board and season_id = season;
  perform public.admin_note('verify', 'leaderboard', jsonb_build_object('user', p_user, 'board', p_board));
end $$;
drop function if exists public.verify_coop(uuid, int);

/**
 * Runs eligible for offline-run review: status='offline' (passed run_problem() at submit time,
 * just never got a server-verified start so record_leaderboard skipped them), not yet reviewed
 * unless p_include_reviewed. Defaults the window to the last time `maintenance` was on (from the
 * audit log), falling back to the last 7 days, so the admin isn't sifting through every player who
 * has ever played offline by choice.
 */
create or replace function public.admin_offline_runs(p_since timestamptz default null, p_until timestamptz default null, p_include_reviewed boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if p_since is null then
    select at into p_since from public.audit_log
      where target = 'feature_flags' and (detail -> 'new' ->> 'key') = 'maintenance' and (detail -> 'new' -> 'value')::text = 'true'
      order by at desc limit 1;
  end if;
  p_since := coalesce(p_since, now() - interval '7 days');
  if p_until is null then
    select at into p_until from public.audit_log
      where target = 'feature_flags' and (detail -> 'new' ->> 'key') = 'maintenance' and (detail -> 'new' -> 'value')::text = 'false' and at > p_since
      order by at asc limit 1;
  end if;
  p_until := coalesce(p_until, now());
  return jsonb_build_object('since', p_since, 'until', p_until, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'userId', r.user_id, 'name', p.nickname, 'hero', r.hero, 'startedAt', r.started_at, 'endedAt', r.ended_at,
      'chapter', r.chapter, 'score', r.score, 'kills', r.kills, 'gold', r.gold_earned,
      'playSeconds', round(extract(epoch from (r.ended_at - r.started_at))),
      'goldCeilingPct', round(100 * r.gold_earned / greatest(public.gold_ceiling(r.config_version, coalesce(r.chapter, 1)), 1)),
      'result', r.result, 'review', r.offline_review, 'reviewedAt', r.offline_reviewed_at,
      -- whether ranking actually beat the player's current best on each board (a ranked Run can still lose to it)
      'onSolo', exists (select 1 from public.leaderboard l where l.world = r.world and l.season_id = public.active_season(r.world)
                        and l.board = 'solo' and l.user_id = r.user_id and l.best_run_id = r.id),
      'onAlltime', exists (select 1 from public.leaderboard l where l.world = r.world and l.season_id = 0
                        and l.board = 'alltime' and l.user_id = r.user_id and l.best_run_id = r.id)) order by r.score desc nulls last)
    from public.runs r join public.profiles p on p.id = r.user_id
    where r.status = 'offline' and r.started_at between p_since and p_until and (p_include_reviewed or r.offline_review is null)
    limit 300), '[]'::jsonb));
end $$;

/** Adds an offline Run to the solo + all-time boards as an unverified entry (verify_score after review). */
create or replace function public.admin_rank_offline_run(p_run uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.runs;
  season int;
  applied_solo boolean;
  applied_alltime boolean;
begin
  perform public.assert_admin();
  select * into r from public.runs where id = p_run for update;
  if r.id is null then raise exception 'RUN_NOT_FOUND' using errcode = 'P0002'; end if;
  if r.status <> 'offline' then raise exception 'NOT_OFFLINE_RUN' using errcode = '22023'; end if;
  if r.offline_review is not null then raise exception 'ALREADY_REVIEWED' using errcode = '22023'; end if;
  if r.score is null then raise exception 'NO_SCORE' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id = r.user_id and banned_until > now()) then
    raise exception 'PLAYER_BANNED' using errcode = '22023';
  end if;
  season := public.active_season(r.world);
  perform public.upsert_board(r.world, season, 'solo', r, false);
  perform public.upsert_board(r.world, 0, 'alltime', r, false);
  select l.best_run_id = r.id into applied_solo from public.leaderboard l where l.world = r.world and l.season_id = season and l.board = 'solo' and l.user_id = r.user_id;
  select l.best_run_id = r.id into applied_alltime from public.leaderboard l where l.world = r.world and l.season_id = 0 and l.board = 'alltime' and l.user_id = r.user_id;
  update public.runs set offline_review = 'ranked', offline_reviewed_at = now(), offline_reviewed_by = auth.uid() where id = r.id;
  perform public.admin_note('rank_offline_run', 'runs', jsonb_build_object('runId', r.id, 'user', r.user_id,
    'appliedSolo', coalesce(applied_solo, false), 'appliedAlltime', coalesce(applied_alltime, false)));
  return jsonb_build_object('appliedSolo', coalesce(applied_solo, false), 'appliedAlltime', coalesce(applied_alltime, false));
end $$;

/** Reviewed and skipped: the Run keeps its Gold/achievements but never joins a leaderboard. */
create or replace function public.admin_reject_offline_run(p_run uuid, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare r public.runs;
begin
  perform public.assert_admin();
  select * into r from public.runs where id = p_run for update;
  if r.id is null then raise exception 'RUN_NOT_FOUND' using errcode = 'P0002'; end if;
  if r.status <> 'offline' then raise exception 'NOT_OFFLINE_RUN' using errcode = '22023'; end if;
  if r.offline_review is not null then raise exception 'ALREADY_REVIEWED' using errcode = '22023'; end if;
  update public.runs set offline_review = 'rejected', offline_reviewed_at = now(), offline_reviewed_by = auth.uid() where id = r.id;
  perform public.admin_note('reject_offline_run', 'runs', jsonb_build_object('runId', r.id, 'user', r.user_id, 'note', p_note));
end $$;

-- co-op top entries waiting for review already surface on Home; do the same for offline Runs.
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.thai_day();
  att jsonb := '[]'::jsonb;
  f record;
  prev numeric; drop_avg numeric; worst record;
  db_mb numeric := pg_database_size(current_database()) / 1048576.0;
  users bigint := (select count(*) from auth.users);
begin
  perform public.assert_admin();
  -- Chapter drop-off anomaly: a Chapter losing far more players than the average step
  select avg(d) into drop_avg from (
    select s.reached - lead(s.reached) over (order by s.chapter) as d from public.survival(7, public.current_config_version()) s) x where d is not null;
  select s.chapter, s.reached - lead(s.reached) over (order by s.chapter) as d into worst
  from public.survival(7, public.current_config_version()) s order by 2 desc nulls last limit 1;
  if worst.d is not null and drop_avg > 0 and worst.d > greatest(drop_avg * 1.8, 10) then
    att := att || jsonb_build_object('kind', 'dropoff', 'level', 'bad', 'chapter', worst.chapter, 'drop', worst.d, 'avg', round(drop_avg, 1));
  end if;
  -- suspicious scores: rejected Runs and ranked Runs close to the ceilings (last 24 h)
  for f in
    select r.id, r.user_id, p.nickname, r.reject_reason, r.gold_earned, r.chapter, r.score
    from public.runs r join public.profiles p on p.id = r.user_id
    where r.ended_at > now() - interval '24 hours'
      and (r.status = 'rejected' or r.gold_earned > 0.8 * public.gold_ceiling(r.config_version, coalesce(r.chapter, 1)))
    order by r.ended_at desc limit 10
  loop
    att := att || jsonb_build_object('kind', 'suspicious', 'level', 'warn', 'userId', f.user_id, 'name', f.nickname, 'reason', coalesce(f.reject_reason, 'NEAR_GOLD_CEILING'), 'runId', f.id);
  end loop;
  -- new or spiking errors
  for f in select fingerprint, message, count, first_seen from public.client_errors
           where last_seen > now() - interval '24 hours' and (first_seen > now() - interval '24 hours' or count >= 50)
           order by count desc limit 5
  loop
    att := att || jsonb_build_object('kind', 'error', 'level', case when f.count >= 50 then 'bad' else 'warn' end, 'message', f.message, 'count', f.count, 'new', f.first_seen > now() - interval '24 hours');
  end loop;
  -- abnormal Gold
  for f in select m.user_id, p.nickname, m.gold from public.meta_progress m join public.profiles p on p.id = m.user_id
           where m.gold > 50000 order by m.gold desc limit 5
  loop
    att := att || jsonb_build_object('kind', 'gold', 'level', 'warn', 'userId', f.user_id, 'name', f.nickname, 'gold', f.gold);
  end loop;
  -- free-quota warnings (Supabase Free: 500 MB database, 50k monthly active users)
  if db_mb > 400 then att := att || jsonb_build_object('kind', 'quota', 'level', case when db_mb > 475 then 'bad' else 'warn' end, 'what', 'database', 'used', round(db_mb), 'limit', 500); end if;
  if users > 40000 then att := att || jsonb_build_object('kind', 'quota', 'level', 'warn', 'what', 'users', 'used', users, 'limit', 50000); end if;
  -- co-op top entries waiting for review
  if exists (select 1 from public.leaderboard where board = 'coop' and not verified and not hidden) then
    att := att || jsonb_build_object('kind', 'coop_review', 'level', 'info', 'count', (select count(*) from public.leaderboard where board = 'coop' and not verified and not hidden));
  end if;
  -- offline Runs (played during maintenance) waiting for a rank-or-reject decision
  if exists (select 1 from public.runs where status = 'offline' and offline_review is null) then
    att := att || jsonb_build_object('kind', 'offline_review', 'level', 'info', 'count', (select count(*) from public.runs where status = 'offline' and offline_review is null));
  end if;

  return jsonb_build_object(
    'kpi', jsonb_build_object(
      'playersToday', (select count(*) from public.player_days where day = today),
      'runsToday', (select count(*) from public.runs where public.thai_day(started_at) = today),
      'avgMinutes', (select round(avg(extract(epoch from (ended_at - started_at)) - paused_ms / 1000.0) / 60, 1) from public.runs where ended_at > now() - interval '24 hours'),
      'd1', (select round(100.0 * count(*) filter (where exists (select 1 from public.player_days b where b.user_id = a.user_id and b.day = a.day + 1)) / nullif(count(*), 0), 1)
             from public.player_days a where a.day = today - 2),
      'd7', (select round(100.0 * count(*) filter (where exists (select 1 from public.player_days b where b.user_id = a.user_id and b.day = a.day + 7)) / nullif(count(*), 0), 1)
             from public.player_days a where a.day = today - 8),
      'errorsToday', (select coalesce(sum(count), 0) from public.client_errors where last_seen > now() - interval '24 hours'),
      'dbMb', round(db_mb), 'users', users),
    'configVersion', public.current_config_version(),
    'season', (select jsonb_build_object('id', id, 'name', name, 'since', starts_at) from public.seasons where status = 'active' limit 1),
    'maintenance', coalesce((public.flag('maintenance'))::boolean, false),
    'attention', att);
end $$;

do $$
declare f text;
begin
  foreach f in array array['verify_score(uuid, text, int)', 'admin_offline_runs(timestamptz, timestamptz, boolean)',
    'admin_rank_offline_run(uuid)', 'admin_reject_offline_run(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
