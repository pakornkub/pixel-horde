-- Ticket 56: the special shop (opens after the first win) and its Weapon forge (ticket 49, simple version).
--  * New Balance Config group shared.forge (levels, price, effect per level per Weapon), patched into the live
--    config_schema so publish_config accepts it. Published versions without it read the built-in defaults (forge_num).
--  * Forge levels live in meta_progress.shop under "forge:<world>:<weapon>" keys: get_meta already returns them,
--    merge_accounts keeps the higher level per key, and buy_upgrade refuses them (no shop.<key>.max in the config).
--    The client reads only its SHOP_IDS from shop, so they never show up as permanent-shop upgrades.
--  * has_won(uid): the shared "has beaten Umbra at least once" check (also used by the 5th Hero, ticket 57).

update public.config_schema set schema = jsonb_set(schema,
  '{properties,shared,properties,forge}',
  $j${"description":"Weapon forge (special shop, after the first win)","default":{},"type":"object","properties":{"max":{"default":5,"description":"Forge: levels per Weapon","type":"number","minimum":0,"maximum":20},"base":{"default":400,"description":"Forge: price of the first level (Gold)","type":"number","minimum":0,"maximum":4000},"growth":{"default":1.6,"description":"Forge: price × per level","type":"number","minimum":0,"maximum":10},"judgement":{"default":0.2,"description":"Forge Judgement: monsters that survive the strike are stunned (s per level; bosses never)","type":"number","minimum":0,"maximum":2},"thornwhip":{"default":0.15,"description":"Forge Thornwhip: root time + per level","type":"number","minimum":0,"maximum":1},"sunblade":{"default":0.15,"description":"Forge Sunblade: Burning time + per level","type":"number","minimum":0,"maximum":1},"boneScythe":{"default":0.15,"description":"Forge Bone Scythe: reap threshold + per level","type":"number","minimum":0,"maximum":1},"glacierLance":{"default":0.15,"description":"Forge Glacier Lance: freeze time + per level","type":"number","minimum":0,"maximum":1},"magmaMaul":{"default":0.15,"description":"Forge Magma Maul: knockback + per level","type":"number","minimum":0,"maximum":1},"plagueCenser":{"default":0.15,"description":"Forge Plague Censer: poison damage + per level","type":"number","minimum":0,"maximum":1},"stormBow":{"default":0.15,"description":"Forge Storm Bow: Shocked time + per level","type":"number","minimum":0,"maximum":1},"coralTrident":{"default":0.15,"description":"Forge Coral Trident: push + per level","type":"number","minimum":0,"maximum":1},"gearCannon":{"default":0.15,"description":"Forge Gear Cannon: turret time + per level","type":"number","minimum":0,"maximum":1},"lichTome":{"default":0.15,"description":"Forge Lich Tome: healing (and its limit) + per level","type":"number","minimum":0,"maximum":1}}}$j$::jsonb)
where id = 1;

/**
 * The player has beaten Umbra at least once: Heart Crack tier 1 is unlocked (every win unlocks the next tier) or a
 * Hero is in stats.heroesWon. Server-side gates only (special shop, Heroes sold after the first win).
 */
create or replace function public.has_won(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select coalesce((m.stats ->> 'heartCrack')::int, 0) >= 1
                       or jsonb_array_length(case when jsonb_typeof(m.stats -> 'heroesWon') = 'array' then m.stats -> 'heroesWon' else '[]'::jsonb end) > 0
                   from public.meta_progress m where m.user_id = uid), false)
$$;

/** A shared.forge number; versions published before the forge existed read the built-in default. */
create or replace function public.forge_num(v int, field text)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(public.cfg_num(v, 'forge', field), case field when 'max' then 5 when 'base' then 400 when 'growth' then 1.6 end)
$$;

/** Price of the next forge level (same as forgeCost in packages/sim). */
create or replace function public.forge_cost(v int, level int)
returns bigint language sql stable security definer set search_path = '' as $$
  select round(public.forge_num(v, 'base') * power(public.forge_num(v, 'growth'), level))::bigint
$$;

/** Next forge level of an owned Weapon (Judgement is always owned). Refused before the first win. */
create or replace function public.forge_weapon(p_weapon text, p_world text default 'lumora')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  v int := public.current_config_version();
  m public.meta_progress := public.ensure_meta(uid);
  k text;
  lv int;
  cost bigint;
begin
  if p_weapon is null or p_weapon !~ '^[a-zA-Z]{2,24}$' or p_world is null or p_world !~ '^[a-z]{2,24}$' then
    raise exception 'UNKNOWN_ITEM' using errcode = '22023';
  end if;
  if not public.has_won(uid) then
    raise exception 'SHOP_LOCKED' using errcode = '22023';
  end if;
  if p_weapon <> 'judgement' and not ((p_world || ':' || p_weapon) = any (m.weapons)) then
    raise exception 'WEAPON_LOCKED' using errcode = '22023';
  end if;
  k := 'forge:' || p_world || ':' || p_weapon;
  lv := coalesce((m.shop ->> k)::int, 0);
  if lv >= public.forge_num(v, 'max') then
    raise exception 'MAXED' using errcode = '22023';
  end if;
  cost := public.forge_cost(v, lv);
  if m.gold < cost then
    raise exception 'NOT_ENOUGH_GOLD' using errcode = '22023';
  end if;
  update public.meta_progress set gold = gold - cost, shop = shop || jsonb_build_object(k, lv + 1), updated_at = now()
  where user_id = uid returning * into m;
  return public.meta_json(m);
end $$;

revoke all on function public.forge_weapon(text, text) from public, anon;
grant execute on function public.forge_weapon(text, text) to authenticated;
revoke all on function public.has_won(uuid) from public, anon, authenticated;
revoke all on function public.forge_num(int, text) from public, anon, authenticated;
revoke all on function public.forge_cost(int, int) from public, anon, authenticated;
