-- Ticket 44: tutorial hints are shown once per account. The seen list lives in meta_progress.stats.tips
-- (returned by get_meta); "first" marks that the account finished its first Run (the easier Greenvale).
create or replace function public.set_tips(p_tips text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  clean text[];
begin
  perform public.ensure_meta(uid);
  select coalesce(array_agg(distinct x order by x), '{}') into clean
  from unnest(coalesce(p_tips, '{}')) as x
  where x ~ '^[a-zA-Z0-9_]{1,32}$';
  if cardinality(clean) > 64 then clean := clean[1:64]; end if;
  update public.meta_progress set stats = stats || jsonb_build_object('tips', to_jsonb(clean)) where user_id = uid;
  return to_jsonb(clean);
end $$;

revoke all on function public.set_tips(text[]) from public, anon;
grant execute on function public.set_tips(text[]) to authenticated;
