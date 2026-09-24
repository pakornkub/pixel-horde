-- Ticket 32: achievements, Titles, badges, bestiary and Season rewards. The achievement rules mirror
-- packages/sim/src/data/achievements.ts (a shared fixture test keeps them in step). Everything here is
-- cosmetic; players never write these tables directly.

create table public.achievements (
  id text primary key,
  grp text not null check (grp in ('story', 'heroes', 'combos', 'dragons', 'challenge')),
  title text,
  sort int not null
);
insert into public.achievements (id, grp, title, sort) values
  ('firstKing', 'story', null, 1), ('chapter4', 'story', null, 2), ('crater', 'story', null, 3),
  ('heartKeeper', 'story', 'Heart Keeper', 4), ('kingslayer', 'story', 'Kingslayer', 5), ('endless12', 'story', null, 6),
  ('winLyra', 'heroes', null, 7), ('winBram', 'heroes', null, 8), ('winKit', 'heroes', null, 9), ('winVex', 'heroes', null, 10),
  ('legend', 'heroes', 'Legend of Lumora', 11), ('awakened', 'heroes', null, 12),
  ('firstCombo', 'combos', null, 13), ('allCombos', 'combos', 'Alchemist of Chaos', 14), ('combos100', 'combos', null, 15),
  ('iceBreaker', 'combos', 'Ice Breaker', 16), ('overload200', 'combos', null, 17), ('firestorm200', 'combos', null, 18),
  ('firstGuardian', 'dragons', null, 19), ('frostTamed', 'dragons', null, 20), ('stormTamed', 'dragons', null, 21),
  ('allGuardians', 'dragons', null, 22), ('dragonTamer', 'dragons', 'Dragon Tamer', 23), ('companion5', 'dragons', null, 24),
  ('crack1', 'challenge', null, 25), ('crack3', 'challenge', 'Heartbreaker', 26), ('swift', 'challenge', 'Swift', 27),
  ('noRevive', 'challenge', null, 28), ('streak500', 'challenge', null, 29), ('doubleKing', 'challenge', null, 30);
alter table public.achievements enable row level security;
revoke all on public.achievements from anon, authenticated;
grant select on public.achievements to anon, authenticated;
create policy achievements_read on public.achievements for select to anon, authenticated using (true);

create table public.player_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id),
  at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
create table public.player_titles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  source text not null check (source in ('achievement', 'season')),
  season_id int,
  at timestamptz not null default now(),
  primary key (user_id, title)
);
create table public.player_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge text not null,
  season_id int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, badge, season_id)
);
alter table public.player_achievements enable row level security;
alter table public.player_titles enable row level security;
alter table public.player_badges enable row level security;
revoke all on public.player_achievements, public.player_titles, public.player_badges from anon, authenticated;
grant select on public.player_achievements, public.player_titles, public.player_badges to authenticated;
create policy pa_own on public.player_achievements for select to authenticated using (user_id = (select auth.uid()));
create policy pt_own on public.player_titles for select to authenticated using (user_id = (select auth.uid()));
create policy pb_own on public.player_badges for select to authenticated using (user_id = (select auth.uid()));

/**
 * Apply a Run's facts: lifetime totals (heroes won, Combos by kind), the bestiary (kills by monster
 * type, first kill unlocks an entry) and newly earned achievements (+ their Titles).
 */
create or replace function public.apply_run_facts(uid uuid, f jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  st jsonb;
  won jsonb;
  combos jsonb := '{}'::jsonb;
  best jsonb;
  k text;
  n numeric;
  cnt int;
  victory boolean := coalesce((f ->> 'victory')::boolean, false);
  a record;
  ok boolean;
begin
  if f is null or jsonb_typeof(f) <> 'object' then return; end if;
  select stats into st from public.meta_progress where user_id = uid;
  st := coalesce(st, '{}'::jsonb);
  -- lifetime: heroes won
  won := coalesce(st -> 'heroesWon', '[]'::jsonb);
  if victory and not (won ? (f ->> 'hero')) and (f ->> 'hero') in ('mage', 'knight', 'ranger', 'alchemist') then won := won || to_jsonb(f ->> 'hero'); end if;
  -- lifetime: Combos by kind (each Run adds at most 100k per kind)
  combos := coalesce(st -> 'combos', '{}'::jsonb);
  for k, n in select key, least(greatest(value::numeric, 0), 100000) from jsonb_each_text(coalesce(f -> 'combos', '{}'::jsonb)) loop
    if k in ('shatter', 'firestorm', 'overload', 'superconduct', 'toxicBurst', 'grinder', 'catalyst') then
      combos := jsonb_set(combos, array[k], to_jsonb(coalesce((combos ->> k)::numeric, 0) + n));
    end if;
  end loop;
  -- bestiary: kills per monster type
  best := coalesce(st -> 'bestiary', '{}'::jsonb);
  for k, n in select key, least(greatest(value::numeric, 0), 100000) from jsonb_each_text(coalesce(f -> 'killsByType', '{}'::jsonb)) loop
    if k ~ '^[a-zA-Z]{2,24}$' then best := jsonb_set(best, array[k], to_jsonb(coalesce((best ->> k)::numeric, 0) + n)); end if;
  end loop;
  update public.meta_progress set stats = st || jsonb_build_object('heroesWon', won, 'combos', combos, 'bestiary', best), updated_at = now()
  where user_id = uid;
  select count(*) into cnt from jsonb_object_keys(coalesce(f -> 'combos', '{}'::jsonb)) x where coalesce((f -> 'combos' ->> x)::numeric, 0) > 0;
  -- achievements (same rules as ACHIEVEMENTS in packages/sim/src/data/achievements.ts)
  for a in select * from public.achievements where id not in (select achievement_id from public.player_achievements where user_id = uid) loop
    ok := case a.id
      when 'firstKing' then coalesce((f ->> 'kingsKilled')::int, 0) >= 1
      when 'chapter4' then coalesce((f ->> 'chapter')::int, 0) >= 4
      when 'crater' then coalesce((f ->> 'chapter')::int, 0) >= 8
      when 'heartKeeper' then victory
      when 'kingslayer' then victory and coalesce((f ->> 'escapes')::int, 0) = 0
      when 'endless12' then coalesce((f ->> 'endlessChapter')::int, 0) >= 12
      when 'winLyra' then victory and f ->> 'hero' = 'mage'
      when 'winBram' then victory and f ->> 'hero' = 'knight'
      when 'winKit' then victory and f ->> 'hero' = 'ranger'
      when 'winVex' then victory and f ->> 'hero' = 'alchemist'
      when 'legend' then won ?& array['mage', 'knight', 'ranger', 'alchemist']
      when 'awakened' then coalesce((f ->> 'awakened')::boolean, false)
      when 'firstCombo' then cnt >= 1
      when 'allCombos' then cnt >= 7
      when 'combos100' then (select coalesce(sum(value::numeric), 0) from jsonb_each_text(coalesce(f -> 'combos', '{}'::jsonb))) >= 100
      when 'iceBreaker' then coalesce((combos ->> 'shatter')::numeric, 0) >= 1000
      when 'overload200' then coalesce((combos ->> 'overload')::numeric, 0) >= 200
      when 'firestorm200' then coalesce((combos ->> 'firestorm')::numeric, 0) >= 200
      when 'firstGuardian' then jsonb_array_length(coalesce(f -> 'guardians', '[]'::jsonb)) >= 1
      when 'frostTamed' then coalesce(f -> 'guardians', '[]'::jsonb) ? 'frost'
      when 'stormTamed' then coalesce(f -> 'guardians', '[]'::jsonb) ? 'storm'
      when 'allGuardians' then jsonb_array_length(coalesce(f -> 'guardians', '[]'::jsonb)) >= 3
      when 'dragonTamer' then coalesce((f ->> 'fused')::boolean, false)
      when 'companion5' then coalesce((f ->> 'companionMax')::int, 0) >= 5
      when 'crack1' then victory and coalesce((f ->> 'crack')::int, 0) >= 1
      when 'crack3' then victory and coalesce((f ->> 'crack')::int, 0) >= 3
      when 'swift' then victory and coalesce((f ->> 'victoryTime')::int, 0) between 1 and 899
      when 'noRevive' then victory and coalesce((f ->> 'revivesBought')::int, 0) = 0
      when 'streak500' then coalesce((f ->> 'maxStreak')::int, 0) >= 500
      when 'doubleKing' then coalesce((f ->> 'doubleKings')::int, 0) >= 1
      else false end;
    if ok then
      insert into public.player_achievements (user_id, achievement_id) values (uid, a.id) on conflict do nothing;
      if a.title is not null then
        insert into public.player_titles (user_id, title, source) values (uid, a.title, 'achievement') on conflict do nothing;
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.apply_run_facts(uuid, jsonb) from public, anon, authenticated;

/** Show one owned Title next to the name (null = none). */
create or replace function public.set_title(p_title text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_session();
begin
  if p_title is not null and not exists (select 1 from public.player_titles where user_id = uid and title = p_title) then
    raise exception 'TITLE_NOT_OWNED' using errcode = '22023';
  end if;
  update public.profiles set shown_title = p_title where id = uid;
end $$;

/** Everything for the collection menu. */
create or replace function public.get_collection()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return jsonb_build_object(
    'achievements', coalesce((select jsonb_agg(achievement_id) from public.player_achievements where user_id = uid), '[]'::jsonb),
    'titles', coalesce((select jsonb_agg(title order by at) from public.player_titles where user_id = uid), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('badge', badge, 'season', season_id) order by at) from public.player_badges where user_id = uid), '[]'::jsonb),
    'shownTitle', (select shown_title from public.profiles where id = uid),
    'bestiary', coalesce((select stats -> 'bestiary' from public.meta_progress where user_id = uid), '{}'::jsonb),
    'weapons', coalesce((select to_jsonb(weapons) from public.meta_progress where user_id = uid), '[]'::jsonb));
end $$;

/* ---------- Season rewards ---------- */

/**
 * What closing Season p_season would hand out (the Admin confirmation list). Only verified entries
 * count (co-op entries need an admin's verify_coop first); rank by score, ties by time.
 */
create or replace function public.season_rewards(p_season int)
returns table (user_id uuid, kind text, reward text, rank int, board text)
language sql stable security definer set search_path = '' as $$
  with ranked as (
    select l.user_id, l.board, row_number() over (partition by l.board order by l.score desc, l.achieved_at asc)::int as rk
    from public.leaderboard l
    where l.season_id = p_season and l.board in ('solo', 'coop') and l.verified and not l.hidden
  ), tiers as (
    select r.user_id, r.board, r.rk from ranked r where r.rk <= 100
  )
  select t.user_id, 'title', 'Season ' || p_season || ' Champion', t.rk, t.board from tiers t where t.rk = 1
  union all select t.user_id, 'badge', 'gold_frame', t.rk, t.board from tiers t where t.rk = 1
  union all select t.user_id, 'badge', 'palette', t.rk, t.board from tiers t where t.rk = 1
  union all select t.user_id, 'title', 'Champion', t.rk, t.board from tiers t where t.rk between 2 and 10
  union all select t.user_id, 'badge', 'champion', t.rk, t.board from tiers t where t.rk between 2 and 10
  union all select t.user_id, 'badge', 'top100', t.rk, t.board from tiers t where t.rk between 11 and 100
  union all select distinct r.user_id, 'badge', 'guardian', null::int, 'umbra' from public.runs r
    where r.season_id = p_season and r.victory and r.status in ('submitted', 'verified')
$$;
revoke all on function public.season_rewards(int) from public, anon, authenticated;

create or replace function public.admin_season_rewards_preview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s int := public.active_season('lumora');
begin
  perform public.assert_admin();
  return jsonb_build_object('season', s,
    'pendingCoop', (select count(*) from public.leaderboard where board = 'coop' and season_id = s and not verified and not hidden),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('userId', x.user_id, 'name', p.nickname, 'kind', x.kind, 'reward', x.reward, 'rank', x.rank, 'board', x.board)
      order by x.board, x.rank nulls last) from public.season_rewards(s) x join public.profiles p on p.id = x.user_id), '[]'::jsonb));
end $$;

/** Close the active Season (handing out its rewards) and open the next one. */
create or replace function public.admin_open_season(p_name text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  old int := public.active_season('lumora');
  nxt int;
  given int;
begin
  perform public.assert_admin();
  insert into public.player_titles (user_id, title, source, season_id)
    select user_id, reward, 'season', old from public.season_rewards(old) where kind = 'title' on conflict do nothing;
  insert into public.player_badges (user_id, badge, season_id)
    select user_id, reward, old from public.season_rewards(old) where kind = 'badge' on conflict do nothing;
  get diagnostics given = row_count;
  update public.seasons set status = 'closed', ends_at = now() where id = old;
  select coalesce(max(id), 0) + 1 into nxt from public.seasons;
  insert into public.seasons (id, world, name) values (nxt, 'lumora', coalesce(nullif(trim(p_name), ''), 'Season ' || nxt));
  perform public.admin_note('open_season', 'seasons', jsonb_build_object('closed', old, 'opened', nxt));
  return nxt;
end $$;

revoke all on function public.set_title(text) from public, anon;
revoke all on function public.get_collection() from public, anon;
revoke all on function public.admin_season_rewards_preview() from public, anon;
revoke all on function public.admin_open_season(text) from public, anon;
grant execute on function public.set_title(text), public.get_collection(), public.admin_season_rewards_preview(), public.admin_open_season(text) to authenticated;
