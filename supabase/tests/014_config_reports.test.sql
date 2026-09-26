-- Balance reports: published with a config version, shown to admins, never edited.
begin;
select plan(8);

insert into auth.users (id, raw_user_meta_data) values ('33333333-3333-3333-3333-333333333333', '{"nickname":"Tester"}'), ('aaaaaaaa-0000-0000-0000-000000000003', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000003';

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok($$ select public.admin_configs() $$, 'NOT_ADMIN', 'players cannot read versions or reports');
select throws_ok($$ select * from public.config_reports $$, '42501', 'players cannot read the report table');

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}';
select is(public.publish_config((select data - 'version' from public.balance_configs where version = 0), 'no report'), 1, 'publishing without a report still works');
select is(public.publish_config((select data - 'version' from public.balance_configs where version = 0), 'tuned', '{"title":"รอบจูน","reasons":{"shared.stage.durBase":"why"}}'), 2, 'publishing with a report');
select throws_ok($$ select public.publish_config((select data - 'version' from public.balance_configs where version = 0), 'bad', '[1,2]') $$, 'REPORT_INVALID', 'a report must be an object');
select is((select public.admin_configs() -> 0 -> 'report' ->> 'title'), 'รอบจูน', 'admin_configs returns the report with its version');
select ok((select public.admin_configs() -> 1 -> 'report') = 'null'::jsonb, 'versions without a report show null');
reset role;
select throws_ok($$ update public.config_reports set report = '{}' where version = 2 $$, 'CONFIG_REPORT_IMMUTABLE', 'reports are never edited');

select * from finish();
rollback;
