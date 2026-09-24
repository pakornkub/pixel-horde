-- Ticket 10: Seasons and leaderboards (best Run per player per board; ties: earliest first).

create table public.seasons (
  id int primary key,
  world text not null default 'lumora',
  name text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'closed'))
);
create unique index seasons_one_active on public.seasons (world) where status = 'active';
alter table public.seasons enable row level security;
revoke all on public.seasons from anon, authenticated;
grant select on public.seasons to anon, authenticated;
create policy seasons_read on public.seasons for select to anon, authenticated using (true);
insert into public.seasons (id, name) values (1, 'Season 1');

create table public.leaderboard (
  world text not null default 'lumora',
  season_id int not null default 0,        -- 0 = all-time
  board text not null check (board in ('solo', 'coop', 'endless', 'alltime') or board like 'daily:%'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  best_run_id uuid references public.runs (id) on delete set null,
  score bigint not null,
  chapter int not null,
  hero text not null,
  weapon text,
  verified boolean not null default true,
  hidden boolean not null default false,
  achieved_at timestamptz not null default now(),
  primary key (world, season_id, board, user_id)
);
create index leaderboard_rank on public.leaderboard (world, season_id, board, score desc, achieved_at asc);
alter table public.leaderboard enable row level security;
revoke all on public.leaderboard from anon, authenticated;
-- read through get_leaderboard() only

create or replace function public.active_season(p_world text default 'lumora')
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select id from public.seasons where world = p_world and status = 'active'), 0)
$$;

/** Keep a player's best per board; only a strictly higher score replaces (ties keep the earlier one). */
create or replace function public.upsert_board(p_world text, p_season int, p_board text, r public.runs, p_verified boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.leaderboard (world, season_id, board, user_id, best_run_id, score, chapter, hero, weapon, verified, achieved_at)
  values (p_world, p_season, p_board, r.user_id, r.id, r.score, r.chapter, r.hero, r.weapon, p_verified, coalesce(r.ended_at, now()))
  on conflict (world, season_id, board, user_id) do update
    set best_run_id = excluded.best_run_id, score = excluded.score, chapter = excluded.chapter, hero = excluded.hero,
        weapon = excluded.weapon, verified = excluded.verified, achieved_at = excluded.achieved_at
    where excluded.score > public.leaderboard.score;
end $$;

create or replace function public.record_leaderboard(p_run uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.runs;
  season int;
begin
  select * into r from public.runs where id = p_run;
  if r.id is null or r.score is null or r.status not in ('submitted', 'verified') then return; end if;
  if exists (select 1 from public.profiles where id = r.user_id and banned_until > now()) then return; end if;
  season := public.active_season(r.world);
  if r.mode = 'solo' then
    perform public.upsert_board(r.world, season, 'solo', r, true);
    perform public.upsert_board(r.world, 0, 'alltime', r, true);
    -- a Run that went on into Endless also lands on the Endless board with its Endless score
    if coalesce(r.endless_score, 0) > 0 then
      r.score := r.endless_score;
      perform public.upsert_board(r.world, season, 'endless', r, true);
    end if;
  elsif r.mode = 'coop' then
    perform public.upsert_board(r.world, season, 'coop', r, false);  -- co-op entries stay "unverified"
  elsif r.mode = 'endless' then
    perform public.upsert_board(r.world, season, 'endless', r, true);
  end if;
end $$;

create or replace function public.submit_run(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  r public.runs;
  secs numeric;
  problem text;
  g int := coalesce((p ->> 'gold')::int, 0);
  m public.meta_progress;
begin
  select * into r from public.runs where id = (p ->> 'runId')::uuid and user_id = uid for update;
  if r.id is null or r.token is distinct from (p ->> 'token')::uuid then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if r.status <> 'started' then
    raise exception 'RUN_ALREADY_SUBMITTED' using errcode = '23505';
  end if;
  perform public.check_submit_rate(uid, r.config_version);
  -- time suspended between sessions never counts as play time
  secs := extract(epoch from (now() - r.started_at)) - greatest(coalesce((p ->> 'pausedMs')::numeric, 0), 0) / 1000 - r.suspended_ms / 1000.0;
  problem := public.run_problem(r.config_version, (p ->> 'chapter')::int, (p ->> 'kills')::int, g, secs);
  -- a Run continued from a checkpoint must name the one the server knows (copied or stale saves fail)
  if problem is null and p ? 'resumedHash' and (p ->> 'resumedHash') is not null
     and (p ->> 'resumedHash') is distinct from coalesce(r.resumed_hash, r.checkpoint_hash) then
    problem := 'STALE_CHECKPOINT';
  end if;
  update public.runs set
    ended_at = now(), paused_ms = greatest(coalesce((p ->> 'pausedMs')::bigint, 0), 0),
    result = coalesce(p ->> 'result', 'dead'), chapter = (p ->> 'chapter')::int, kills = (p ->> 'kills')::int,
    level = (p ->> 'level')::int, gold_earned = g, score = (p ->> 'score')::bigint,
    endless_score = greatest(coalesce((p ->> 'endlessScore')::bigint, 0), 0),
    victory = coalesce((p ->> 'victory')::boolean, false),
    crack = least(greatest(coalesce((p ->> 'crack')::int, 0), 0), 3),
    summary = coalesce(p -> 'summary', '{}'::jsonb),
    status = case when problem is null then 'submitted' else 'rejected' end,
    reject_reason = problem
  where id = r.id;
  m := public.ensure_meta(uid);
  if problem is null and g > 0 then
    update public.meta_progress set gold = gold + g, updated_at = now() where user_id = uid returning * into m;
  end if;
  if problem is null then m := public.add_found_weapons(uid, r.world, p -> 'weaponsFound'); end if;
  -- achievements, lifetime totals and the bestiary (ticket 32)
  if problem is null then
    perform public.apply_run_facts(uid, p -> 'facts');
    select * into m from public.meta_progress where user_id = uid;
  end if;
  -- beating Umbra unlocks the next Heart Crack tier (1–3), only above the tier the Run used
  if problem is null and coalesce((p ->> 'victory')::boolean, false) then
    update public.meta_progress
      set stats = jsonb_set(stats, '{heartCrack}', to_jsonb(least(3, greatest(coalesce((stats ->> 'heartCrack')::int, 0),
                  least(greatest(coalesce((p ->> 'crack')::int, 0), 0), 3) + 1)))), updated_at = now()
    where user_id = uid returning * into m;
  end if;
  -- Gold the Run took from the wallet (Stage-end swaps etc.) is always charged, never below zero.
  if coalesce((p ->> 'walletSpent')::int, 0) > 0 then
    update public.meta_progress set gold = greatest(0, gold - (p ->> 'walletSpent')::int), updated_at = now() where user_id = uid returning * into m;
  end if;
  if problem is null then
    perform public.record_leaderboard(r.id);
  end if;
  return jsonb_build_object('status', case when problem is null then 'submitted' else 'rejected' end, 'reason', problem, 'meta', public.meta_json(m));
end $$;


/**
 * Top 100 of a board (optionally one Hero), plus the caller's own row and neighbours.
 * p_season null = the active Season (ignored for 'alltime').
 */
create or replace function public.get_leaderboard(p_board text, p_hero text default null, p_season int default null, p_world text default 'lumora')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  season int := case when p_board = 'alltime' then 0 else coalesce(p_season, public.active_season(p_world)) end;
  me uuid := auth.uid();
  result jsonb;
begin
  with ranked as (
    select l.*, p.nickname, p.name_hidden, p.shown_title,
           row_number() over (order by l.score desc, l.achieved_at asc) as rank
    from public.leaderboard l
    join public.profiles p on p.id = l.user_id
    where l.world = p_world and l.season_id = season and l.board = p_board and not l.hidden
      and (p.banned_until is null or p.banned_until <= now())
      and (p_hero is null or l.hero = p_hero)
  ), rows as (
    select rank, jsonb_build_object('rank', rank, 'userId', user_id, 'name', case when name_hidden then 'Hero' else nickname end,
             'title', shown_title, 'score', score, 'chapter', chapter, 'hero', hero, 'weapon', weapon, 'verified', verified,
             'at', achieved_at, 'me', user_id = me) as j,
           user_id
    from ranked
  ), mine as (select rank from rows where user_id = me)
  select jsonb_build_object(
    'board', p_board, 'season', season,
    'top', coalesce((select jsonb_agg(j order by rank) from rows where rank <= 100), '[]'::jsonb),
    'me', (select j from rows where user_id = me),
    'around', coalesce((select jsonb_agg(r.j order by r.rank) from rows r, mine m where r.rank between m.rank - 1 and m.rank + 1 and m.rank > 100), '[]'::jsonb),
    'total', (select count(*) from rows)
  ) into result;
  return result;
end $$;

revoke all on function public.upsert_board(text, int, text, public.runs, boolean) from public, anon, authenticated;
revoke all on function public.record_leaderboard(uuid) from public, anon, authenticated;
grant execute on function public.get_leaderboard(text, text, int, text) to anon, authenticated;
