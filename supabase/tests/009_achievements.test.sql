-- Ticket 32: achievements from Run facts, lifetime totals, bestiary, Titles, Season rewards.
begin;
select plan(19);

insert into auth.users (id, raw_user_meta_data)
select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, jsonb_build_object('nickname', 'P' || i) from generate_series(1, 15) i;
insert into auth.users (id, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-000000000001', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.meta_progress (user_id) select id from public.profiles;

-- a winning Lyra Run with Combos and Guardians
select public.apply_run_facts('00000000-0000-0000-0000-000000000001', '{"hero":"mage","victory":true,"chapter":8,"escapes":0,"kingsKilled":8,"kills":3000,"maxStreak":120,
  "victoryTime":1000,"revivesBought":0,"awakened":true,"crack":0,"endlessChapter":0,"combos":{"shatter":600,"overload":10},"guardians":["inferno","frost"],
  "fused":false,"companionMax":3,"doubleKings":0,"killsByType":{"slime":40,"boss":1}}');
select ok((select array_agg(achievement_id order by achievement_id) from public.player_achievements where user_id = '00000000-0000-0000-0000-000000000001')
  @> array['awakened','chapter4','crater','firstCombo','firstGuardian','firstKing','frostTamed','heartKeeper','kingslayer','noRevive','winLyra'], 'story, Hero, Combo and dragon achievements from one Run');
select ok(not exists (select 1 from public.player_achievements where user_id = '00000000-0000-0000-0000-000000000001' and achievement_id in ('iceBreaker', 'swift', 'legend', 'allGuardians')), 'not the ones it did not earn');
select is((select count(*)::int from public.player_titles where user_id = '00000000-0000-0000-0000-000000000001'), 2, 'Heart Keeper and Kingslayer Titles');
select is((select (stats -> 'bestiary' ->> 'slime')::int from public.meta_progress where user_id = '00000000-0000-0000-0000-000000000001'), 40, 'the bestiary counts kills per monster type');

-- lifetime Combos: a second Run pushes Shatter over 1,000
select public.apply_run_facts('00000000-0000-0000-0000-000000000001', '{"hero":"knight","victory":true,"chapter":8,"escapes":1,"combos":{"shatter":450},"guardians":[],"killsByType":{"slime":2}}');
select ok(exists (select 1 from public.player_achievements where user_id = '00000000-0000-0000-0000-000000000001' and achievement_id = 'iceBreaker'), 'lifetime Shatter 1,000 → Ice Breaker');
select is((select (stats -> 'bestiary' ->> 'slime')::int from public.meta_progress where user_id = '00000000-0000-0000-0000-000000000001'), 42, 'bestiary keeps adding');
select is((select stats -> 'heroesWon' from public.meta_progress where user_id = '00000000-0000-0000-0000-000000000001'), '["mage", "knight"]'::jsonb, 'Heroes won are remembered');
select is((select count(*)::int from public.player_achievements where user_id = '00000000-0000-0000-0000-000000000001' and achievement_id = 'heartKeeper'), 1, 'an achievement is earned once');

-- Titles: only owned ones can be shown
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","session_id":"11111111-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'P1 claims');
select lives_ok($$ select public.set_title('Kingslayer') $$, 'show an owned Title');
select throws_ok($$ select public.set_title('Dragon Tamer') $$, 'TITLE_NOT_OWNED', 'cannot show a Title you do not own');
select is((public.get_collection() ->> 'shownTitle'), 'Kingslayer', 'the collection shows it');
select throws_ok($$ insert into public.player_titles (user_id, title, source) values ('00000000-0000-0000-0000-000000000001', 'Cheat', 'season') $$, '42501', 'no direct writes');

-- Season rewards: 12 verified solo entries, one unverified co-op entry, one Umbra victory
reset role;
insert into public.leaderboard (world, season_id, board, user_id, score, chapter, hero, verified, achieved_at)
select 'lumora', 1, 'solo', ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 10000 - i * 100, 5, 'mage', true, now() from generate_series(1, 12) i;
insert into public.leaderboard (world, season_id, board, user_id, score, chapter, hero, verified, achieved_at)
values ('lumora', 1, 'coop', '00000000-0000-0000-0000-000000000013', 99999, 5, 'mage', false, now());
insert into public.runs (user_id, hero, status, score, chapter, victory, season_id) values ('00000000-0000-0000-0000-000000000014', 'mage', 'submitted', 1, 8, true, 1);
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select is((public.admin_season_rewards_preview() ->> 'pendingCoop')::int, 1, 'the confirmation list flags unverified co-op entries');
select is((select public.admin_open_season('Season 2')), 2, 'opening a Season closes the old one');
reset role;
select is((select array_agg(title order by title) from public.player_titles where user_id = '00000000-0000-0000-0000-000000000001' and source = 'season'), array['Season 1 Champion'], 'rank 1: Season Title');
select ok((select array_agg(badge order by badge) from public.player_badges where user_id = '00000000-0000-0000-0000-000000000001') @> array['gold_frame', 'palette'], 'rank 1: gold frame and Hero palette');
select ok(exists (select 1 from public.player_titles where user_id = '00000000-0000-0000-0000-000000000005' and title = 'Champion')
  and exists (select 1 from public.player_badges where user_id = '00000000-0000-0000-0000-000000000011' and badge = 'top100'), 'ranks 2–10 Champion, 11–100 badge');
select ok(not exists (select 1 from public.player_badges where user_id = '00000000-0000-0000-0000-000000000013')
  and exists (select 1 from public.player_badges where user_id = '00000000-0000-0000-0000-000000000014' and badge = 'guardian'), 'unverified co-op gets nothing; an Umbra win gets the guardian badge');

select * from finish();
rollback;
