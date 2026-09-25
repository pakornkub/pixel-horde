-- Tickets 15–18: admin RPCs are admin-only, moderation works and is audited, overview rules fire.
begin;
select plan(16);

insert into auth.users (id, raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111', '{"nickname":"Cheater"}'), ('aaaaaaaa-0000-0000-0000-000000000001', '{"nickname":"Owner"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.meta_progress (user_id, gold) values ('11111111-1111-1111-1111-111111111111', 999999);
insert into public.runs (id, user_id, hero, status, score, chapter, started_at, ended_at, gold_earned, config_version) values
  ('d1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'mage', 'submitted', 8000000, 8, now() - interval '3 min', now(), 10, 0);
select public.record_leaderboard('d1111111-0000-0000-0000-000000000001');
insert into public.client_errors (fingerprint, message, count) values ('zz', 'TypeError: boom', 80);

-- non-admins are refused everywhere
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$ select public.admin_overview() $$, 'NOT_ADMIN', 'overview is admin-only');
select throws_ok($$ select public.ban_player('11111111-1111-1111-1111-111111111111', null) $$, 'NOT_ADMIN', 'ban is admin-only');
select throws_ok($$ select public.hide_score('11111111-1111-1111-1111-111111111111', 'solo', true) $$, 'NOT_ADMIN', 'hide is admin-only');
select throws_ok($$ select public.admin_stats() $$, 'NOT_ADMIN', 'stats are admin-only');
select throws_ok($$ select public.upsert_announcement('{}') $$, 'NOT_ADMIN', 'announcements are admin-only');
select throws_ok($$ select * from public.audit_log $$, '42501', 'players cannot read the audit log');

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(jsonb_path_exists(public.admin_overview(), '$.attention[*] ? (@.kind == "error")'), 'spiking error needs attention');
select ok(jsonb_path_exists(public.admin_overview(), '$.attention[*] ? (@.kind == "gold")'), 'abnormal Gold needs attention');
select is(public.admin_leaderboard('solo') -> 0 ->> 'status', 'suspicious', 'a Chapter 8 score in 3 minutes is tagged suspicious');

select lives_ok($$ select public.hide_score('11111111-1111-1111-1111-111111111111', 'solo', true) $$, 'admin hides the score');
select is((public.get_leaderboard('solo') ->> 'total')::int, 0, 'hidden scores leave the public board');
select lives_ok($$ select public.ban_player('11111111-1111-1111-1111-111111111111', now() + interval '30 days') $$, 'admin bans the player');
select ok((public.admin_players('Cheat') -> 0 ->> 'banned')::boolean, 'ban shows on the players page');
select ok(public.upsert_announcement('{"title_th":"ทดสอบ","title_en":"Test"}') > 0, 'admin writes an announcement');

reset role;
select ok((select count(*) from public.audit_log where target in ('leaderboard', 'profiles', 'announcements')) >= 3, 'moderation is audited with before/after');
select ok((select detail ? 'old' and detail ? 'new' from public.audit_log where target = 'profiles' limit 1), 'audit rows keep before and after');

select * from finish();
rollback;
