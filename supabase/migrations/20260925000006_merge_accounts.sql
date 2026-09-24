-- Ticket 11: linking Google and merging an anonymous account into an existing Google account.
-- Flow: the anonymous session creates a one-time merge ticket, tries linkIdentity(google);
-- on `identity_already_exists` it signs in with that Google account and calls merge_accounts(ticket).

create table public.merge_tickets (
  token uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  used_at timestamptz
);
alter table public.merge_tickets enable row level security;
revoke all on public.merge_tickets from anon, authenticated;

create or replace function public.create_merge_ticket()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  t uuid;
begin
  delete from public.merge_tickets where from_user = uid;
  insert into public.merge_tickets (from_user) values (uid) returning token into t;
  return t;
end $$;

/**
 * Merge the ticket's account into the caller: unlocks united, higher Shop levels, the HIGHER Gold
 * (never the sum), best leaderboard rows kept, Run history moved; the old account is deleted.
 */
create or replace function public.merge_accounts(p_ticket uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  into_user uuid := auth.uid();
  src uuid;
  a public.meta_progress;
  b public.meta_progress;
  merged_shop jsonb := '{}'::jsonb;
  k text;
begin
  if into_user is null then raise exception 'NOT_SIGNED_IN' using errcode = '28000'; end if;
  select from_user into src from public.merge_tickets
  where token = p_ticket and used_at is null and expires_at > now() for update;
  if src is null then raise exception 'MERGE_TICKET_INVALID' using errcode = '22023'; end if;
  if src = into_user then raise exception 'MERGE_SAME_ACCOUNT' using errcode = '22023'; end if;
  update public.merge_tickets set used_at = now() where token = p_ticket;

  a := public.ensure_meta(into_user);
  b := public.ensure_meta(src);
  for k in select distinct key from (select jsonb_object_keys(a.shop) as key union select jsonb_object_keys(b.shop)) keys loop
    merged_shop := merged_shop || jsonb_build_object(k, greatest(coalesce((a.shop ->> k)::int, 0), coalesce((b.shop ->> k)::int, 0)));
  end loop;
  update public.meta_progress set
    gold = greatest(a.gold, b.gold),
    shop = merged_shop,
    heroes = (select array_agg(distinct h order by h) from unnest(a.heroes || b.heroes) h),
    weapons = (select coalesce(array_agg(distinct w order by w), '{}') from unnest(a.weapons || b.weapons) w),
    heirloom_weapon = coalesce(a.heirloom_weapon, b.heirloom_weapon),
    legacy_imported = a.legacy_imported or b.legacy_imported,
    stats = b.stats || a.stats || jsonb_build_object('mergedFrom', src, 'mergedAt', now()),
    updated_at = now()
  where user_id = into_user;

  -- leaderboard: keep the better row per board
  insert into public.leaderboard (world, season_id, board, user_id, best_run_id, score, chapter, hero, weapon, verified, hidden, achieved_at)
  select world, season_id, board, into_user, best_run_id, score, chapter, hero, weapon, verified, hidden, achieved_at
  from public.leaderboard where user_id = src
  on conflict (world, season_id, board, user_id) do update
    set best_run_id = excluded.best_run_id, score = excluded.score, chapter = excluded.chapter, hero = excluded.hero,
        weapon = excluded.weapon, verified = excluded.verified, achieved_at = excluded.achieved_at
    where excluded.score > public.leaderboard.score
       or (excluded.score = public.leaderboard.score and excluded.achieved_at < public.leaderboard.achieved_at);
  delete from public.leaderboard where user_id = src;

  update public.runs set user_id = into_user where user_id = src;
  insert into public.player_days (user_id, day, config_version, first_at)
  select into_user, day, config_version, first_at from public.player_days where user_id = src
  on conflict (user_id, day) do nothing;

  delete from auth.users where id = src;  -- cascades profile, meta, remaining rows
  return public.meta_json((select m from public.meta_progress m where m.user_id = into_user));
end $$;

revoke all on function public.create_merge_ticket() from public, anon;
revoke all on function public.merge_accounts(uuid) from public, anon;
grant execute on function public.create_merge_ticket() to authenticated;
grant execute on function public.merge_accounts(uuid) to authenticated;
