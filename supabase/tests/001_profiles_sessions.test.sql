-- Ticket 08: profiles RLS, nicknames, latest-login-wins sessions.
begin;
select plan(17);

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '{"nickname":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '{}'),
  ('33333333-3333-3333-3333-333333333333', '{"nickname":"fuckface"}');

select is((select nickname from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'sign-up nickname is stored');
select ok((select nickname from public.profiles where id = '22222222-2222-2222-2222-222222222222') ~ '^Hero#[0-9]{4}$', 'missing nickname becomes Hero#1234');
select ok((select nickname from public.profiles where id = '33333333-3333-3333-3333-333333333333') ~ '^Hero#[0-9]{4}$', 'rude nickname is replaced');
select ok(public.nickname_is_valid('ผู้กล้า_01'), 'Thai nicknames are allowed');
select ok(not public.nickname_is_valid('F.u.c.k'), 'punctuation does not hide a rude word');
select ok(not public.nickname_is_valid('เหี้ยมาก'), 'Thai rude word rejected');
select ok(public.nickname_is_valid('Grape Scholar'), 'innocent words are not caught');

-- act as Alice on device A
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'RLS: a player sees only their own profile');
select throws_ok($$ update public.profiles set role = 'admin' $$, '42501', 'players cannot write profiles directly');
select throws_ok($$ insert into public.profiles (id, nickname) values ('22222222-2222-2222-2222-222222222222', 'Hax') $$, '42501', 'players cannot insert profiles');
select throws_ok($$ select public.set_nickname('Bob') $$, 'SESSION_REPLACED', 'gameplay RPCs need a claimed session');
select lives_ok($$ select public.claim_session() $$, 'device A claims the session');
select is((select nickname from public.set_nickname('Bob')), 'Bob', 'nickname can be changed');
select throws_ok($$ select public.set_nickname('shit happens') $$, 'NICKNAME_REJECTED', 'rude nickname rejected');

-- Alice logs in on device B: latest login wins
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'device B claims the session');

-- device A is now stale
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok($$ select public.check_session() $$, 'SESSION_REPLACED', 'the older device is rejected');

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select ok(public.check_session(), 'the newest device keeps playing');

select * from finish();
rollback;
