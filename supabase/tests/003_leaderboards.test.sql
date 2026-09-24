-- Ticket 10: best Run per board, tie order, co-op unverified, my rank + neighbours, Hero filter.
begin;
select plan(14);

insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, jsonb_build_object('nickname', 'P' || i)
from generate_series(1, 105) i;

-- helper: a submitted solo Run for player i
create function pg_temp.run(i int, sc bigint, hero text default 'mage', mode text default 'solo', at timestamptz default now()) returns uuid language sql as $$
  insert into public.runs (user_id, hero, mode, status, score, chapter, ended_at)
  values (('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, hero, mode, 'submitted', sc, 3, at) returning id
$$;

select public.record_leaderboard(pg_temp.run(i, 1000 + i * 10)) from generate_series(1, 105) i;
select is((select count(*)::int from public.leaderboard where board = 'solo' and season_id = 1), 105, 'one solo row per player in Season 1');
select is((select count(*)::int from public.leaderboard where board = 'alltime' and season_id = 0), 105, 'solo Runs also feed the all-time board');

-- a worse Run does not replace the best; a better one does
select public.record_leaderboard(pg_temp.run(1, 5));
select is((select score from public.leaderboard where board = 'solo' and user_id = '00000000-0000-0000-0000-000000000001'), 1010::bigint, 'worse Run keeps the best');
select public.record_leaderboard(pg_temp.run(1, 99999, 'knight'));
select is((select score from public.leaderboard where board = 'solo' and user_id = '00000000-0000-0000-0000-000000000001'), 99999::bigint, 'better Run replaces it');

-- ties: earliest first
select public.record_leaderboard(pg_temp.run(2, 99999, 'mage', 'solo', now() - interval '1 day'));
select is((public.get_leaderboard('solo') -> 'top' -> 0 ->> 'name'), 'P2', 'equal scores: the earlier one ranks higher');

-- co-op is unverified and separate
select public.record_leaderboard(pg_temp.run(3, 500, 'mage', 'coop'));
select is((select verified from public.leaderboard where board = 'coop'), false, 'co-op entries are unverified');
select is((public.get_leaderboard('coop') -> 'top' -> 0 ->> 'verified')::boolean, false, 'and shown as such');

-- offline / rejected Runs never rank
select public.record_leaderboard((select id from public.runs where false));
insert into public.runs (user_id, hero, status, score, chapter) values ('00000000-0000-0000-0000-000000000004', 'mage', 'offline', 9999999, 3);
select public.record_leaderboard((select id from public.runs where status = 'offline'));
select isnt((public.get_leaderboard('solo') -> 'top' -> 0 ->> 'name'), 'P4', 'offline Runs are not ranked');

-- view as player 5 (rank near the bottom, outside the top 100)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(jsonb_array_length(public.get_leaderboard('solo') -> 'top'), 100, 'top 100 only');
select is((public.get_leaderboard('solo') -> 'me' ->> 'rank')::int, 103, 'my own rank outside the top 100');
select is(jsonb_array_length(public.get_leaderboard('solo') -> 'around'), 3, 'with one neighbour above and below');
select is((public.get_leaderboard('solo', 'knight') -> 'top' -> 0 ->> 'name'), 'P1', 'Hero filter');
select is((public.get_leaderboard('solo', 'knight') ->> 'total')::int, 1, 'filter counts only that Hero');
select throws_ok($$ select * from public.leaderboard $$, '42501', 'the table itself is not readable');

select * from finish();
rollback;
