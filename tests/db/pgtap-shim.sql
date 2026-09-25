-- A tiny subset of pgTAP so supabase/tests/*.test.sql also run inside PGlite (CI).
-- On Supabase the real pgTAP extension is used via `supabase test db`.
create table public._tap (n int not null default 0, planned int);
insert into public._tap values (0, null);
grant all on public._tap to public;

create function public._tap_rec(pass boolean, descr text) returns text language plpgsql as $$
declare k int;
begin
  update public._tap set n = n + 1 returning n into k;
  return case when pass then 'ok ' else 'not ok ' end || k || ' - ' || coalesce(descr, '');
end $$;
create function public.plan(k int) returns text language sql as $$ update public._tap set planned = k; select '1..' || k $$;
create function public.ok(pass boolean, descr text default '') returns text language sql as $$ select public._tap_rec(coalesce(pass, false), descr) $$;
create function public."is"(have anyelement, want anyelement, descr text default '') returns text language sql as $$
  select public._tap_rec(have is not distinct from want, descr || case when have is distinct from want then ' (have ' || coalesce(have::text, 'NULL') || ', want ' || coalesce(want::text, 'NULL') || ')' else '' end)
$$;
create function public.isnt(have anyelement, want anyelement, descr text default '') returns text language sql as $$
  select public._tap_rec(have is distinct from want, descr)
$$;
create function public.throws_ok(q text, e text, descr text default '') returns text language plpgsql as $$
begin
  execute q;
  return public._tap_rec(false, descr || ' (no exception)');
exception when others then
  return public._tap_rec(sqlstate = e or sqlerrm = e, descr || case when sqlstate = e or sqlerrm = e then '' else ' (got ' || sqlstate || ': ' || sqlerrm || ')' end);
end $$;
create function public.lives_ok(q text, descr text default '') returns text language plpgsql as $$
begin
  execute q;
  return public._tap_rec(true, descr);
exception when others then
  return public._tap_rec(false, descr || ' (' || sqlstate || ': ' || sqlerrm || ')');
end $$;
create function public.finish() returns text language sql as $$
  select case when planned is null or planned = n then 'ok - finished ' || n
              else 'not ok - planned ' || planned || ' but ran ' || n end from public._tap
$$;
