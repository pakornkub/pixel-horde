-- Changelog: every publish writes one; admins write and edit; anyone reads the public ones.
begin;
select plan(11);

insert into auth.users (id, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444', '{"nickname":"Tester"}'), ('aaaaaaaa-0000-0000-0000-000000000004', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000004';

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select throws_ok($$ select public.upsert_changelog('{"kind":"feature","titleTh":"x"}') $$, 'NOT_ADMIN', 'players cannot write the changelog');
select throws_ok($$ select * from public.changelog $$, '42501', 'players cannot read the table directly');

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';
select is(public.publish_config((select data - 'version' from public.balance_configs where version = 0), 'quick tweak'), 1, 'a publish without changelog text');
select is(public.admin_changelog() -> 0 ->> 'titleTh', 'ปรับสมดุลเกม (v1)', 'still gets a plain changelog entry');
select is(public.publish_config((select data - 'version' from public.balance_configs where version = 0), 'pass', null,
  '{"titleTh":"ด่าน 1 ง่ายขึ้น","items":[{"cat":"boss","th":"King Slime หลบท่าง่ายขึ้น","en":"King Slime is easier to dodge"},{"cat":"nope","th":"  x  "},{"cat":"skill","th":"   "}]}'), 2, 'a publish with changelog text');
select is(public.admin_changelog() -> 0 -> 'items', '[{"cat":"boss","th":"King Slime หลบท่าง่ายขึ้น","en":"King Slime is easier to dodge"},{"cat":"system","th":"x","en":""}]'::jsonb, 'items are cleaned: unknown category, blank lines dropped');
select ok(public.upsert_changelog('{"kind":"feature","titleTh":"ปุ่มความยาก","items":[{"cat":"ui","th":"เลือกความยากได้"}],"note":"PR #15"}') > 0, 'admin writes a code release entry');
select throws_ok($$ select public.upsert_changelog('{"kind":"party","titleTh":"x"}') $$, 'BAD_KIND', 'unknown kinds are refused');
select lives_ok($$ select public.upsert_changelog(jsonb_build_object('id', (public.admin_changelog() -> 0 ->> 'id')::bigint, 'kind', 'feature', 'titleTh', 'ปุ่มความยาก', 'public', false)) $$, 'admin hides an entry');

set local role anon;
select is(jsonb_array_length(public.get_changelog()), 2, 'the website sees public entries only');
select ok(not (public.get_changelog() -> 0 ? 'note'), 'without admin notes');

select * from finish();
rollback;
