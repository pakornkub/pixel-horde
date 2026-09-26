-- Co-op Run checks. Co-op Runs were rejected for honest play:
--  * TOO_FAST: a player who joins (or rejoins) a room mid-Run gets a fresh start_run time, but the Chapter comes from
--    the host. The client now sends the Chapter it joined at ('joinChapter'); the Chapters before it are credited
--    their minimum time, for the time check and the kill ceiling (the team kill counter includes them).
--  * Kill / Gold ceilings: the kill counter and the Gold are the team's. The client sends the most players it saw in
--    the room ('team', 1–4); new Balance Config fields shared.antiCheat.coopKillsPerMate / coopGoldPerMate scale the
--    ceilings by (1 + field × other players). Defaults 0 = no change; published versions without them read 0.
-- Solo and offline Runs are checked exactly as before.

update public.config_schema set schema = jsonb_set(jsonb_set(schema,
  '{properties,shared,properties,antiCheat,properties,coopKillsPerMate}',
  $j${"default":0,"description":"Co-op: kill ceiling × (1 + this × each other player in the room); the team kill counter is shared","type":"number","minimum":0,"maximum":3}$j$::jsonb),
  '{properties,shared,properties,antiCheat,properties,coopGoldPerMate}',
  $j${"default":0,"description":"Co-op: Gold ceiling × (1 + this × each other player in the room)","type":"number","minimum":0,"maximum":3}$j$::jsonb)
where id = 1;

drop function if exists public.run_problem(int, int, int, int, numeric);

/** Checks shared by online and offline submissions. Returns a reject reason or null.
 *  Co-op: p_join = the Chapter this player joined at, p_team = most players seen in the room (clamped to 1–4). */
create or replace function public.run_problem(v int, chapter int, kills int, gold int, play_seconds numeric,
                                              p_mode text default 'solo', p_join int default 1, p_team int default 1)
returns text language sql stable security definer set search_path = '' as $$
  with k as (
    select coop,
      -- Chapters before joining count as played at their minimum time (a join outside 1..chapter counts as 1)
      play_seconds + case when coop and p_join between 1 and chapter then public.min_seconds_to_reach(v, p_join) else 0 end as secs,
      1 + case when coop then coalesce(public.cfg_num(v, 'antiCheat', 'coopKillsPerMate'), 0) * team else 0 end as kmul,
      1 + case when coop then coalesce(public.cfg_num(v, 'antiCheat', 'coopGoldPerMate'), 0) * team else 0 end as gmul
    from (select p_mode = 'coop' as coop, least(greatest(coalesce(p_team, 1), 1), 4) - 1 as team) m -- 4 = room size (packages/coop MAX_PLAYERS)
  )
  select case
    when chapter is null or chapter < 1 or chapter > 999 then 'BAD_CHAPTER'
    when kills is null or kills < 0 or gold is null or gold < 0 then 'BAD_NUMBERS'
    when k.secs < public.min_seconds_to_reach(v, chapter) then 'TOO_FAST'
    when gold > public.gold_ceiling(v, chapter) * k.gmul then 'GOLD_CEILING'
    when kills > (public.cfg_num(v, 'antiCheat', 'killsPerSecond') * greatest(k.secs, 0) + public.cfg_num(v, 'antiCheat', 'killsPerChapter') * chapter) * k.kmul then 'KILL_CEILING'
    else null end
  from k
$$;
revoke all on function public.run_problem(int, int, int, int, numeric, text, int, int) from public, anon, authenticated;

create or replace function public.submit_run(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  r public.runs;
  secs numeric;
  problem text;
  g int := coalesce((p ->> 'gold')::int, 0);
  m public.meta_progress;
begin
  select * into r from public.runs where id = (p ->> 'runId')::uuid and user_id = uid for update;
  if r.id is null or r.token is distinct from (p ->> 'token')::uuid then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if r.status <> 'started' then
    raise exception 'RUN_ALREADY_SUBMITTED' using errcode = '23505';
  end if;
  perform public.check_submit_rate(uid, r.config_version);
  -- time suspended between sessions never counts as play time
  secs := extract(epoch from (now() - r.started_at)) - greatest(coalesce((p ->> 'pausedMs')::numeric, 0), 0) / 1000 - r.suspended_ms / 1000.0;
  problem := public.run_problem(r.config_version, (p ->> 'chapter')::int, (p ->> 'kills')::int, g, secs,
                                r.mode, coalesce((p ->> 'joinChapter')::int, 1), coalesce((p ->> 'team')::int, 1));
  -- a Run continued from a checkpoint must name the one the server knows (copied or stale saves fail)
  if problem is null and p ? 'resumedHash' and (p ->> 'resumedHash') is not null
     and (p ->> 'resumedHash') is distinct from coalesce(r.resumed_hash, r.checkpoint_hash) then
    problem := 'STALE_CHECKPOINT';
  end if;
  update public.runs set
    ended_at = now(), paused_ms = greatest(coalesce((p ->> 'pausedMs')::bigint, 0), 0),
    result = coalesce(p ->> 'result', 'dead'), chapter = (p ->> 'chapter')::int, kills = (p ->> 'kills')::int,
    level = (p ->> 'level')::int, gold_earned = g, score = (p ->> 'score')::bigint,
    endless_score = greatest(coalesce((p ->> 'endlessScore')::bigint, 0), 0),
    victory = coalesce((p ->> 'victory')::boolean, false),
    crack = least(greatest(coalesce((p ->> 'crack')::int, 0), 0), 3),
    summary = coalesce(p -> 'summary', '{}'::jsonb),
    status = case when problem is null then 'submitted' else 'rejected' end,
    reject_reason = problem
  where id = r.id;
  m := public.ensure_meta(uid);
  if problem is null and g > 0 then
    update public.meta_progress set gold = gold + g, updated_at = now() where user_id = uid returning * into m;
  end if;
  if problem is null then m := public.add_found_weapons(uid, r.world, p -> 'weaponsFound'); end if;
  -- achievements, lifetime totals and the bestiary (ticket 32)
  if problem is null then
    perform public.apply_run_facts(uid, p -> 'facts');
    select * into m from public.meta_progress where user_id = uid;
  end if;
  -- beating Umbra unlocks the next Heart Crack tier (1–3), only above the tier the Run used
  if problem is null and coalesce((p ->> 'victory')::boolean, false) then
    update public.meta_progress
      set stats = jsonb_set(stats, '{heartCrack}', to_jsonb(least(3, greatest(coalesce((stats ->> 'heartCrack')::int, 0),
                  least(greatest(coalesce((p ->> 'crack')::int, 0), 0), 3) + 1)))), updated_at = now()
    where user_id = uid returning * into m;
  end if;
  -- Gold the Run took from the wallet (Stage-end swaps etc.) is always charged, never below zero.
  if coalesce((p ->> 'walletSpent')::int, 0) > 0 then
    update public.meta_progress set gold = greatest(0, gold - (p ->> 'walletSpent')::int), updated_at = now() where user_id = uid returning * into m;
  end if;
  if problem is null then
    perform public.record_leaderboard(r.id);
  end if;
  return jsonb_build_object('status', case when problem is null then 'submitted' else 'rejected' end, 'reason', problem, 'meta', public.meta_json(m));
end $$;
