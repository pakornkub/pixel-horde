-- Ticket 31: suspend and resume a Run. One Stage-start checkpoint per Run, stored with its hash;
-- resuming consumes it (single use). Suspended time is excluded from the play-time check and a
-- Run that began in an earlier Season finishes unranked (see submit_run / record_leaderboard).

/** Save the checkpoint of the current Stage start (auto-save); p_quit = "save and quit". */
create or replace function public.save_checkpoint(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  r public.runs;
begin
  select * into r from public.runs where id = (p ->> 'runId')::uuid and user_id = uid for update;
  if r.id is null or r.token is distinct from (p ->> 'token')::uuid then raise exception 'RUN_NOT_FOUND' using errcode = 'P0002'; end if;
  if r.status not in ('started', 'suspended') then raise exception 'RUN_ALREADY_SUBMITTED' using errcode = '23505'; end if;
  if r.mode not in ('solo', 'endless') then raise exception 'NOT_ALLOWED' using errcode = '22023'; end if;
  -- a checkpoint that was continued from is used up: saving it again would allow Stage retries
  if (p ->> 'hash') = r.resumed_hash then raise exception 'CHECKPOINT_USED' using errcode = '22023'; end if;
  if length(coalesce(p ->> 'data', '')) > 200000 or coalesce(p ->> 'hash', '') !~ '^[0-9a-f]{8,64}$' then
    raise exception 'BAD_CHECKPOINT' using errcode = '22023';
  end if;
  update public.runs set
    checkpoint = p ->> 'data', checkpoint_hash = p ->> 'hash', checkpoint_chapter = (p ->> 'chapter')::int,
    checkpoint_config = coalesce((p ->> 'configVersion')::int, r.config_version), checkpoint_at = now(),
    status = case when coalesce((p ->> 'quit')::boolean, false) then 'suspended' else r.status end,
    suspended_at = case when coalesce((p ->> 'quit')::boolean, false) then now() else r.suspended_at end
  where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

/** The account's saved Run (any device), if younger than 30 days. */
create or replace function public.get_checkpoint()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  r public.runs;
begin
  select * into r from public.runs
  where user_id = uid and checkpoint is not null and status in ('started', 'suspended') and checkpoint_at > now() - interval '30 days'
  order by checkpoint_at desc limit 1;
  if r.id is null then return null; end if;
  return jsonb_build_object('runId', r.id, 'token', r.token, 'seed', r.seed, 'hero', r.hero, 'weapon', r.weapon, 'chapter', r.checkpoint_chapter,
    'configVersion', r.checkpoint_config, 'hash', r.checkpoint_hash, 'data', r.checkpoint, 'savedAt', r.checkpoint_at,
    'seasonChanged', r.season_id is distinct from public.active_season(r.world));
end $$;

/** Continue from the saved checkpoint: must be the latest one; it is consumed. */
create or replace function public.resume_run(p_run uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  r public.runs;
begin
  select * into r from public.runs where id = p_run and user_id = uid for update;
  if r.id is null then raise exception 'RUN_NOT_FOUND' using errcode = 'P0002'; end if;
  if r.checkpoint is null or r.status not in ('started', 'suspended') then raise exception 'NO_CHECKPOINT' using errcode = 'P0002'; end if;
  if r.checkpoint_hash is distinct from p_hash then raise exception 'STALE_CHECKPOINT' using errcode = '22023'; end if;
  update public.runs set
    status = 'started', checkpoint = null, resumed_hash = p_hash,
    suspended_ms = suspended_ms + case when r.suspended_at is not null then (extract(epoch from (now() - r.suspended_at)) * 1000)::bigint else 0 end,
    suspended_at = null
  where id = r.id;
  return jsonb_build_object('ok', true, 'seasonChanged', r.season_id is distinct from public.active_season(r.world));
end $$;

revoke all on function public.save_checkpoint(jsonb) from public, anon;
revoke all on function public.get_checkpoint() from public, anon;
revoke all on function public.resume_run(uuid, text) from public, anon;
grant execute on function public.save_checkpoint(jsonb) to authenticated;
grant execute on function public.get_checkpoint() to authenticated;
grant execute on function public.resume_run(uuid, text) to authenticated;
