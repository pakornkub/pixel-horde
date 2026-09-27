-- Ticket 59: the title's Endless button (ticket 55) is gated on the first win in the client only. A title Endless Run is
-- submitted as a solo Run with score 0 plus endlessScore, and record_leaderboard puts that on the Endless board, so an
-- edited save could rank Endless scores without ever beating Umbra. submit_run now keeps the Endless Score only when the
-- player has won before (has_won, 0036) or when this Run itself beat Umbra (victory, not started as title Endless).
-- The client marks a title Endless Run with p.endlessStart = true (also after a Continue). Otherwise the Run is
-- unchanged: Gold, Weapons, facts and the main Score still count, only endless_score is stored as 0.
-- submit_run is 0033's (co-op run_problem args, crack_max clamps) with only the Endless check added.
create or replace function public.submit_run(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  r public.runs;
  secs numeric;
  problem text;
  g int := coalesce((p ->> 'gold')::int, 0);
  m public.meta_progress;
  endless_ok boolean;
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
  -- Endless counts after an earlier win, or after beating Umbra in this very Run (never for a title Endless Run);
  -- checked before this Run's own victory is credited below
  endless_ok := public.has_won(uid)
                or (coalesce((p ->> 'victory')::boolean, false) and not coalesce((p ->> 'endlessStart')::boolean, false));
  update public.runs set
    ended_at = now(), paused_ms = greatest(coalesce((p ->> 'pausedMs')::bigint, 0), 0),
    result = coalesce(p ->> 'result', 'dead'), chapter = (p ->> 'chapter')::int, kills = (p ->> 'kills')::int,
    level = (p ->> 'level')::int, gold_earned = g, score = (p ->> 'score')::bigint,
    endless_score = case when endless_ok then greatest(coalesce((p ->> 'endlessScore')::bigint, 0), 0) else 0 end,
    victory = coalesce((p ->> 'victory')::boolean, false),
    crack = least(greatest(coalesce((p ->> 'crack')::int, 0), 0), public.crack_max(r.config_version)),
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
  -- beating Umbra unlocks the next Heart Crack tier (up to heartCrack.maxTier), only above the tier the Run used
  if problem is null and coalesce((p ->> 'victory')::boolean, false) then
    update public.meta_progress
      set stats = jsonb_set(stats, '{heartCrack}', to_jsonb(least(public.crack_max(r.config_version), greatest(coalesce((stats ->> 'heartCrack')::int, 0),
                  least(greatest(coalesce((p ->> 'crack')::int, 0), 0), public.crack_max(r.config_version)) + 1)))), updated_at = now()
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
