-- Ticket 57: Mora, the 5th Hero (Necromancer), sold for Gold only after the account has won a Run.
-- 1. New Balance Config fields (shared.skills.{soulDrain,bonePrison,wailSkull,soulRise,boneSpear,soulfire,boneWard},
--    shared.heroes.necromancer, shared.levelup.wLink) patched into the live config_schema so publish_config accepts them. Their defaults keep
--    the other Heroes as they are: Mora's three Links reach them only when a config sets heroes.necromancer.pool 1.
-- 2. Achievement winMora (legend stays "the original four", owner decision 2026-09-27).
-- 3. Needs public.has_won(uid) from 20260930000036_weapon_forge. apply_run_facts counts Mora's wins; unlock_hero refuses her before a win and, until a published config carries
--    heroes.necromancer, reads her price from the schema default; import_legacy_meta never grants her.
update public.config_schema set schema = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(schema,
  '{properties,shared,properties,skills,properties,soulDrain}',
  $j${"description":"Soul Drain (Mora Link)","default":{},"type":"object","properties":{"max":{"default":6,"description":"Max level","type":"number","minimum":1,"maximum":20},"dmg":{"description":"Damage per tick","default":{},"type":"object","properties":{"base":{"default":8,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":5,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"cd":{"description":"Cooldown (s)","default":{},"type":"object","properties":{"base":{"default":3.2,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":-0.2,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"default":1.6,"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"n":{"description":"Tethers per cast","default":{},"type":"object","properties":{"base":{"default":2,"description":"Value at level offset","type":"number","minimum":0,"maximum":100},"every":{"default":2,"description":"Levels per +1","type":"number","minimum":1,"maximum":20},"offset":{"default":1,"description":"Level offset","type":"number","minimum":0,"maximum":20}}},"dur":{"description":"Tether lasts (s)","default":{},"type":"object","properties":{"base":{"default":2.6,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":0.25,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"range":{"default":110,"description":"Tether range","type":"number","minimum":0,"maximum":1100},"tick":{"default":0.25,"description":"Damage interval (s)","type":"number","minimum":0,"maximum":600},"heal":{"description":"HP healed when a tethered monster dies","default":{},"type":"object","properties":{"base":{"default":1,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":0.4,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"evo":{"description":"Changes applied when the skill evolves","default":{},"type":"object","properties":{"nAdd":{"default":2,"description":"Extra tethers","type":"number","minimum":0,"maximum":20},"dmgMul":{"default":1.3,"description":"Damage multiplier","type":"number","minimum":0,"maximum":10},"jumpR":{"default":60,"description":"A tether whose monster dies jumps to one this close","type":"number","minimum":0,"maximum":600}}}}}$j$::jsonb),
  '{properties,shared,properties,skills,properties,bonePrison}',
  $j${"description":"Bone Prison (Mora Link)","default":{},"type":"object","properties":{"max":{"default":6,"description":"Max level","type":"number","minimum":1,"maximum":20},"dmg":{"description":"Damage","default":{},"type":"object","properties":{"base":{"default":60,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":30,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"cd":{"description":"Cooldown (s)","default":{},"type":"object","properties":{"base":{"default":4.4,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":-0.35,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"default":2,"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"r":{"description":"Ring radius","default":{},"type":"object","properties":{"base":{"default":30,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":3.5,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"root":{"description":"Rooted (s); bosses are slowed","default":{},"type":"object","properties":{"base":{"default":1,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":0.15,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"delay":{"default":0.45,"description":"Warning before the spikes rise (s)","type":"number","minimum":0,"maximum":600},"pull":{"default":14,"description":"Pulls monsters this far toward the centre (Gathered)","type":"number","minimum":0,"maximum":140},"hold":{"default":2,"description":"Gathered (s)","type":"number","minimum":0,"maximum":600},"minTargets":{"default":3,"description":"Visible enemies needed","type":"number","minimum":1,"maximum":50},"evo":{"description":"Changes applied when the skill evolves","default":{},"type":"object","properties":{"n":{"default":2,"description":"Prisons per cast (each at its own crowd)","type":"number","minimum":1,"maximum":4},"dmgMul":{"default":1.3,"description":"Damage multiplier","type":"number","minimum":0,"maximum":10}}}}}$j$::jsonb),
  '{properties,shared,properties,skills,properties,wailSkull}',
  $j${"description":"Wailing Skulls (Mora Link)","default":{},"type":"object","properties":{"max":{"default":7,"description":"Max level","type":"number","minimum":1,"maximum":20},"dmg":{"description":"Damage","default":{},"type":"object","properties":{"base":{"default":18,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":9,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"cd":{"description":"Cooldown (s)","default":{},"type":"object","properties":{"base":{"default":1.2,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":-0.1,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"default":0.45,"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"n":{"description":"Skulls per cast","default":{},"type":"object","properties":{"base":{"default":2,"description":"Value at level offset","type":"number","minimum":0,"maximum":100},"every":{"default":2,"description":"Levels per +1","type":"number","minimum":1,"maximum":20},"offset":{"default":1,"description":"Level offset","type":"number","minimum":0,"maximum":20}}},"range":{"default":170,"description":"Targeting range","type":"number","minimum":0,"maximum":1700},"speed":{"default":150,"description":"Skull speed","type":"number","minimum":0,"maximum":1500},"turn":{"default":6,"description":"Homing turn speed (rad/s)","type":"number","minimum":0,"maximum":40},"life":{"default":2.5,"description":"Skull life (s)","type":"number","minimum":0,"maximum":600},"chill":{"default":1,"description":"Frost stacks per hit (3 = Frozen)","type":"number","minimum":0,"maximum":3},"kb":{"default":15,"description":"Knockback","type":"number","minimum":0,"maximum":150},"evo":{"description":"Changes applied when the skill evolves","default":{},"type":"object","properties":{"dmgMul":{"default":1.25,"description":"Damage multiplier","type":"number","minimum":0,"maximum":10},"splitN":{"default":2,"description":"Skulls a killing skull splits into","type":"number","minimum":1,"maximum":4}}}}}$j$::jsonb),
  '{properties,shared,properties,skills,properties,soulRise}',
  $j${"description":"Mora: Soul Rise","default":{},"type":"object","properties":{"max":{"default":7,"description":"Max level","type":"number","minimum":1,"maximum":20},"dmg":{"description":"Skeleton swing damage","default":{},"type":"object","properties":{"base":{"default":12,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":7,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"cd":{"description":"Raise every (s)","default":{},"type":"object","properties":{"base":{"default":3,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":-0.2,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"default":1.4,"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"army":{"description":"Skeletons standing at most (rounded down)","default":{},"type":"object","properties":{"base":{"default":3,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":0.5,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"life":{"default":8,"description":"A Skeleton crumbles after (s)","type":"number","minimum":0,"maximum":600},"spd":{"default":55,"description":"Skeleton walk speed","type":"number","minimum":0,"maximum":550},"reach":{"default":12,"description":"Swing reach","type":"number","minimum":0,"maximum":120},"hitCd":{"default":0.6,"description":"Swing every (s)","type":"number","minimum":0,"maximum":600},"leash":{"default":90,"description":"Skeletons never chase farther than this from Mora","type":"number","minimum":0,"maximum":900},"grave":{"default":100,"description":"A kill this close to Mora leaves a grave a Skeleton can rise from","type":"number","minimum":0,"maximum":1000},"kb":{"default":25,"description":"Knockback","type":"number","minimum":0,"maximum":250},"cap":{"default":12,"description":"Hard cap on Skeletons (performance)","type":"number","minimum":1,"maximum":40},"evo":{"description":"Changes applied when the skill evolves","default":{},"type":"object","properties":{"n":{"default":2,"description":"Skeletons per raise","type":"number","minimum":1,"maximum":4},"maxAdd":{"default":3,"description":"Extra Skeletons standing","type":"number","minimum":0,"maximum":30},"burstMul":{"default":1.5,"description":"A crumbling Skeleton bursts for × its damage","type":"number","minimum":0,"maximum":10},"burstR":{"default":22,"description":"Burst radius","type":"number","minimum":0,"maximum":220}}},"awk":{"description":"Lich (Awakened, awaken.form 1): Frost Wraiths; Bone Spear aims at their latest freeze","default":{},"type":"object","properties":{"spdMul":{"default":1.4,"description":"Frost Wraith speed ×","type":"number","minimum":0,"maximum":10},"dmgMul":{"default":1.3,"description":"Frost Wraith damage ×","type":"number","minimum":0,"maximum":10},"chill":{"default":1,"description":"Frost stacks per Wraith swing (3 = Frozen)","type":"number","minimum":0,"maximum":3}}}}}$j$::jsonb),
  '{properties,shared,properties,skills,properties,boneSpear}',
  $j${"description":"Mora line: Bone Spear","default":{},"type":"object","properties":{"max":{"default":8,"description":"Max level","type":"number","minimum":1,"maximum":20},"dmg":{"description":"Damage","default":{},"type":"object","properties":{"base":{"default":90,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":40,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"cd":{"description":"Cooldown (s)","default":{},"type":"object","properties":{"base":{"default":2,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":-0.12,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"default":0.9,"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"n":{"description":"Spears per cast (rounded down)","default":{},"type":"object","properties":{"base":{"default":2,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":0.34,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"range":{"default":220,"description":"Range","type":"number","minimum":0,"maximum":2200},"speed":{"default":260,"description":"Spear speed","type":"number","minimum":0,"maximum":2600},"life":{"default":0.9,"description":"Spear life (s)","type":"number","minimum":0,"maximum":600},"spread":{"default":0.18,"description":"Fan spread (rad)","type":"number","minimum":0,"maximum":3},"kb":{"default":30,"description":"Knockback","type":"number","minimum":0,"maximum":300}}}$j$::jsonb),
  '{properties,shared,properties,skills,properties,soulfire}',
  $j${"description":"Mora line: Soulfire","default":{},"type":"object","properties":{"max":{"default":8,"description":"Max level","type":"number","minimum":1,"maximum":20},"dmg":{"description":"Damage per flare","default":{},"type":"object","properties":{"base":{"default":50,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":24,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"cd":{"description":"Cooldown (s)","default":{},"type":"object","properties":{"base":{"default":2.2,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":-0.12,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"default":1,"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"n":{"description":"Flares per cast (rounded down)","default":{},"type":"object","properties":{"base":{"default":3,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":0.5,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"r":{"description":"Flare radius","default":{},"type":"object","properties":{"base":{"default":18,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":2,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"delay":{"default":0.25,"description":"Flare rise time (s)","type":"number","minimum":0,"maximum":600},"fresh":{"default":3,"description":"Flares on graves at most this old (s)","type":"number","minimum":0,"maximum":600},"kb":{"default":20,"description":"Knockback","type":"number","minimum":0,"maximum":200}}}$j$::jsonb),
  '{properties,shared,properties,skills,properties,boneWard}',
  $j${"description":"Mora line (survival): Bone Ward","default":{},"type":"object","properties":{"max":{"default":8,"description":"Max level","type":"number","minimum":1,"maximum":20},"cd":{"description":"At most once every (s)","default":{},"type":"object","properties":{"base":{"default":8,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":-0.6,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"default":3,"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"r":{"default":50,"description":"A Skeleton this close to Mora takes the hit instead","type":"number","minimum":0,"maximum":500}}}$j$::jsonb),
  '{properties,shared,properties,heroes,properties,necromancer}',
  $j${"description":"Mora","default":{},"type":"object","properties":{"cost":{"default":2000,"description":"Unlock price (offered only after the account has won a Run)","type":"number","minimum":0,"maximum":20000},"minion":{"default":0.25,"description":"Minion damage bonus (Skeletons, Companion, Shadow Clone)","type":"number","minimum":0,"maximum":1},"hp":{"default":0,"description":"Max HP penalty","type":"number","minimum":0,"maximum":200},"pool":{"default":0,"description":"Her three Links (Soul Drain, Bone Prison, Wailing Skulls) are offered to every Hero (1) or only to Mora (0)","type":"number","minimum":0,"maximum":1}}}$j$::jsonb),
  '{properties,shared,properties,levelup,properties,wLink}',
  $j${"default":1,"description":"Weight × for the Hero's own Links (new or upgrade)","type":"number","minimum":0,"maximum":10}$j$::jsonb)
where id = 1;

update public.achievements set sort = sort + 1 where sort >= 11;
insert into public.achievements (id, grp, title, sort) values ('winMora', 'heroes', null, 11);

create or replace function public.apply_run_facts(uid uuid, f jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  st jsonb;
  won jsonb;
  combos jsonb := '{}'::jsonb;
  best jsonb;
  k text;
  n numeric;
  cnt int;
  victory boolean := coalesce((f ->> 'victory')::boolean, false);
  a record;
  ok boolean;
begin
  if f is null or jsonb_typeof(f) <> 'object' then return; end if;
  select stats into st from public.meta_progress where user_id = uid;
  st := coalesce(st, '{}'::jsonb);
  -- lifetime: heroes won
  won := coalesce(st -> 'heroesWon', '[]'::jsonb);
  if victory and not (won ? (f ->> 'hero')) and (f ->> 'hero') in ('mage', 'knight', 'ranger', 'alchemist', 'necromancer') then won := won || to_jsonb(f ->> 'hero'); end if;
  -- lifetime: Combos by kind (each Run adds at most 100k per kind)
  combos := coalesce(st -> 'combos', '{}'::jsonb);
  for k, n in select key, least(greatest(value::numeric, 0), 100000) from jsonb_each_text(coalesce(f -> 'combos', '{}'::jsonb)) loop
    if k in ('shatter', 'firestorm', 'overload', 'superconduct', 'toxicBurst', 'grinder', 'catalyst') then
      combos := jsonb_set(combos, array[k], to_jsonb(coalesce((combos ->> k)::numeric, 0) + n));
    end if;
  end loop;
  -- bestiary: kills per monster type
  best := coalesce(st -> 'bestiary', '{}'::jsonb);
  for k, n in select key, least(greatest(value::numeric, 0), 100000) from jsonb_each_text(coalesce(f -> 'killsByType', '{}'::jsonb)) loop
    if k ~ '^[a-zA-Z]{2,24}$' then best := jsonb_set(best, array[k], to_jsonb(coalesce((best ->> k)::numeric, 0) + n)); end if;
  end loop;
  update public.meta_progress set stats = st || jsonb_build_object('heroesWon', won, 'combos', combos, 'bestiary', best), updated_at = now()
  where user_id = uid;
  select count(*) into cnt from jsonb_object_keys(coalesce(f -> 'combos', '{}'::jsonb)) x where coalesce((f -> 'combos' ->> x)::numeric, 0) > 0;
  -- achievements (same rules as ACHIEVEMENTS in packages/sim/src/data/achievements.ts)
  for a in select * from public.achievements where id not in (select achievement_id from public.player_achievements where user_id = uid) loop
    ok := case a.id
      when 'firstKing' then coalesce((f ->> 'kingsKilled')::int, 0) >= 1
      when 'chapter4' then coalesce((f ->> 'chapter')::int, 0) >= 4
      when 'crater' then coalesce((f ->> 'chapter')::int, 0) >= 8
      when 'heartKeeper' then victory
      when 'kingslayer' then victory and coalesce((f ->> 'escapes')::int, 0) = 0
      when 'endless12' then coalesce((f ->> 'endlessChapter')::int, 0) >= 12
      when 'winLyra' then victory and f ->> 'hero' = 'mage'
      when 'winBram' then victory and f ->> 'hero' = 'knight'
      when 'winKit' then victory and f ->> 'hero' = 'ranger'
      when 'winVex' then victory and f ->> 'hero' = 'alchemist'
      when 'winMora' then victory and f ->> 'hero' = 'necromancer'
      when 'legend' then won ?& array['mage', 'knight', 'ranger', 'alchemist']
      when 'awakened' then coalesce((f ->> 'awakened')::boolean, false)
      when 'firstCombo' then cnt >= 1
      when 'allCombos' then cnt >= 7
      when 'combos100' then (select coalesce(sum(value::numeric), 0) from jsonb_each_text(coalesce(f -> 'combos', '{}'::jsonb))) >= 100
      when 'iceBreaker' then coalesce((combos ->> 'shatter')::numeric, 0) >= 1000
      when 'overload200' then coalesce((combos ->> 'overload')::numeric, 0) >= 200
      when 'firestorm200' then coalesce((combos ->> 'firestorm')::numeric, 0) >= 200
      when 'firstGuardian' then jsonb_array_length(coalesce(f -> 'guardians', '[]'::jsonb)) >= 1
      when 'frostTamed' then coalesce(f -> 'guardians', '[]'::jsonb) ? 'frost'
      when 'stormTamed' then coalesce(f -> 'guardians', '[]'::jsonb) ? 'storm'
      when 'allGuardians' then jsonb_array_length(coalesce(f -> 'guardians', '[]'::jsonb)) >= 3
      when 'dragonTamer' then coalesce((f ->> 'fused')::boolean, false)
      when 'companion5' then coalesce((f ->> 'companionMax')::int, 0) >= 5
      when 'crack1' then victory and coalesce((f ->> 'crack')::int, 0) >= 1
      when 'crack3' then victory and coalesce((f ->> 'crack')::int, 0) >= 3
      when 'swift' then victory and coalesce((f ->> 'victoryTime')::int, 0) between 1 and 899
      when 'noRevive' then victory and coalesce((f ->> 'revivesBought')::int, 0) = 0
      when 'streak500' then coalesce((f ->> 'maxStreak')::int, 0) >= 500
      when 'doubleKing' then coalesce((f ->> 'doubleKings')::int, 0) >= 1
      else false end;
    if ok then
      insert into public.player_achievements (user_id, achievement_id) values (uid, a.id) on conflict do nothing;
      if a.title is not null then
        insert into public.player_titles (user_id, title, source) values (uid, a.title, 'achievement') on conflict do nothing;
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.apply_run_facts(uuid, jsonb) from public, anon, authenticated;

/** Heroes sold only after a win (Mora). */
create or replace function public.hero_needs_win(p_hero text)
returns boolean language sql immutable set search_path = '' as $$ select p_hero in ('necromancer') $$;

create or replace function public.unlock_hero(p_hero text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  v int := public.current_config_version();
  m public.meta_progress := public.ensure_meta(uid);
  -- a Hero added after the live config was published: its price comes from the schema default
  cost numeric := coalesce(public.cfg_num(v, 'heroes', p_hero, 'cost'),
    (select (c.schema #>> array['properties', 'shared', 'properties', 'heroes', 'properties', p_hero, 'properties', 'cost', 'default'])::numeric
     from public.config_schema c where c.id = 1));
begin
  if cost is null then raise exception 'UNKNOWN_HERO' using errcode = '22023'; end if;
  if p_hero = any (m.heroes) then return public.meta_json(m); end if;
  if public.hero_needs_win(p_hero) and not public.has_won(uid) then -- shared check (20260930000036_weapon_forge) raise exception 'NEEDS_WIN' using errcode = '22023'; end if;
  if m.gold < cost then raise exception 'NOT_ENOUGH_GOLD' using errcode = '22023'; end if;
  update public.meta_progress set gold = gold - cost::bigint, heroes = array_append(heroes, p_hero), updated_at = now()
  where user_id = uid returning * into m;
  return public.meta_json(m);
end $$;

/** One-time upload of the old `pixelhorde-meta` save, clamped to sane limits and tagged. */
create or replace function public.import_legacy_meta(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  v int := public.current_config_version();
  m public.meta_progress := public.ensure_meta(uid);
  item text;
  lvl int;
  new_shop jsonb := m.shop;
  new_heroes text[] := m.heroes;
  h text;
begin
  if m.legacy_imported then return public.meta_json(m); end if;
  for item in select jsonb_object_keys(coalesce(p -> 'up', '{}'::jsonb)) loop
    if public.cfg_num(v, 'shop', item, 'max') is not null then
      lvl := least(greatest(coalesce((p -> 'up' ->> item)::int, 0), 0), public.cfg_num(v, 'shop', item, 'max')::int);
      if lvl > coalesce((new_shop ->> item)::int, 0) then new_shop := new_shop || jsonb_build_object(item, lvl); end if;
    end if;
  end loop;
  for h in select jsonb_array_elements_text(coalesce(p -> 'owned', '[]'::jsonb)) loop
    if public.cfg_num(v, 'heroes', h, 'cost') is not null and not public.hero_needs_win(h) and not (h = any (new_heroes)) then new_heroes := array_append(new_heroes, h); end if;
  end loop;
  update public.meta_progress set
    gold = gold + least(greatest(coalesce((p ->> 'gold')::bigint, 0), 0), public.cfg_num(v, 'antiCheat', 'legacyGoldCap')::bigint),
    shop = new_shop, heroes = new_heroes, legacy_imported = true,
    stats = stats || jsonb_build_object('legacy', jsonb_build_object('importedAt', now(), 'raw', p)),
    updated_at = now()
  where user_id = uid returning * into m;
  return public.meta_json(m);
end $$;

revoke all on function public.hero_needs_win(text) from public, anon, authenticated;
