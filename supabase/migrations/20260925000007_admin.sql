-- Tickets 15–18: Admin Console RPCs. Every function starts with assert_admin(); writes are
-- audited by the table triggers (and admin_note() for actions without a table row).

create or replace function public.admin_note(p_action text, p_target text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor, action, target, detail) values (auth.uid(), p_action, p_target, p_detail)
$$;
revoke all on function public.admin_note(text, text, jsonb) from public, anon, authenticated;

create trigger profiles_audit after update of role, banned_until, name_hidden on public.profiles
  for each row execute function public.audit_trigger();
create trigger leaderboard_audit after update of hidden on public.leaderboard
  for each row execute function public.audit_trigger();

-- Rollup v2: also counts, per Skill, Runs that reached Chapter 6+ ("reach" on the stats page).
create or replace function public.rollup_day(p_day date)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.stats_daily where day = p_day;
  with r as (
    select * from public.runs
    where ended_at is not null and public.thai_day(ended_at) = p_day and status in ('submitted', 'verified', 'offline')
  ), m as (
    select world, config_version, 'runs' as metric, '' as key, count(*)::numeric as value from r group by 1, 2
    union all
    select world, config_version, 'play_seconds', '', coalesce(sum(extract(epoch from (ended_at - started_at)) - paused_ms / 1000.0), 0) from r group by 1, 2
    union all
    select world, config_version, 'deaths_by_chapter', chapter::text, count(*) from r where result = 'dead' group by 1, 2, 4
    union all
    select world, config_version, 'skill_picked', s.key, count(*) from r, jsonb_each(coalesce(r.summary -> 'skills', '{}'::jsonb)) s group by 1, 2, 4
    union all
    select world, config_version, 'skill_level_sum', s.key, sum((s.value #>> '{}')::numeric) from r, jsonb_each(coalesce(r.summary -> 'skills', '{}'::jsonb)) s
      where jsonb_typeof(s.value) = 'number' group by 1, 2, 4
    union all
    select world, config_version, 'skill_reach6', s.key, count(*) from r, jsonb_each(coalesce(r.summary -> 'skills', '{}'::jsonb)) s
      where r.chapter >= 6 group by 1, 2, 4
    union all
    select world, config_version, 'fps_bucket', b.ord::text, sum((b.v #>> '{}')::numeric) from r, jsonb_array_elements(coalesce(r.summary -> 'fps', '[]'::jsonb)) with ordinality b(v, ord)
      group by 1, 2, 4
  )
  insert into public.stats_daily (day, world, config_version, metric, key, value)
  select p_day, world, config_version, metric, key, value from m;
  insert into public.stats_daily (day, world, config_version, metric, key, value)
  select p_day, 'lumora', config_version, 'players', '', count(*) from public.player_days where day = p_day group by config_version
  on conflict do nothing;
  insert into public.stats_daily (day, world, config_version, metric, key, value)
  select p_day, 'lumora', 0, 'new_errors', '', count(*) from public.client_errors where public.thai_day(first_seen) = p_day
  on conflict do nothing;
  get diagnostics n = row_count;
  return (select count(*)::int from public.stats_daily where day = p_day);
end $$;


/** Survival funnel: share of Runs (last p_days) that reached each Chapter, per config version. */
create or replace function public.survival(p_days int default 7, p_version int default null)
returns table (config_version int, chapter int, runs bigint, reached numeric)
language sql stable security definer set search_path = '' as $$
  with r as (
    select r.config_version, r.chapter from public.runs r
    where r.ended_at > now() - make_interval(days => p_days) and r.status in ('submitted', 'verified', 'offline')
      and (p_version is null or r.config_version = p_version)
  ), tot as (select config_version, count(*) as n from r group by 1)
  select t.config_version, c, t.n, round(100.0 * (select count(*) from r where r.config_version = t.config_version and r.chapter >= c) / t.n, 1)
  from tot t cross join generate_series(1, 8) c
  order by 1, 2
$$;
revoke all on function public.survival(int, int) from public, anon, authenticated;

/** Home: key numbers + automatic "needs attention" list with suggested actions. */
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

create or replace function public.admin_audit(p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'at', a.at, 'actor', coalesce(p.nickname, a.actor::text), 'action', a.action, 'target', a.target, 'detail', a.detail) order by a.id desc)
    from (select * from public.audit_log order by id desc limit least(p_limit, 500)) a left join public.profiles p on p.id = a.actor), '[]'::jsonb);
end $$;

/** Moderation view: every row incl. hidden, with a status tag. */
create or replace function public.admin_leaderboard(p_board text, p_season int default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare season int := case when p_board = 'alltime' then 0 else coalesce(p_season, public.active_season('lumora')) end;
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(x order by (x ->> 'score')::bigint desc) from (
    select jsonb_build_object('userId', l.user_id, 'name', p.nickname, 'score', l.score, 'chapter', l.chapter, 'hero', l.hero, 'weapon', l.weapon,
      'hidden', l.hidden, 'banned', coalesce(p.banned_until > now(), false), 'at', l.achieved_at,
      'status', case when not l.verified then 'pending'
                     when r.gold_earned > 0.8 * public.gold_ceiling(r.config_version, coalesce(r.chapter, 1))
                       or (r.ended_at is not null and extract(epoch from (r.ended_at - r.started_at)) - r.paused_ms / 1000.0 < 1.2 * public.min_seconds_to_reach(r.config_version, coalesce(r.chapter, 1)))
                     then 'suspicious' else 'verified' end) as x
    from public.leaderboard l join public.profiles p on p.id = l.user_id left join public.runs r on r.id = l.best_run_id
    where l.board = p_board and l.season_id = season
    order by l.score desc limit 300) t), '[]'::jsonb);
end $$;

create or replace function public.hide_score(p_user uuid, p_board text, p_hidden boolean, p_season int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare season int := case when p_board = 'alltime' then 0 else coalesce(p_season, public.active_season('lumora')) end;
begin
  perform public.assert_admin();
  update public.leaderboard set hidden = p_hidden where user_id = p_user and board = p_board and season_id = season;
end $$;

/** Ban from leaderboards until a time (null = unban). */
create or replace function public.ban_player(p_user uuid, p_until timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.profiles set banned_until = p_until where id = p_user;
end $$;

create or replace function public.verify_coop(p_user uuid, p_season int default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.leaderboard set verified = true where user_id = p_user and board = 'coop' and season_id = coalesce(p_season, public.active_season('lumora'));
  perform public.admin_note('verify', 'leaderboard', jsonb_build_object('user', p_user, 'board', 'coop'));
end $$;

create or replace function public.admin_players(p_search text default '', p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'role', p.role, 'gold', coalesce(m.gold, 0),
      'linked', not coalesce(u.is_anonymous, true), 'banned', coalesce(p.banned_until > now(), false), 'lastSeen', p.last_seen) order by p.last_seen desc)
    from (select * from public.profiles where p_search = '' or nickname ilike '%' || p_search || '%' order by last_seen desc limit least(p_limit, 200)) p
    left join public.meta_progress m on m.user_id = p.id left join auth.users u on u.id = p.id), '[]'::jsonb);
end $$;

create or replace function public.admin_announcements()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.starts_at desc) from public.announcements a), '[]'::jsonb);
end $$;

create or replace function public.upsert_announcement(p jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare i bigint := nullif(p ->> 'id', '')::bigint;
begin
  perform public.assert_admin();
  if i is null then
    insert into public.announcements (title_th, title_en, body_th, body_en, starts_at, ends_at, created_by)
    values (coalesce(p ->> 'title_th', ''), coalesce(p ->> 'title_en', ''), coalesce(p ->> 'body_th', ''), coalesce(p ->> 'body_en', ''),
            coalesce((p ->> 'starts_at')::timestamptz, now()), (p ->> 'ends_at')::timestamptz, auth.uid())
    returning id into i;
  else
    update public.announcements set title_th = coalesce(p ->> 'title_th', title_th), title_en = coalesce(p ->> 'title_en', title_en),
      body_th = coalesce(p ->> 'body_th', body_th), body_en = coalesce(p ->> 'body_en', body_en),
      starts_at = coalesce((p ->> 'starts_at')::timestamptz, starts_at), ends_at = (p ->> 'ends_at')::timestamptz
    where id = i;
  end if;
  return i;
end $$;

create or replace function public.delete_announcement(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  delete from public.announcements where id = p_id;
end $$;

create or replace function public.admin_configs()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('version', c.version, 'status', c.status, 'note', c.note, 'at', coalesce(c.published_at, c.created_at),
      'by', p.nickname, 'data', c.data) order by c.version desc)
    from public.balance_configs c left join public.profiles p on p.id = c.created_by), '[]'::jsonb);
end $$;

/** Statistics page: daily rows for the last p_days plus survival by Chapter for two versions. */
create or replace function public.admin_stats(p_days int default 30, p_version_a int default null, p_version_b int default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'v', config_version, 'metric', metric, 'key', key, 'value', value) order by day)
      from public.stats_daily where day > public.thai_day() - p_days), '[]'::jsonb),
    'survivalA', coalesce((select jsonb_agg(jsonb_build_object('chapter', chapter, 'reached', reached, 'runs', runs) order by chapter)
      from public.survival(p_days, coalesce(p_version_a, public.current_config_version()))), '[]'::jsonb),
    'survivalB', coalesce((select jsonb_agg(jsonb_build_object('chapter', chapter, 'reached', reached, 'runs', runs) order by chapter)
      from public.survival(p_days, p_version_b)), '[]'::jsonb),
    'errors', coalesce((select jsonb_agg(jsonb_build_object('message', message, 'stack', left(stack, 300), 'count', count, 'last', last_seen, 'build', build) order by count desc)
      from (select * from public.client_errors order by count desc limit 20) e), '[]'::jsonb));
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_overview()', 'admin_audit(int)', 'admin_leaderboard(text, int)', 'hide_score(uuid, text, boolean, int)',
    'ban_player(uuid, timestamptz)', 'verify_coop(uuid, int)', 'admin_players(text, int)', 'admin_announcements()', 'upsert_announcement(jsonb)',
    'delete_announcement(bigint)', 'admin_configs()', 'admin_stats(int, int, int)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
