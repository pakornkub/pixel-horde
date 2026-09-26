-- Changelog (patch notes): one entry per update, in words players understand, grouped by category.
-- Balance Config publishes always add one (publish_config writes it with the version); code releases
-- are written in Admin → บันทึกการอัปเดต. The website reads the public ones with get_changelog().
create table public.changelog (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('balance', 'feature', 'fix', 'content', 'system')),
  config_version int references public.balance_configs (version) on delete set null,
  title_th text not null check (length(title_th) between 1 and 120),
  title_en text not null default '' check (length(title_en) <= 120),
  -- [{cat, th, en}]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 80),
  note text not null default '' check (length(note) <= 4000),
  public boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index changelog_at on public.changelog (at desc);
alter table public.changelog enable row level security;
revoke all on public.changelog from anon, authenticated;
create trigger changelog_audit after insert or update or delete on public.changelog for each row execute function public.audit_trigger();

/** Items as stored: known categories, trimmed text, at most 300 characters each. */
create or replace function public.changelog_items(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'cat', case when i ->> 'cat' in ('hero', 'skill', 'boss', 'monster', 'event', 'difficulty', 'economy', 'coop', 'ui', 'system') then i ->> 'cat' else 'system' end,
      'th', left(btrim(coalesce(i ->> 'th', '')), 300),
      'en', left(btrim(coalesce(i ->> 'en', '')), 300)) order by n), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality as x(i, n)
  where btrim(coalesce(i ->> 'th', '')) <> '' and n <= 80
$$;

/** Website: public entries, newest first (no admin notes). */
create or replace function public.get_changelog(p_limit int default 100)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'at', c.at, 'kind', c.kind, 'configVersion', c.config_version,
      'titleTh', c.title_th, 'titleEn', c.title_en, 'items', c.items) order by c.at desc, c.id desc), '[]'::jsonb)
  from (select * from public.changelog where public order by at desc, id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) c
$$;

create or replace function public.admin_changelog()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'at', c.at, 'kind', c.kind, 'configVersion', c.config_version,
      'titleTh', c.title_th, 'titleEn', c.title_en, 'items', c.items, 'note', c.note, 'public', c.public) order by c.at desc, c.id desc)
    from public.changelog c), '[]'::jsonb);
end $$;

/** Admin: create (no id) or edit an entry. */
create or replace function public.upsert_changelog(p jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_admin();
  k text := coalesce(p ->> 'kind', 'feature');
  t text := btrim(coalesce(p ->> 'titleTh', ''));
  new_id bigint;
begin
  if k not in ('balance', 'feature', 'fix', 'content', 'system') then raise exception 'BAD_KIND' using errcode = '22023'; end if;
  if t = '' or length(t) > 120 then raise exception 'BAD_TITLE' using errcode = '22023'; end if;
  if p ? 'id' and (p ->> 'id') is not null then
    update public.changelog set
      at = coalesce((p ->> 'at')::timestamptz, at), kind = k, title_th = t, title_en = left(btrim(coalesce(p ->> 'titleEn', '')), 120),
      items = public.changelog_items(p -> 'items'), note = left(coalesce(p ->> 'note', ''), 4000),
      public = coalesce((p ->> 'public')::boolean, public), updated_at = now()
    where id = (p ->> 'id')::bigint returning id into new_id;
    if new_id is null then raise exception 'NO_SUCH_ENTRY' using errcode = 'P0002'; end if;
  else
    insert into public.changelog (at, kind, config_version, title_th, title_en, items, note, public, created_by)
    values (coalesce((p ->> 'at')::timestamptz, now()), k, (p ->> 'configVersion')::int, t, left(btrim(coalesce(p ->> 'titleEn', '')), 120),
            public.changelog_items(p -> 'items'), left(coalesce(p ->> 'note', ''), 4000), coalesce((p ->> 'public')::boolean, true), uid)
    returning id into new_id;
  end if;
  return new_id;
end $$;

create or replace function public.delete_changelog(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  delete from public.changelog where id = p_id;
end $$;

-- Every publish records what changed: with the Admin's entry (p_changelog) or a plain one.
drop function if exists public.publish_config(jsonb, text, jsonb);
create function public.publish_config(p_data jsonb, p_note text default '', p_report jsonb default null, p_changelog jsonb default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_admin();
  problems text[] := public.config_problems(p_data);
  v int;
begin
  if array_length(problems, 1) > 0 then
    raise exception 'CONFIG_INVALID: %', array_to_string(problems[1:10], '; ') using errcode = '22023';
  end if;
  if p_report is not null and (jsonb_typeof(p_report) <> 'object' or length(p_report::text) > 200000) then
    raise exception 'REPORT_INVALID' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v from public.balance_configs;
  insert into public.balance_configs (version, data, status, note, created_by, published_at)
  values (v, p_data || jsonb_build_object('version', v), 'published', coalesce(p_note, ''), uid, now());
  if p_report is not null then insert into public.config_reports (version, report) values (v, p_report); end if;
  insert into public.changelog (kind, config_version, title_th, title_en, items, note, created_by)
  values ('balance', v,
          left(coalesce(nullif(btrim(p_changelog ->> 'titleTh'), ''), 'ปรับสมดุลเกม (v' || v || ')'), 120),
          left(coalesce(nullif(btrim(p_changelog ->> 'titleEn'), ''), 'Balance update (v' || v || ')'), 120),
          public.changelog_items(p_changelog -> 'items'), left(coalesce(p_note, ''), 4000), uid);
  return v;
end $$;
revoke all on function public.publish_config(jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function public.publish_config(jsonb, text, jsonb, jsonb) to authenticated;
revoke all on function public.admin_changelog() from public, anon;
revoke all on function public.upsert_changelog(jsonb) from public, anon;
revoke all on function public.delete_changelog(bigint) from public, anon;
grant execute on function public.admin_changelog() to authenticated;
grant execute on function public.upsert_changelog(jsonb) to authenticated;
grant execute on function public.delete_changelog(bigint) to authenticated;
grant execute on function public.get_changelog(int) to anon, authenticated;
