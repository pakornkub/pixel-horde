-- Tickets 12 + 13: flags, maintenance, announcements, config publish/rollback/validation, audit log.
begin;
select plan(19);

insert into auth.users (id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', '{"nickname":"Alice"}'), ('aaaaaaaa-0000-0000-0000-000000000001', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.announcements (title_th, title_en, starts_at, ends_at) values
  ('กิจกรรม', 'Event', now() - interval '1 hour', now() + interval '1 day'),
  ('หมดแล้ว', 'Over', now() - interval '2 day', now() - interval '1 day');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select is((public.get_live_state() -> 'flags' ->> 'coop')::boolean, true, 'players read flags');
select is(jsonb_array_length(public.get_live_state() -> 'announcements'), 1, 'only active announcements are shown');
select is((public.get_live_state() ->> 'configVersion')::int, 0, 'config version starts at 0');
select lives_ok($$ select public.claim_session() $$, 'claim');
select throws_ok($$ select public.set_flag('coop', 'false') $$, 'NOT_ADMIN', 'players cannot change flags');
select throws_ok($$ update public.feature_flags set value = 'false' $$, '42501', 'nor write the table');
select throws_ok($$ select public.publish_config('{}') $$, 'NOT_ADMIN', 'players cannot publish configs');

-- admin
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","session_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select lives_ok($$ select public.set_flag('maintenance', 'true') $$, 'admin turns maintenance on');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","session_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok($$ select public.check_session() $$, 'MAINTENANCE', 'maintenance pauses gameplay RPCs');
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","session_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select lives_ok($$ select public.set_flag('maintenance', 'false') $$, 'and off again');

select is(public.publish_config((select data - 'version' from public.balance_configs where version = 0) #- '{shared,stage,durBase}' || '{"shared":{"stage":{"durBase":45}}}'::jsonb, 'shorter stages'), 1,
          'a valid config publishes as version 1');
select is((public.get_config() -> 'data' -> 'shared' -> 'stage' ->> 'durBase')::int, 45, 'players get the latest version');
select throws_ok($$ select public.publish_config('{"shared":{"stage":{"bossAt":3}}}') $$, '22023', 'out-of-range values are refused');
select ok(array_to_string(public.config_problems('{"shared":{"stage":{"bossAt":3,"typo":1}}}'), '|') ~ 'shared.stage.bossAt: above 1.*typo: unknown field|shared.stage.typo: unknown field.*bossAt',
          'problems name the exact fields');
select is(public.rollback_config(0), 2, 'rollback creates a new version');
select is((public.get_config() -> 'data' -> 'shared' -> 'stage' ->> 'durBase')::int, 60, 'with the old numbers');

reset role;
select throws_ok($$ update public.balance_configs set data = '{}' where version = 1 $$, 'PUBLISHED_CONFIG_IS_IMMUTABLE', 'published versions are immutable');
select ok((select count(*) from public.audit_log where target in ('feature_flags', 'balance_configs')) >= 4, 'admin changes are audited');
select throws_ok($$ delete from public.audit_log $$, 'AUDIT_LOG_IS_APPEND_ONLY', 'the audit log cannot be edited');

select * from finish();
rollback;
