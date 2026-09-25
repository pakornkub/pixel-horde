-- Ticket 09: server-counted Gold, Run start/submit checks, Shop, offline Runs, legacy import.
begin;
select plan(37);

insert into auth.users (id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', '{"nickname":"Alice"}'), ('22222222-2222-2222-2222-222222222222', '{"nickname":"Bob"}');

select is((select status from public.balance_configs where version = 0), 'published', 'built-in config is version 0');
select is(public.cfg_num(0, 'stage', 'durBase'), 60::numeric, 'cfg_num reads the shared section');
select is(public.min_seconds_to_reach(0, 3), (60 + 80) * 0.9, 'Chapter 3 needs 90% of Stage 1+2 time');
select is(public.shop_cost(0, 'power', 0), 30::bigint, 'shop price level 0');
select is(public.shop_cost(0, 'power', 2), 77::bigint, 'shop price grows ×1.6');

-- Bob exists with some history (for RLS checks)
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","session_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Bob claims');
select lives_ok($$ select public.start_run('mage') $$, 'Bob starts a Run');

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Alice claims');
select is((public.get_meta() ->> 'gold')::int, 0, 'new players start with 0 Gold');
select is((select count(*)::int from public.runs), 0, 'RLS: Alice cannot see Bob''s Runs');
select throws_ok($$ update public.meta_progress set gold = 999999 $$, '42501', 'players cannot write Gold directly');
select throws_ok($$ insert into public.runs (user_id, hero) values ('11111111-1111-1111-1111-111111111111', 'mage') $$, '42501', 'players cannot insert Runs directly');
select throws_ok($$ select public.start_run('ranger') $$, 'HERO_LOCKED', 'locked Hero cannot start a Run');

create temp table t_run as select public.start_run('mage') as r;
grant select on t_run to authenticated;
select ok((select (r ->> 'seed')::bigint between 0 and 4294967295 from t_run), 'server picks the seed');
select throws_ok($$ select public.start_run('mage') $$, 'RATE_LIMITED', 'Run starts are rate limited');

-- submitting instantly for Chapter 3 is too fast
select is((select public.submit_run(jsonb_build_object('runId', r ->> 'runId', 'token', r ->> 'token', 'chapter', 3, 'kills', 100, 'gold', 50, 'score', 3000100)) ->> 'reason' from t_run),
          'TOO_FAST', 'impossible speed is rejected');
select is((public.get_meta() ->> 'gold')::int, 0, 'rejected Runs give no Gold');
select throws_ok(format($f$ select public.submit_run('{"runId":"%s","token":"%s","chapter":1,"kills":1,"gold":1}') $f$, (select r ->> 'runId' from t_run), (select r ->> 'token' from t_run)),
                 'RUN_ALREADY_SUBMITTED', 'a Run can be submitted once');

-- a Run that really took 10 minutes
reset role;
insert into t_run select jsonb_build_object('runId', id, 'token', token) from public.runs where user_id = '11111111-1111-1111-1111-111111111111' and status = 'started';
update public.runs set started_at = now() - interval '10 minutes' where user_id = '11111111-1111-1111-1111-111111111111';
insert into public.runs (user_id, hero, token, started_at) values ('11111111-1111-1111-1111-111111111111', 'mage', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '10 minutes');
set local role authenticated;
select is((select public.submit_run(jsonb_build_object('runId', (select id from public.runs where token = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'token', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chapter', 3, 'kills', 800, 'gold', 500, 'score', 3000800, 'pausedMs', 60000)) ->> 'status'),
          'submitted', 'a plausible Run is accepted');
select is((public.get_meta() ->> 'gold')::int, 500, 'its Gold is credited by the server');
select is((select victory from public.runs where token = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), false, 'a Run without victory unlocks nothing');
select is((public.get_leaderboard('solo') -> 'me' ->> 'score')::bigint, 3000800::bigint, 'and it lands on the Season board');

reset role;
insert into public.runs (user_id, hero, token, started_at) values ('11111111-1111-1111-1111-111111111111', 'mage', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() - interval '10 minutes');
set local role authenticated;
select is((select public.submit_run(jsonb_build_object('runId', (select id from public.runs where token = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 'token', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'chapter', 2, 'kills', 50, 'gold', 999999)) ->> 'reason'),
          'GOLD_CEILING', 'Gold above the Chapter ceiling is rejected');

-- shop and heroes
select is((public.buy_upgrade('power') -> 'shop' ->> 'power')::int, 1, 'buy_upgrade raises the level');
select is((public.get_meta() ->> 'gold')::int, 470, 'and charges the server price');
select throws_ok($$ select public.unlock_hero('alchemist') $$, 'NOT_ENOUGH_GOLD', 'Vex costs 1,000 Gold');
select throws_ok($$ select public.unlock_hero('ranger') $$, 'NOT_ENOUGH_GOLD', 'cannot buy what you cannot afford (Kit 500)');
select throws_ok($$ select public.buy_upgrade('nonsense') $$, 'UNKNOWN_ITEM', 'unknown items are refused');

-- offline Runs: same ceilings, duplicates ignored
select is(public.submit_offline_run('{"clientRunId":"c1","chapter":2,"kills":120,"gold":40,"playMs":90000,"hero":"mage"}') ->> 'status', 'offline', 'offline Run accepted');
select is(public.submit_offline_run('{"clientRunId":"c1","chapter":2,"kills":120,"gold":40,"playMs":90000,"hero":"mage"}') ->> 'status', 'duplicate', 'the same offline Run counts once');
-- Weapons: a locked Weapon cannot start a Run; found Weapons join the collection (max 2, well-formed)
select throws_ok($$ select public.start_run('mage', 'solo', 'lumora', 'sunblade') $$, 'WEAPON_LOCKED', 'only owned Weapons can be picked');
select is(public.submit_offline_run('{"clientRunId":"c3","chapter":2,"kills":120,"gold":0,"playMs":90000,"hero":"mage","weaponsFound":["sunblade","bad id!","thornwhip","boneScythe"]}') -> 'meta' -> 'weapons',
          '["lumora:sunblade", "lumora:thornwhip"]'::jsonb, 'found Weapons are added (at most 2, well-formed ids)');
reset role;
update public.runs set started_at = started_at - interval '1 hour';
set local role authenticated;
select ok((public.start_run('mage', 'solo', 'lumora', 'sunblade') ->> 'runId') is not null, 'an owned Weapon starts a Run');
reset role;
select is((select weapon from public.runs order by started_at desc limit 1), 'sunblade', 'the Run records its Weapon');
set local role authenticated;
select is((public.submit_offline_run('{"clientRunId":"c2","chapter":2,"kills":120,"gold":10,"walletSpent":30,"playMs":90000,"hero":"mage"}') -> 'meta' ->> 'gold')::int,
          490, 'wallet Gold spent during a Run (Stage-end swaps) is charged on submit');

-- legacy save: clamped and only once
select is((public.import_legacy_meta('{"gold":999999999,"up":{"power":99,"greed":2},"owned":["alchemist","hacker"]}') ->> 'gold')::bigint,
          490 + 50000::bigint, 'legacy Gold is capped');
select is((public.import_legacy_meta('{"gold":5000}') ->> 'gold')::bigint, 50490::bigint, 'legacy import happens once');

select * from finish();
rollback;
