-- Leaderboard rows name the Heart Crack tier (0–3) of the Run behind each score (read from its best Run).
create or replace function public.get_leaderboard(p_board text, p_hero text default null, p_season int default null, p_world text default 'lumora')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  season int := case when p_board = 'alltime' then 0 else coalesce(p_season, public.active_season(p_world)) end;
  me uuid := auth.uid();
  result jsonb;
begin
  with ranked as (
    select l.*, p.nickname, p.name_hidden, p.shown_title, coalesce(r.crack, 0) as crack,
           row_number() over (order by l.score desc, l.achieved_at asc) as rank
    from public.leaderboard l
    join public.profiles p on p.id = l.user_id
    left join public.runs r on r.id = l.best_run_id
    where l.world = p_world and l.season_id = season and l.board = p_board and not l.hidden
      and (p.banned_until is null or p.banned_until <= now())
      and (p_hero is null or l.hero = p_hero)
  ), rows as (
    select rank, jsonb_build_object('rank', rank, 'userId', user_id, 'name', case when name_hidden then 'Hero' else nickname end,
             'title', shown_title, 'score', score, 'chapter', chapter, 'hero', hero, 'weapon', weapon, 'crack', crack,
             'verified', verified, 'at', achieved_at, 'me', user_id = me) as j,
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
grant execute on function public.get_leaderboard(text, text, int, text) to anon, authenticated;
