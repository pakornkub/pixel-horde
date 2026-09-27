-- Ticket 56: the special shop's Weapon forge. Locked before the first win, owned Weapons only, server prices, max level.
begin;
select plan(16);

insert into auth.users (id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', '{"nickname":"Alice"}');

select is(public.forge_cost(0, 0), 400::bigint, 'forge price level 0');
select is(public.forge_cost(0, 4), 2621::bigint, 'forge price grows ×1.6 (400 × 1.6⁴)');
select is(public.forge_num(0, 'max'), 5::numeric, 'versions without shared.forge read the built-in max');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Alice claims');
select lives_ok($$ select public.get_meta() $$, 'Alice has a meta row');
select throws_ok($$ select public.forge_weapon('judgement') $$, 'SHOP_LOCKED', 'no forging before the first win');

-- Alice has Gold and Thornwhip but has not won yet
reset role;
update public.meta_progress set gold = 5000, weapons = array['lumora:thornwhip'] where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select throws_ok($$ select public.forge_weapon('thornwhip') $$, 'SHOP_LOCKED', 'still locked with Gold and a Weapon');

-- beating Umbra unlocks Heart Crack tier 1
reset role;
update public.meta_progress set stats = stats || '{"heartCrack":1}'::jsonb where user_id = '11111111-1111-1111-1111-111111111111';
select ok(public.has_won('11111111-1111-1111-1111-111111111111'), 'has_won: Heart Crack tier 1');
set local role authenticated;
select is((public.forge_weapon('thornwhip') -> 'shop' ->> 'forge:lumora:thornwhip')::int, 1, 'forge_weapon raises the level');
select is((public.get_meta() ->> 'gold')::int, 4600, 'and charges the server price');
select is((public.forge_weapon('judgement') -> 'shop' ->> 'forge:lumora:judgement')::int, 1, 'Judgement is always owned');
select throws_ok($$ select public.forge_weapon('sunblade') $$, 'WEAPON_LOCKED', 'only owned Weapons can be forged');
select throws_ok($$ select public.forge_weapon('bad id!') $$, 'UNKNOWN_ITEM', 'malformed ids are refused');
select throws_ok($$ select public.buy_upgrade('forge:lumora:thornwhip') $$, 'UNKNOWN_ITEM', 'the permanent shop cannot sell forge levels');

-- at the max level
reset role;
update public.meta_progress set shop = shop || '{"forge:lumora:thornwhip":5}'::jsonb where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select throws_ok($$ select public.forge_weapon('thornwhip') $$, 'MAXED', 'no level above forge.max');
select throws_ok($$ select public.has_won('11111111-1111-1111-1111-111111111111') $$, '42501', 'players cannot call has_won');

select * from finish();
rollback;
