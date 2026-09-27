-- Ticket 57: Mora is sold only after a win, at her schema-default price until a config carries it; legacy saves never grant her.
begin;
select plan(9);

insert into auth.users (id, raw_user_meta_data) values ('33333333-3333-3333-3333-333333333333', '{"nickname":"Carol"}'), ('44444444-4444-4444-4444-444444444444', '{"nickname":"Dave"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","session_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Carol claims');
select is((public.get_meta() ->> 'gold')::int, 0, 'Carol starts with 0 Gold');
select throws_ok($$ select public.unlock_hero('necromancer') $$, 'NEEDS_WIN', 'Mora is not sold before a win');

reset role;
update public.meta_progress set gold = 5000 where user_id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
select throws_ok($$ select public.unlock_hero('necromancer') $$, 'NEEDS_WIN', 'Gold alone is not enough');

reset role;
update public.meta_progress set stats = stats || '{"heroesWon":["mage"]}'::jsonb where user_id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
select lives_ok($$ select public.unlock_hero('necromancer') $$, 'after a win Mora can be bought');
select is((public.get_meta() ->> 'gold')::bigint, 3000::bigint, 'she costs the schema default 2000 while the config lacks her');
select ok(public.get_meta() -> 'heroes' ? 'necromancer', 'Mora is owned');

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","session_id":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Dave claims');
select ok(not (public.import_legacy_meta('{"owned":["alchemist","necromancer"]}') -> 'heroes' ? 'necromancer'), 'a legacy save never grants Mora');

select * from finish();
rollback;
