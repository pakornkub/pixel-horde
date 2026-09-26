-- Player feedback (2026-09-26): a Feedback button on the title screen and in Settings.
-- Players send a category + a message (1–1000 characters); the game attaches a small context
-- (build, device, screen, language, and the Chapter / Hero when sent from a Run). Written only
-- through submit_feedback (at most 5 per account per Thai day); read and triaged in the Admin Console.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  category text not null check (category in ('bug', 'balance', 'idea', 'other')),
  message text not null check (char_length(message) between 1 and 1000),
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security; -- no policies: RPCs only

/** Send one feedback message. Returns the new id. */
create or replace function public.submit_feedback(p_category text, p_message text, p_context jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  msg text := btrim(coalesce(p_message, ''));
  ctx jsonb := '{}'::jsonb;
  k text;
  new_id bigint;
begin
  if p_category is null or p_category not in ('bug', 'balance', 'idea', 'other') then
    raise exception 'BAD_CATEGORY' using errcode = '22023';
  end if;
  if char_length(msg) < 1 or char_length(msg) > 1000 then
    raise exception 'BAD_MESSAGE' using errcode = '22023';
  end if;
  if (select count(*) from public.feedback f
      where f.user_id = uid and public.thai_day(f.created_at) = public.thai_day(now())) >= 5 then
    raise exception 'FEEDBACK_LIMIT' using errcode = 'P0001';
  end if;
  -- keep only known context keys, each a short scalar
  if jsonb_typeof(p_context) = 'object' then
    foreach k in array array['build', 'device', 'screen', 'lang', 'chapter', 'hero', 'realm', 'mode', 'phase', 'sentAt'] loop
      if jsonb_typeof(p_context -> k) in ('string', 'number', 'boolean') then
        ctx := ctx || jsonb_build_object(k, left(p_context ->> k, 200));
      end if;
    end loop;
  end if;
  insert into public.feedback (user_id, category, message, context) values (uid, p_category, msg, ctx)
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.submit_feedback(text, text, jsonb) from public, anon;
grant execute on function public.submit_feedback(text, text, jsonb) to authenticated;

/** Admin: newest first, optionally one status and/or one category. */
create or replace function public.admin_feedback(p_status text default '', p_category text default '', p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'userId', f.user_id, 'name', p.nickname, 'category', f.category,
      'message', f.message, 'context', f.context, 'status', f.status, 'at', f.created_at) order by f.created_at desc)
    from (select * from public.feedback
          where (coalesce(p_status, '') = '' or status = p_status) and (coalesce(p_category, '') = '' or category = p_category)
          order by created_at desc limit least(greatest(p_limit, 1), 500)) f
    left join public.profiles p on p.id = f.user_id), '[]'::jsonb);
end $$;
revoke all on function public.admin_feedback(text, text, int) from public, anon;
grant execute on function public.admin_feedback(text, text, int) to authenticated;

/** Admin: mark a message new / read / done. */
create or replace function public.set_feedback_status(p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if p_status not in ('new', 'read', 'done') then raise exception 'BAD_STATUS' using errcode = '22023'; end if;
  update public.feedback set status = p_status where id = p_id;
end $$;
revoke all on function public.set_feedback_status(bigint, text) from public, anon;
grant execute on function public.set_feedback_status(bigint, text) to authenticated;
