-- Co-op Run checks: the Chapter a player joined at counts, and the ceilings scale with the room.
begin;
select plan(14);

-- run_problem directly (version 0: co-op multipliers default to 0 = unchanged)
-- Chapter 6 needs 0.9 × (60+80+100+120+140) = 450 s; joining at Chapter 4 leaves 0.9 × (120+140) = 234 s
select is(public.run_problem(0, 6, 100, 100, 240), 'TOO_FAST', 'solo: 240 s is too fast for Chapter 6');
select is(public.run_problem(0, 6, 100, 100, 240, 'solo', 4, 4), 'TOO_FAST', 'solo ignores joinChapter');
select is(public.run_problem(0, 6, 100, 100, 240, 'coop', 4, 2), null::text, 'co-op: joined at Chapter 4, 240 s is enough');
select is(public.run_problem(0, 6, 100, 100, 200, 'coop', 4, 2), 'TOO_FAST', 'co-op: still too fast below the Chapters actually played');
select is(public.run_problem(0, 6, 100, 100, 240, 'coop', 99, 2), 'TOO_FAST', 'a joinChapter above the Chapter counts as Chapter 1');
select is(public.run_problem(0, 6, 100, 100, 240, 'coop', null, null), 'TOO_FAST', 'missing joinChapter = Chapter 1');
-- the kill ceiling credits the Chapters before joining: (15 × (240 + 216) + 500 × 6) = 9840
select is(public.run_problem(0, 6, 9800, 100, 240, 'coop', 4, 1), null::text, 'co-op: kills up to the credited time');
select is(public.run_problem(0, 6, 9900, 100, 240, 'coop', 4, 1), 'KILL_CEILING', 'co-op: kills above it');
select is(public.run_problem(0, 2, 10, 999999, 600, 'coop', 1, 4), 'GOLD_CEILING', 'multipliers 0: co-op Gold ceiling as solo');

-- a published version with the co-op multipliers set
insert into public.balance_configs (version, data, status, note, published_at)
select 901, jsonb_set(data, '{shared,antiCheat}', (data -> 'shared' -> 'antiCheat') || '{"coopKillsPerMate":1,"coopGoldPerMate":0.5}'::jsonb), 'published', 'test', now()
from public.balance_configs where version = 0;
-- Chapter 2 Gold ceiling (v0) = 1500 × (1.35² − 1) / 0.35 = 3525; × 1.5 = 5287.5
select is(public.run_problem(901, 2, 10, 5200, 600, 'coop', 1, 2), null::text, '2 players: Gold ceiling × 1.5');
select is(public.run_problem(901, 2, 10, 5400, 600, 'coop', 1, 2), 'GOLD_CEILING', '2 players: above ×1.5');
select is(public.run_problem(901, 2, 10, 5400, 600, 'coop', 1, 9), null::text, 'team is clamped to 4 players (× 2.5)');
select is(public.run_problem(901, 2, 10, 4000, 600, 'solo', 1, 4), 'GOLD_CEILING', 'solo never scales');
-- kill ceiling at 600 s, Chapter 2: (15 × 600 + 1000) × (1 + 1 × 3) = 40000
select is(public.run_problem(901, 2, 39000, 10, 600, 'coop', 1, 4), null::text, '4 players: kill ceiling × 4');

select * from finish();
rollback;
