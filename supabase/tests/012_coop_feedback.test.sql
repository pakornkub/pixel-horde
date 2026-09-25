-- Account suspension (separate from the leaderboard ban) and the refreshed config schema.
begin;
select plan(10);

insert into auth.users (id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', '{"nickname":"Griefer"}'), ('aaaaaaaa-0000-0000-0000-000000000001', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok($$ select public.suspend_player('11111111-1111-1111-1111-111111111111', now() + interval '7 days') $$, 'NOT_ADMIN', 'suspending is admin-only');
select lives_ok($$ select public.claim_session() $$, 'the player claims a session');
select lives_ok($$ select public.check_session() $$, 'not suspended: gameplay RPCs work');

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.suspend_player('11111111-1111-1111-1111-111111111111', now() + interval '7 days') $$, 'admin suspends the account');
select ok((public.admin_players('Grief') -> 0 ->> 'suspended')::boolean, 'suspension shows on the players page');
select ok(not (public.admin_players('Grief') -> 0 ->> 'banned')::boolean, 'a suspension is not a leaderboard ban');

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select ok((select suspended_until > now() from public.claim_session()), 'claim_session still works and tells the game until when');
select throws_ok($$ select public.check_session() $$, 'ACCOUNT_SUSPENDED', 'a suspended account cannot play online');

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.suspend_player('11111111-1111-1111-1111-111111111111', null) $$, 'admin lifts the suspension');

reset role;
select ok(public.config_problems('{"shared":{"coop":{"pickTime":8,"shieldR":30}}}'::jsonb) = '{}', 'new co-op config fields are accepted');

select * from finish();
rollback;
