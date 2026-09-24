-- Ticket 44: hints seen once per account (any device), validated ids, replay clears them.
begin;
select plan(5);

insert into auth.users (id, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444', '{"nickname":"Dee"}');
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","session_id":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';
select lives_ok($$ select public.claim_session() $$, 'Dee claims a session');
select is(public.get_meta() -> 'stats' -> 'tips', null, 'no hints seen yet');
select is(public.set_tips(array['move', 'ult', 'move', 'bad id!', 'first']), '["first", "move", "ult"]'::jsonb, 'duplicates and bad ids are dropped');
select is(public.get_meta() -> 'stats' -> 'tips', '["first", "move", "ult"]'::jsonb, 'another device sees the same list');
select is(public.set_tips(array['first']), '["first"]'::jsonb, 'replaying hints keeps only the first-Run marker');

select * from finish();
rollback;
