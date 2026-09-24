-- Ticket 08: Player Accounts (anonymous first), nicknames, one-place-at-a-time sessions.
-- Players never write tables directly: every write goes through a SECURITY DEFINER RPC.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 16),
  role text not null default 'player' check (role in ('player', 'admin')),
  name_hidden boolean not null default false,
  banned_until timestamptz,
  active_session_id uuid,
  shown_title text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
comment on table public.profiles is 'One row per Player Account. Written only by RPCs.';

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

-- ---------- nickname rules ----------
create or replace function public.nickname_normalize(nick text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(
    translate(lower(coalesce(nick, '')), '013457@$', 'oieastas'),
    '[^[:alnum:]ก-๙]', '', 'g')
$$;

create or replace function public.nickname_is_clean(nick text)
returns boolean language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from unnest(array['asshole', 'bastard', 'bitch', 'cunt', 'faggot', 'fck', 'fuck', 'fuk', 'nigga', 'nigger', 'penis', 'porn', 'pussy', 'retard', 'shit', 'slut', 'vagina', 'whore', 'กะหรี่', 'ควย', 'จัญไร', 'ชาติหมา', 'พ่อมึงตาย', 'ระยำ', 'สัตว์', 'สัส', 'ส้นตีน', 'อีดอก', 'อีเวร', 'เยด', 'เย็ด', 'เหี้ย', 'เหี้ยะ', 'แตด', 'แมงดา', 'แม่มึงตาย', 'ไอ้เวร']::text[]) as w
    where position(w in public.nickname_normalize(nick)) > 0
  )
$$;

create or replace function public.nickname_is_valid(nick text)
returns boolean language sql immutable set search_path = '' as $$
  select nick is not null
    and char_length(btrim(nick)) between 2 and 16
    and btrim(nick) ~ '^[[:alnum:]ก-๙ _.\-#]+$'
    and public.nickname_is_clean(nick)
$$;

create or replace function public.default_nickname()
returns text language sql volatile set search_path = '' as $$
  select 'Hero#' || lpad((floor(random() * 10000))::int::text, 4, '0')
$$;

-- ---------- profile creation on sign-up ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  wanted text := btrim(coalesce(new.raw_user_meta_data ->> 'nickname', ''));
begin
  insert into public.profiles (id, nickname)
  values (new.id, case when public.nickname_is_valid(wanted) then wanted else public.default_nickname() end)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- sessions: latest login wins ----------
-- The JWT carries `session_id`; claim_session() records it, gameplay RPCs call assert_session().
create or replace function public.jwt_session_id()
returns uuid language sql stable set search_path = '' as $$
  select nullif(coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'session_id', '')::uuid
$$;

create or replace function public.assert_session()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  active uuid;
begin
  if uid is null then
    raise exception 'NOT_SIGNED_IN' using errcode = '28000';
  end if;
  select p.active_session_id into active from public.profiles p where p.id = uid;
  if active is null or active is distinct from public.jwt_session_id() then
    raise exception 'SESSION_REPLACED' using errcode = 'P0001', hint = 'The account was opened on another device.';
  end if;
  return uid;
end $$;

create or replace function public.claim_session()
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.jwt_session_id();
  row public.profiles;
begin
  if uid is null or sid is null then
    raise exception 'NOT_SIGNED_IN' using errcode = '28000';
  end if;
  update public.profiles set active_session_id = sid, last_seen = now() where id = uid returning * into row;
  if row.id is null then
    raise exception 'NO_PROFILE' using errcode = 'P0002';
  end if;
  return row;
end $$;

-- Cheap check the client runs at Stage start and when the tab regains focus.
create or replace function public.check_session()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_session();
  update public.profiles set last_seen = now() where id = auth.uid();
  return true;
end $$;

create or replace function public.set_nickname(nick text)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  row public.profiles;
begin
  if not public.nickname_is_valid(nick) then
    raise exception 'NICKNAME_REJECTED' using errcode = '22023';
  end if;
  update public.profiles set nickname = btrim(nick) where id = uid returning * into row;
  return row;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.assert_session() from public, anon, authenticated;
revoke all on function public.claim_session() from public, anon;
revoke all on function public.check_session() from public, anon;
revoke all on function public.set_nickname(text) from public, anon;
grant execute on function public.claim_session() to authenticated;
grant execute on function public.check_session() to authenticated;
grant execute on function public.set_nickname(text) to authenticated;
grant execute on function public.nickname_is_valid(text) to anon, authenticated;
