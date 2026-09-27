-- Ticket 51: outfits, gear sets with stats sold in the special shop after the first win (owner, 2026-09-27).
--  * New Balance Config group shared.outfits (levels, prices, piece stats, set bonus), added to the live config_schema.
--    Published versions without it read the built-in defaults (outfit_num).
--  * Piece levels live in meta_progress.shop under "outfit:<set>:<slot>" keys: get_meta returns them, merge_accounts keeps
--    the higher level per key, buy_upgrade refuses them. Which pieces are worn is the player's local choice.
--  * buy_outfit is the only writer: first win required (has_won, 0036), server-side prices from the config.

update public.config_schema set schema = jsonb_set(schema,
  '{properties,shared,properties,outfits}',
  $j${"description":"Outfits (special shop, after the first win)","default":{},"type":"object","properties":{"max":{"default":5,"description":"Outfits: levels per piece","type":"number","minimum":0,"maximum":20},"base":{"default":500,"description":"Outfits: price of a piece (its first level, Gold)","type":"number","minimum":0,"maximum":5000},"growth":{"default":1.6,"description":"Outfits: price × per level","type":"number","minimum":0,"maximum":10},"hatDmg":{"default":0.02,"description":"Outfit hat: damage + per level","type":"number","minimum":0,"maximum":0.5},"bodyHp":{"default":8,"description":"Outfit body: max HP + per level","type":"number","minimum":0,"maximum":100},"cloakCrit":{"default":0.01,"description":"Outfit cloak: crit chance + per level (still capped)","type":"number","minimum":0,"maximum":0.2},"setBase":{"default":0.05,"description":"Full outfit set: damage + against its monsters (Burning / Frozen or chilled / Shocked / bosses)","type":"number","minimum":0,"maximum":2},"setPerLv":{"default":0.04,"description":"Full outfit set: bonus + per level of its lowest piece","type":"number","minimum":0,"maximum":0.5}}}$j$::jsonb)
where id = 1;

/** A shared.outfits number; versions published before outfits existed read the built-in default. */
create or replace function public.outfit_num(v int, field text)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(public.cfg_num(v, 'outfits', field), case field when 'max' then 5 when 'base' then 500 when 'growth' then 1.6 end)
$$;

/** Price of the next level of an outfit piece (level 0 → 1 buys it); same as outfitCost in packages/sim. */
create or replace function public.outfit_cost(v int, level int)
returns bigint language sql stable security definer set search_path = '' as $$
  select round(public.outfit_num(v, 'base') * power(public.outfit_num(v, 'growth'), level))::bigint
$$;

/** Buy an outfit piece or raise its level. Refused before the first win. */
create or replace function public.buy_outfit(p_set text, p_slot text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  v int := public.current_config_version();
  m public.meta_progress := public.ensure_meta(uid);
  k text;
  lv int;
  cost bigint;
begin
  -- the sets and slots of packages/sim/src/data/outfits.ts
  if p_set is null or p_slot is null or p_set not in ('ember', 'frost', 'storm', 'shadow') or p_slot not in ('hat', 'body', 'cloak') then
    raise exception 'UNKNOWN_ITEM' using errcode = '22023';
  end if;
  if not public.has_won(uid) then
    raise exception 'SHOP_LOCKED' using errcode = '22023';
  end if;
  k := 'outfit:' || p_set || ':' || p_slot;
  lv := coalesce((m.shop ->> k)::int, 0);
  if lv >= public.outfit_num(v, 'max') then
    raise exception 'MAXED' using errcode = '22023';
  end if;
  cost := public.outfit_cost(v, lv);
  if m.gold < cost then
    raise exception 'NOT_ENOUGH_GOLD' using errcode = '22023';
  end if;
  update public.meta_progress set gold = gold - cost, shop = shop || jsonb_build_object(k, lv + 1), updated_at = now()
  where user_id = uid returning * into m;
  return public.meta_json(m);
end $$;

revoke all on function public.buy_outfit(text, text) from public, anon;
grant execute on function public.buy_outfit(text, text) to authenticated;
revoke all on function public.outfit_num(int, text) from public, anon, authenticated;
revoke all on function public.outfit_cost(int, int) from public, anon, authenticated;
