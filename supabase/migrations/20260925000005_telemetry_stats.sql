-- Ticket 14: player days (retention), telemetry samples, grouped client errors, nightly rollups,
-- retention clean-up and anonymous-account clean-up (pg_cron). Days are cut in Thai time.

create table public.player_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  config_version int not null default 0,
  first_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.player_days enable row level security;
revoke all on public.player_days from anon, authenticated;

create or replace function public.thai_day(t timestamptz default now())
returns date language sql stable set search_path = '' as $$ select (t at time zone 'Asia/Bangkok')::date $$;

-- Every Run start marks the player active that (Thai) day.
create or replace function public.runs_mark_day()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.player_days (user_id, day, config_version, first_at)
  values (new.user_id, public.thai_day(new.started_at), new.config_version, new.started_at)
  on conflict (user_id, day) do nothing;
  return new;
end $$;
create trigger runs_player_day after insert on public.runs for each row execute function public.runs_mark_day();

create table public.telemetry_samples (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  run_id uuid references public.runs (id) on delete cascade,
  at timestamptz not null default now(),
  config_version int not null default 0,
  data jsonb not null
);
create index telemetry_samples_at on public.telemetry_samples (at);
alter table public.telemetry_samples enable row level security;
revoke all on public.telemetry_samples from anon, authenticated;

create table public.client_errors (
  fingerprint text primary key,
  message text not null,
  stack text not null default '',
  build bigint,
  count bigint not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  sample jsonb not null default '{}'::jsonb
);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

create table public.stats_daily (
  day date not null,
  world text not null default 'lumora',
  config_version int not null default 0,
  metric text not null,
  key text not null default '',
  value numeric not null,
  primary key (day, world, config_version, metric, key)
);
alter table public.stats_daily enable row level security;
revoke all on public.stats_daily from anon, authenticated;

-- ---------- ingestion ----------
/** Detail events from the 5% sample (also works signed out). Size-capped. */
create or replace function public.report_telemetry(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p is null or octet_length(p::text) > 16384 then return; end if;
  insert into public.telemetry_samples (user_id, run_id, config_version, data)
  values (auth.uid(),
          (select id from public.runs where id = nullif(p ->> 'runId', '')::uuid and user_id = auth.uid()),
          coalesce((p ->> 'configVersion')::int, 0), p - 'runId');
exception when invalid_text_representation then
  insert into public.telemetry_samples (user_id, config_version, data) values (auth.uid(), 0, p);
end $$;

/** Client errors grouped by fingerprint: [{fingerprint, message, stack, count, build}] (max 20 per call). */
create or replace function public.report_errors(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare e jsonb;
begin
  if jsonb_typeof(p) <> 'array' then return; end if;
  for e in select * from jsonb_array_elements(p) limit 20 loop
    continue when coalesce(e ->> 'fingerprint', '') = '';
    insert into public.client_errors (fingerprint, message, stack, build, count, sample)
    values (left(e ->> 'fingerprint', 64), left(coalesce(e ->> 'message', ''), 500), left(coalesce(e ->> 'stack', ''), 2000),
            (e ->> 'build')::bigint, greatest(least(coalesce((e ->> 'count')::bigint, 1), 1000), 1),
            jsonb_build_object('ua', left(coalesce(e ->> 'ua', ''), 200), 'lang', left(coalesce(e ->> 'lang', ''), 10)))
    on conflict (fingerprint) do update
      set count = public.client_errors.count + excluded.count, last_seen = now(), build = greatest(public.client_errors.build, excluded.build);
  end loop;
end $$;
grant execute on function public.report_telemetry(jsonb) to anon, authenticated;
grant execute on function public.report_errors(jsonb) to anon, authenticated;

-- ---------- nightly rollup (per Thai day, World and config version) ----------
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

-- ---------- retention ----------
create or replace function public.retention_cleanup()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a int; b int; c int; d int;
begin
  delete from public.telemetry_samples where at < now() - interval '14 days';
  get diagnostics a = row_count;
  delete from public.client_errors where last_seen < now() - interval '30 days';
  get diagnostics b = row_count;
  delete from public.runs r
  where coalesce(r.ended_at, r.started_at) < now() - interval '30 days'
    and r.status not in ('rejected', 'hidden', 'suspended')
    and not exists (select 1 from public.leaderboard l where l.best_run_id = r.id);
  get diagnostics c = row_count;
  -- anonymous accounts never linked and inactive for 90 days
  delete from auth.users u
  using public.profiles p
  where p.id = u.id and u.is_anonymous and p.last_seen < now() - interval '90 days';
  get diagnostics d = row_count;
  return jsonb_build_object('telemetry', a, 'errors', b, 'runs', c, 'anonymous_accounts', d);
end $$;

create or replace function public.nightly_jobs()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare yesterday date := public.thai_day() - 1;
begin
  perform public.rollup_day(yesterday);
  return public.retention_cleanup() || jsonb_build_object('rolled_up', yesterday);
end $$;

revoke all on function public.rollup_day(date) from public, anon, authenticated;
revoke all on function public.retention_cleanup() from public, anon, authenticated;
revoke all on function public.nightly_jobs() from public, anon, authenticated;

-- 00:10 Thai time every night (17:10 UTC). Skipped where pg_cron is not installed (tests).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pixelhorde-nightly', '10 17 * * *', 'select public.nightly_jobs()');
  end if;
end $$;
