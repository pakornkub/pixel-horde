-- Co-op test feedback (2026-09-26):
-- 1. Account suspension, separate from the leaderboard ban. `banned_until` keeps its meaning (hidden
--    from leaderboards, still plays); `suspended_until` blocks every gameplay RPC (assert_session
--    raises ACCOUNT_SUSPENDED): no Gold, no scores, no saves. claim_session still works so the game
--    can show the player why.
-- 2. Balance Config schema: only the `shared.coop` object is replaced (other migrations patch other
--    parts in place): co-op level-up without stopping the room (pickTime, shield bubble, shieldAfter)
--    and shared drops (heartShare); `coop.goldPerKill` stays but is unused (guests now pick up Gold like everyone).

alter table public.profiles add column if not exists suspended_until timestamptz;

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update of role, banned_until, name_hidden, suspended_until on public.profiles
  for each row execute function public.audit_trigger();

create or replace function public.assert_session()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  active uuid;
  susp timestamptz;
begin
  if uid is null then
    raise exception 'NOT_SIGNED_IN' using errcode = '28000';
  end if;
  if coalesce((public.flag('maintenance'))::boolean, false) and not public.is_admin() then
    raise exception 'MAINTENANCE' using errcode = '57P01';
  end if;
  select p.active_session_id, p.suspended_until into active, susp from public.profiles p where p.id = uid;
  if active is null or active is distinct from public.jwt_session_id() then
    raise exception 'SESSION_REPLACED' using errcode = 'P0001', hint = 'The account was opened on another device.';
  end if;
  if susp > now() then
    raise exception 'ACCOUNT_SUSPENDED' using errcode = 'P0001', hint = susp::text;
  end if;
  return uid;
end $$;
revoke all on function public.assert_session() from public, anon, authenticated;

/** Suspend an account until a time (null = lift the suspension). */
create or replace function public.suspend_player(p_user uuid, p_until timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.profiles set suspended_until = p_until where id = p_user;
end $$;
revoke all on function public.suspend_player(uuid, timestamptz) from public, anon;
grant execute on function public.suspend_player(uuid, timestamptz) to authenticated;

create or replace function public.admin_players(p_search text default '', p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nickname, 'role', p.role, 'gold', coalesce(m.gold, 0),
      'linked', not coalesce(u.is_anonymous, true), 'banned', coalesce(p.banned_until > now(), false), 'bannedUntil', p.banned_until,
      'suspended', coalesce(p.suspended_until > now(), false), 'suspendedUntil', p.suspended_until,
      'lastSeen', p.last_seen) order by p.last_seen desc)
    from (select * from public.profiles where p_search = '' or nickname ilike '%' || p_search || '%' order by last_seen desc limit least(p_limit, 200)) p
    left join public.meta_progress m on m.user_id = p.id left join auth.users u on u.id = p.id), '[]'::jsonb);
end $$;
revoke all on function public.admin_players(text, int) from public, anon;
grant execute on function public.admin_players(text, int) to authenticated;

update public.config_schema set schema = jsonb_set(schema, '{properties,shared,properties,coop}',
  $j${"description":"Co-op","default":{},"type":"object","properties":{"bossHpPerMate":{"default":0.6,"description":"Boss / Guardian / Umbra HP + per extra player","type":"number","minimum":0,"maximum":1},"goldPerKill":{"default":0.1,"description":"Not used any more (guests pick up shared Gold drops); kept so older versions stay valid","type":"number","minimum":0,"maximum":1},"heartShare":{"default":60,"description":"Shared drops: a heart also heals allies this close to the player who took it","type":"number","minimum":0,"maximum":600},"pickTime":{"default":10,"description":"Level-up / chest: seconds to choose before a pick is made for you (the room keeps playing)","type":"number","minimum":0,"maximum":600},"shieldR":{"default":40,"description":"Shield bubble radius while choosing (monsters are pushed out)","type":"number","minimum":0,"maximum":400},"shieldPush":{"default":220,"description":"Shield bubble push speed","type":"number","minimum":0,"maximum":2200},"shieldAfter":{"default":5,"description":"Shield stays this long after choosing (s): time to get moving again, still no damage","type":"number","minimum":0,"maximum":600},"reviveTime":{"default":3,"description":"Seconds standing next to a downed ally to revive them","type":"number","minimum":0,"maximum":600},"reviveRange":{"default":22,"description":"Ally revive distance","type":"number","minimum":0,"maximum":220},"reviveHp":{"default":0.3,"description":"HP after an ally revive","type":"number","minimum":0,"maximum":1},"voteTime":{"default":15,"description":"Route vote time (s); the host breaks ties","type":"number","minimum":0,"maximum":600},"clearWait":{"default":30,"description":"Stage-end: wait for everyone to be ready at most (s)","type":"number","minimum":0,"maximum":600},"hostLost":{"default":5,"description":"Guests leave when no snapshot arrives for this long (s)","type":"number","minimum":0,"maximum":600}}}$j$::jsonb)
where id = 1;
