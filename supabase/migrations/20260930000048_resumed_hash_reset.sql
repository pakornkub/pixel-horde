-- O2 follow-up to the unlimited-resume change (20260930000047_unlimited_resume.sql): runs.resumed_hash
-- was set by resume_run and then never cleared. Scenario: resume online at Chapter 3 (resumed_hash =
-- H3), keep playing to Chapter 4 (a Stage-start auto-save sets checkpoint_hash = H4, resumed_hash is
-- untouched and stays H3), lose the connection, "Save and quit", then Continue offline from H4. Submit
-- then sends resumedHash = H4, which is distinct from the still-stale r.resumed_hash (H3), so
-- submit_run's stale-checkpoint check wrongly rejected a perfectly legitimate Run.
--
-- Fix: save_checkpoint clears resumed_hash back to null whenever the checkpoint it is about to save
-- has a different hash than the one last resumed. From then on submit_run's check falls through to
-- comparing against checkpoint_hash (the current, authoritative checkpoint) instead of a stale
-- resumed_hash from before the player kept playing - still rejecting any hash that doesn't match
-- either the just-resumed checkpoint or the current one.

/** Save the checkpoint of the current Stage start (auto-save); p_quit = "save and quit". A checkpoint
 *  that moves past the last resumed one drops the stale resumed_hash marker (see migration header). */
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
    suspended_at = case when coalesce((p ->> 'quit')::boolean, false) then now() else r.suspended_at end,
    resumed_hash = case when (p ->> 'hash') is distinct from r.resumed_hash then null else r.resumed_hash end
  where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.save_checkpoint(jsonb) from public, anon;
grant execute on function public.save_checkpoint(jsonb) to authenticated;
