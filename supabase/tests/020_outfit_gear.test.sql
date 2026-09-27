-- Ticket 51: outfit pieces. Locked before the first win, known sets / slots only, server prices, max level.
begin;
select plan(12);

insert into auth.users (id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', '{"nickname":"Alice"}');

select is(public.outfit_cost(0, 0), 500::bigint, 'a piece costs 500 Gold');
select is(public.outfit_cost(0, 4), 3277::bigint, 'the price grows ×1.6 (500 × 1.6⁴)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Alice claims');
select lives_ok($$ select public.get_meta() $$, 'Alice has a meta row');

reset role;
update public.meta_progress set gold = 5000 where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select throws_ok($$ select public.buy_outfit('frost', 'hat') $$, 'SHOP_LOCKED', 'no outfits before the first win');

reset role;
update public.meta_progress set stats = stats || '{"heartCrack":1}'::jsonb where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select is((public.buy_outfit('frost', 'hat') -> 'shop' ->> 'outfit:frost:hat')::int, 1, 'buy_outfit buys the piece');
select is((public.buy_outfit('frost', 'hat') -> 'shop' ->> 'outfit:frost:hat')::int, 2, 'and levels it up');
select is((public.get_meta() ->> 'gold')::int, 5000 - 500 - 800, 'at the server price');
select throws_ok($$ select public.buy_outfit('gold', 'hat') $$, 'UNKNOWN_ITEM', 'unknown sets are refused');
select throws_ok($$ select public.buy_outfit('frost', 'boots') $$, 'UNKNOWN_ITEM', 'unknown slots are refused');
select throws_ok($$ select public.buy_upgrade('outfit:frost:hat') $$, 'UNKNOWN_ITEM', 'the permanent shop cannot sell outfit levels');

reset role;
update public.meta_progress set shop = shop || '{"outfit:frost:hat":5}'::jsonb where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select throws_ok($$ select public.buy_outfit('frost', 'hat') $$, 'MAXED', 'no level above outfits.max');

select * from finish();
rollback;
