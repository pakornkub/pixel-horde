-- Balance reports: a published Balance Config version may carry a report (why it was tuned, what the
-- playtests measured, a reason per changed value). Admin → Balance shows it for every version.
-- One report per version, written together with the version and never edited afterwards.
create table public.config_reports (
  version int primary key references public.balance_configs (version) on delete cascade,
  report jsonb not null check (jsonb_typeof(report) = 'object' and length(report::text) <= 200000),
  created_at timestamptz not null default now()
);
alter table public.config_reports enable row level security;
revoke all on public.config_reports from anon, authenticated;

create or replace function public.config_reports_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'CONFIG_REPORT_IMMUTABLE' using errcode = '42501';
end $$;
create trigger config_reports_no_edit before update on public.config_reports for each row execute function public.config_reports_immutable();

-- publish_config gains an optional report; the old two-argument form is replaced (not overloaded) so
-- RPC calls with or without p_report resolve to one function.
drop function if exists public.publish_config(jsonb, text);
create function public.publish_config(p_data jsonb, p_note text default '', p_report jsonb default null)
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
  return v;
end $$;
revoke all on function public.publish_config(jsonb, text, jsonb) from public, anon;
grant execute on function public.publish_config(jsonb, text, jsonb) to authenticated;

-- Admin version list: every version with its report (null when it has none).
create or replace function public.admin_configs()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('version', c.version, 'status', c.status, 'note', c.note, 'at', coalesce(c.published_at, c.created_at),
      'by', p.nickname, 'data', c.data, 'report', r.report) order by c.version desc)
    from public.balance_configs c left join public.profiles p on p.id = c.created_by
    left join public.config_reports r on r.version = c.version), '[]'::jsonb);
end $$;
