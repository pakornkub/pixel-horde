-- Ticket 31 follow-up: a Chapter's checkpoint can be resumed any number of times (owner decision
-- 2026-09-28). Resuming used to null out the checkpoint server-side ("single use"): a disconnect
-- right after a resume, before the Chapter cleared, left no valid checkpoint anywhere and the
-- whole Run was unrecoverable. A resume never restores in-Chapter EXP/Gold (it always restarts the
-- Chapter from its Stage-start state), so repeating it costs the player nothing extra; the only
-- thing this removes is the ability to keep re-rolling one Chapter's outcome by quitting right
-- before a bad result. The Stage still replays under the checkpoint's own locked config and seed,
-- and a fresh checkpoint from the next Stage naturally supersedes the old one.

/** Continue from the saved checkpoint: must be the latest one. Resuming no longer consumes it -
 *  it stays valid (and keeps being offered) until superseded by the next Stage's checkpoint. */
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
    status = 'started', resumed_hash = p_hash,
    suspended_ms = suspended_ms + case when r.suspended_at is not null then (extract(epoch from (now() - r.suspended_at)) * 1000)::bigint else 0 end,
    suspended_at = null
  where id = r.id;
  return jsonb_build_object('ok', true, 'seasonChanged', r.season_id is distinct from public.active_season(r.world));
end $$;

/** Save the checkpoint of the current Stage start (auto-save); p_quit = "save and quit". Re-saving
 *  the checkpoint you most recently resumed from is now an intended flow, not blocked. */
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

revoke all on function public.resume_run(uuid, text) from public, anon;
revoke all on function public.save_checkpoint(jsonb) from public, anon;
grant execute on function public.resume_run(uuid, text) to authenticated;
grant execute on function public.save_checkpoint(jsonb) to authenticated;
