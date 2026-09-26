-- Work items (2026-09-27): what is being fixed and how far it got, shown in Admin → "งานแก้ไข".
-- A daily cloud routine (docs/agents/triage-routine.md) reads client_errors + feedback, fixes what it can
-- through a pull request and writes its progress here with agent_report(). Anything that needs the owner
-- (design, balance, a trade-off) becomes a `needs_decision` item with options; the owner answers in the
-- Admin Console (answer_work_item) and the next routine run carries it out.
-- agent_report is not callable by players or admins from the browser: only the database owner / service
-- role (the Supabase connector the routine uses).

create table if not exists public.work_items (
  id bigint generated always as identity primary key,
  kind text not null default 'bug' check (kind in ('bug', 'ux', 'balance', 'idea', 'infra', 'other')),
  source text not null default 'agent' check (source in ('error', 'feedback', 'owner', 'agent')),
  -- what it came from: [{"type":"feedback","id":1}, {"type":"error","fingerprint":"sqre4r"}]
  refs jsonb not null default '[]'::jsonb check (jsonb_typeof(refs) = 'array'),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null default '' check (char_length(summary) <= 4000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'needs_decision', 'pr_open', 'shipped', 'wontfix')),
  -- needs_decision: {"question": "...", "options": [{"key":"a","label":"...","detail":"..."}], "recommended": "a"}
  decision jsonb,
  -- the owner's answer: {"option":"a","note":"...","at":"...","by":"..."}
  answer jsonb,
  pr_url text check (pr_url is null or pr_url ~ '^https://github\.com/'),
  branch text,
  -- timeline: [{"at":"...","by":"agent|owner","status":"...","note":"..."}]
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_items_status_idx on public.work_items (status, updated_at desc);
alter table public.work_items enable row level security; -- no policies: RPCs only
revoke all on public.work_items from anon, authenticated;

/** Routine: create (no "id") or update (with "id") one work item; returns its id. Only given keys change.
 *  A status change or a "note" adds a timeline entry. Shipping marks the referenced feedback done. */
create or replace function public.agent_report(p jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  wid bigint := (p ->> 'id')::bigint;
  cur public.work_items;
  st text;
begin
  if wid is null then
    insert into public.work_items (kind, source, refs, title, summary, status, decision, pr_url, branch)
    values (coalesce(p ->> 'kind', 'bug'), coalesce(p ->> 'source', 'agent'), coalesce(p -> 'refs', '[]'::jsonb), p ->> 'title',
            coalesce(p ->> 'summary', ''), coalesce(p ->> 'status', 'todo'), p -> 'decision', p ->> 'pr_url', p ->> 'branch')
    returning * into cur;
  else
    select * into cur from public.work_items where id = wid for update;
    if not found then raise exception 'NO_SUCH_ITEM' using errcode = 'P0002'; end if;
    update public.work_items set
      kind = coalesce(p ->> 'kind', kind), refs = coalesce(p -> 'refs', refs), title = coalesce(p ->> 'title', title),
      summary = coalesce(p ->> 'summary', summary), status = coalesce(p ->> 'status', status),
      decision = case when p ? 'decision' then p -> 'decision' else decision end,
      answer = case when p ? 'answer' then p -> 'answer' else answer end,
      pr_url = coalesce(p ->> 'pr_url', pr_url), branch = coalesce(p ->> 'branch', branch), updated_at = now()
    where id = wid returning * into cur;
  end if;
  st := case when wid is null or p ? 'status' then cur.status end;
  if st is not null or p ? 'note' then
    update public.work_items set log = log || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'at', now(), 'by', 'agent', 'status', st, 'note', left(p ->> 'note', 1000))))
    where id = cur.id;
  end if;
  if cur.status = 'shipped' then
    update public.feedback f set status = 'done'
    where f.id in (select (r ->> 'id')::bigint from jsonb_array_elements(cur.refs) r where r ->> 'type' = 'feedback');
  end if;
  return cur.id;
end $$;
revoke all on function public.agent_report(jsonb) from public, anon, authenticated;

/** Admin: work items, open ones first (needs_decision on top), then newest. */
create or replace function public.admin_work_items(p_status text default '', p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'kind', w.kind, 'source', w.source, 'refs', w.refs, 'title', w.title,
      'summary', w.summary, 'status', w.status, 'decision', w.decision, 'answer', w.answer, 'prUrl', w.pr_url, 'branch', w.branch,
      'log', w.log, 'at', w.created_at, 'updated', w.updated_at)
      order by (w.status = 'needs_decision') desc, (w.status in ('shipped', 'wontfix')), w.updated_at desc)
    from (select * from public.work_items
          where coalesce(p_status, '') = '' or status = p_status
             or (p_status = 'open' and status not in ('shipped', 'wontfix'))
          order by updated_at desc limit least(greatest(p_limit, 1), 500)) w), '[]'::jsonb);
end $$;
revoke all on function public.admin_work_items(text, int) from public, anon;
grant execute on function public.admin_work_items(text, int) to authenticated;

/** Admin: answer a needs_decision item. It goes back to `todo` so the next routine run carries the choice out. */
create or replace function public.answer_work_item(p_id bigint, p_option text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_admin();
  who text := (select nickname from public.profiles where id = uid);
  w public.work_items;
begin
  select * into w from public.work_items where id = p_id for update;
  if not found then raise exception 'NO_SUCH_ITEM' using errcode = 'P0002'; end if;
  if w.status <> 'needs_decision' then raise exception 'NOT_WAITING' using errcode = '22023'; end if;
  if coalesce(p_option, '') = '' and btrim(coalesce(p_note, '')) = '' then raise exception 'EMPTY_ANSWER' using errcode = '22023'; end if;
  if coalesce(p_option, '') <> '' and not exists (select 1 from jsonb_array_elements(coalesce(w.decision -> 'options', '[]'::jsonb)) o where o ->> 'key' = p_option) then
    raise exception 'BAD_OPTION' using errcode = '22023';
  end if;
  update public.work_items set status = 'todo', updated_at = now(),
    answer = jsonb_build_object('option', nullif(p_option, ''), 'note', left(btrim(coalesce(p_note, '')), 1000), 'at', now(), 'by', who),
    log = log || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('at', now(), 'by', 'owner', 'status', 'todo',
      'note', 'ตอบ: ' || coalesce(nullif(p_option, ''), '-') || coalesce(nullif(' — ' || left(btrim(coalesce(p_note, '')), 200), ' — '), ''))))
  where id = p_id;
end $$;
revoke all on function public.answer_work_item(bigint, text, text) from public, anon;
grant execute on function public.answer_work_item(bigint, text, text) to authenticated;

/** Admin: close (shipped / wontfix) or reopen (todo) an item by hand, with an optional note. */
create or replace function public.set_work_item_status(p_id bigint, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if p_status not in ('todo', 'shipped', 'wontfix') then raise exception 'BAD_STATUS' using errcode = '22023'; end if;
  update public.work_items set status = p_status, updated_at = now(),
    log = log || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('at', now(), 'by', 'owner', 'status', p_status,
      'note', nullif(left(btrim(coalesce(p_note, '')), 1000), ''))))
  where id = p_id;
  if not found then raise exception 'NO_SUCH_ITEM' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.set_work_item_status(bigint, text, text) from public, anon;
grant execute on function public.set_work_item_status(bigint, text, text) to authenticated;
