-- Ticket 09: server-counted meta progression, Runs and anti-cheat tier 0.
-- Also creates balance_configs (ticket 13 adds publishing); version 0 = the built-in defaults.

create table public.balance_configs (
  version int primary key,
  data jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.balance_configs enable row level security;
revoke all on public.balance_configs from anon, authenticated;
grant select on public.balance_configs to anon, authenticated;
create policy balance_configs_read_published on public.balance_configs
  for select to anon, authenticated using (status = 'published');

-- The built-in defaults (packages/config DEFAULT_CONFIG). A test keeps this in sync.
insert into public.balance_configs (version, data, status, note, published_at)
values (0, $cfg${"version":0,"shared":{"maxAttackSlots":4,"passiveSlots":3,"bench":{"start":1,"growAt1":2,"growAt2":4,"swapBase":20,"swapGrowth":2},"stage":{"durBase":60,"durPerStage":20,"durMax":150,"bossAt":0.55,"bossHpGrowth":1.25,"clearHeal":0.4,"clearDelay":1.5,"reviveHp":0.5,"chapters":8,"overtime":45,"enrageSpd":1.3,"enrageDmg":1.3,"overtimeSpawn":1.5,"escapeRepicks":1,"kingGold":50,"umbraEscapeHp":0.15,"bloodMoonRevealAt":0.1},"spawn":{"base":1.4,"prog":3.4,"stageGrowth":0.35,"perMate":0.6,"cap":320,"eliteChance":0.012,"swarmFirst":16,"swarmEvery":18,"swarmEveryBloodMoon":10,"swarmBase":16,"swarmPerStage":6,"swarmCap":340,"edge":14,"ringEdge":10,"despawn":0.95},"scaling":{"hpGrowth":1.5,"hpProg":0.7,"hpPerLv":0.08,"hpDirBase":0.85,"hpDirK":0.15,"dmgGrowth":1.18,"dmgProg":0.5,"dmgPerLv":0.015,"spdPerStage":0.04,"spdJitter":0.1,"eliteHp":7,"eliteSpd":0.85,"eliteDmg":1.6,"eliteXp":6,"eliteR":2,"armorFrom":3,"armorChance":0.03,"armorChancePerStage":0.015,"armorBase":10,"armorGrowth":1.4,"armorPerLv":0.05,"hitVariance":0.15,"wobble":0.5},"director":{"start":1,"min":0.7,"max":2.4,"rise":0.06,"riseHp":0.75,"riseCalm":6,"drop":0.2,"dropHp":0.4,"hurtDrop":0.03,"hurtWindow":2},"player":{"hp":100,"spd":62,"pick":26,"crit":0.08,"critMul":2,"critCap":0.5,"cdCap":0.4,"inv":0.6,"contact":5,"dmgVariance":0.12,"kb":40,"kbBoss":0.1,"kbElite":0.4,"kbDecay":0.02},"xp":{"base":5,"perLv":4,"quad":0.5,"lateFrom":8,"lateQuad":1.4},"levelup":{"offers":3,"wUpgrade":1.3,"wNew":1.1,"wPassive":0.8,"wSignature":1.25},"ult":{"max":80,"perKill":1,"perElite":5,"perBoss":40,"dmgBase":160,"dmgPerLv":45,"dmgGrowth":1.45,"slow":0.55,"delay":0.3,"kb":120},"streak":{"window":2.2},"loot":{"coinChance":0.08,"coin":1,"eliteCoin":5,"bossCoin":50,"heartChance":0.012,"heartSmall":0.3,"heartBig":0.5,"chestGold":20,"gemCap":380,"bossGems":14,"eventGems":10,"magnetAccel":400,"magnetMax":320},"shop":{"costGrowth":1.6,"power":{"max":10,"base":30,"per":0.08},"vigor":{"max":10,"base":25,"per":15},"speed":{"max":5,"base":40,"per":0.04},"greed":{"max":5,"base":50,"per":0.15},"wisdom":{"max":5,"base":50,"per":0.1},"revive":{"max":1,"base":400}},"heroes":{"mage":{"cost":0,"dmg":0.1},"knight":{"cost":0,"hp":40,"spd":0.05},"ranger":{"cost":500,"spd":0.12,"pick":0.3},"alchemist":{"cost":1000,"cd":0.08,"status":0.2}},"secondWind":{"hp":0.5,"inv":2.5,"r":110,"dmg":150,"dmgGrowth":1.45},"chest":{"p1":0.5,"p2":0.35},"events":{"bloodMoonFrom":2,"bloodMoonChance":0.1,"bloodMoonPity":0.06,"bloodMoonSpawn":2.3,"bloodMoonCoin":2,"dragonFrom":3,"dragonChance":0.25,"dragonPity":0.15,"dragonWarnAt":0.33,"dragonAt":0.42,"rivalChance":0.25,"rivalAt":0.25,"lastChapter":7},"dragon":{"hp":6000,"hpGrowth":1.5,"firstCd":2,"cdMin":1.8,"cdMax":2.6,"breathR":100,"breathArc":0.5,"breathWarn":0.75,"breathDur":0.7,"breathDmg":0.45,"dashLen":190,"dashWarn":0.65,"dashTime":0.5,"dashSpeed":320,"dashDmg":1.6,"rainCount":6,"rainR":18,"rainWarn":0.9,"rainDmg":1.1,"whelps":4,"whelpCap":6,"gold":100},"status":{"frostStacks":3,"frozen":1.5,"gatherLinger":1,"burning":3,"shocked":2,"poisoned":4},"combos":{"cooldown":1,"shatter":2.5,"shatterShards":0.3,"shatterR":28,"firestormR":40,"firestorm":0.5,"overload":1.5,"overloadR":30,"superconduct":5,"toxicBurst":2,"toxicBurstR":35,"grinder":1.5,"catalyst":1.5},"realms":{"resist":0.5,"armorMul":2,"armorFrom":2,"fastSpd":1.1},"awaken":{"links":2,"stages":1,"sigDmg":1.3},"kings":{"firstCd":1.6,"cdMin":2.4,"cdMax":3.4,"phaseAt":0.5,"ultCd":10,"ultFirst":1.5,"ultWarn":1.2,"overtimeUltMul":0.5,"umbraUltDmg":0.7,"slam":{"warn":0.9,"r":26,"dmg":1.2},"split":{"n":4,"warn":0.7,"r":40},"splash":{"r":140,"dur":1.1,"land":36,"dmg":1.6},"sandLine":{"len":240,"w":12,"warn":0.8,"dmg":1.2},"burrow":{"warn":1,"r":30,"dmg":1.4},"quicksand":{"r":120,"core":20,"dur":3,"pull":34,"dmg":0.6,"coins":6,"coinR":16,"coinDmg":1},"boneFan":{"n":5,"spread":0.22,"len":170,"warn":0.6,"dmg":0.9},"raise":{"n":5,"r":70,"warn":0.9},"crypt":{"r":62,"n":14,"gap":2,"spotR":12,"dmg":1.2,"centerR":50,"centerDelay":0.7,"centerDmg":2},"iceSpears":{"n":3,"spread":0.3,"len":220,"warn":0.7,"dmg":1.1},"iceFloor":{"r":70,"warn":0.8,"dur":5,"slip":2.5},"throne":{"spots":3,"spotR":24,"spread":80,"dmg":2.2,"chill":1.5,"chillSpd":0.5}},"rival":{"hp":1400,"hpGrowth":1.5,"life":35,"skills":3,"gold":40,"cloneChance":0.35,"shards":3,"keepFar":90,"keepNear":60,"slow":0.6,"frozen":0.3,"lvEvery":2,"bolt":{"cd":1.9,"cdPerLv":0.1,"cdMin":0.9,"speed":110,"dmg":0.6,"spread":0.25},"lance":{"cd":3.2,"cdPerLv":0.15,"cdMin":1.6,"len":220,"warn":0.5,"dmg":1,"speed":260},"nova":{"cd":4,"cdPerLv":0.2,"cdMin":2,"range":110,"r":80,"rPerLv":8,"dur":0.7},"meteor":{"cd":4.6,"cdPerLv":0.2,"cdMin":2.6,"r":16,"warn":1,"dmg":1.2},"zap":{"cd":3,"cdPerLv":0.15,"cdMin":1.4,"r":10,"warn":0.5,"dmg":0.9}},"caster":{"far":130,"near":90,"strafe":0.6,"fireRange":210,"firstMin":1,"firstMax":2.5,"cdMin":2.3,"cdMax":3,"projSpeed":95,"projLife":2.6,"slow":0.5},"charger":{"range":150,"warn":0.6,"dash":0.5,"speed":230,"dmgMul":1.5,"firstMin":1.5,"firstMax":3,"cdMin":2.5,"cdMax":3.5,"slow":0.5},"splitter":{"minis":3,"spread":10,"push":80},"pet":{"breathCd":1.3,"breathCdPerLv":0.1,"breathCdMin":0.6,"breathRange":100,"breathR":70,"breathRPerLv":6,"breathDmg":25,"breathDmgPerLv":8,"dive":5,"divePerLv":0.4,"diveMin":2.5,"diveDmg":120,"diveDmgPerLv":25,"diveR":26,"perPetLv":0.4},"clone":{"dmg":0.35,"dmgPerLv":0.08,"dmgMax":0.6},"score":{"chapter":1000,"king":500,"kill":1,"combo":5,"victory":20000,"fastBase":1500,"fastMul":10,"escape":3000,"revivePenalty":0.15},"antiCheat":{"minTimeFactor":0.9,"goldBase":1500,"goldGrowth":1.35,"killsPerSecond":15,"killsPerChapter":500,"maxSubmitsPerHour":30,"minSecondsBetweenStarts":5,"legacyGoldCap":50000},"skills":{"bolt":{"max":8,"dmg":{"base":16,"perLv":7},"cd":{"base":0.85,"perLv":-0.07,"min":0.25},"n":{"base":1,"every":2,"offset":1},"pierce":{"base":0,"every":3,"offset":0},"range":200,"speed":200,"life":1.1,"kb":35,"evo":{"nAdd":2,"cdMul":0.7,"pierceAdd":1,"dmgMul":1.2}},"orbit":{"max":6,"dmg":{"base":10,"perLv":6},"n":{"base":1,"perLv":1,"max":6},"r":{"base":30,"perLv":2},"spd":{"base":3,"perLv":0.35},"hitCd":0.32,"kb":55,"evo":{"nSet":8,"rMul":1.3,"dmgMul":1.4,"spdMul":1.2}},"chain":{"max":7,"dmg":{"base":28,"perLv":14},"cd":{"base":2.4,"perLv":-0.18,"min":0.9},"jumps":{"base":3,"perLv":2},"range":150,"jumpRange":75,"kb":25,"evo":{"jumpsMul":1.6,"dmgMul":1.5}},"nova":{"max":7,"dmg":{"base":30,"perLv":16},"cd":{"base":3.4,"perLv":-0.25,"min":1.2},"r":{"base":55,"perLv":10},"dur":0.38,"kb":90,"evo":{"dmgMul":1.6,"rMul":1.35,"cdMul":0.75}},"meteor":{"max":7,"dmg":{"base":80,"perLv":40},"cd":{"base":4.2,"perLv":-0.3,"min":1.6},"n":{"base":2,"perLv":1},"r":{"base":20,"perLv":2},"delay":0.55,"stagger":0.11,"kb":70,"evo":{"nMul":1.6,"rMul":1.35,"dmgMul":1.3}},"frost":{"max":6,"dmg":{"base":6,"perLv":5},"r":{"base":32,"perLv":6},"tick":0.4,"slow":0.5,"kb":6,"evo":{"dmgMul":1.6,"rMul":1.3}},"lance":{"max":7,"dmg":{"base":40,"perLv":18},"cd":{"base":1.7,"perLv":-0.13,"min":0.6},"n":{"base":1,"every":3,"offset":0},"range":220,"speed":280,"life":0.9,"spread":0.22,"kb":20,"evo":{"nAdd":2,"dmgMul":1.5}},"boomer":{"max":7,"dmg":{"base":22,"perLv":10},"cd":{"base":2,"perLv":-0.15,"min":0.8},"n":{"base":1,"every":2,"offset":1},"range":{"base":80,"perLv":6},"target":180,"speed":170,"kb":30,"evo":{"nMul":2,"dmgMul":1.35}},"cyclone":{"max":6,"dmg":{"base":12,"perLv":6},"cd":{"base":5,"perLv":-0.35,"min":2.2},"n":{"base":1,"every":2,"offset":0},"r":{"base":16,"perLv":2},"dur":{"base":2.4,"perLv":0.3},"speed":48,"tick":0.25,"pull":55,"evo":{"rMul":1.4,"nAdd":1,"dmgMul":1.3}},"toxic":{"max":6,"dmg":{"base":8,"perLv":5},"cd":{"base":3.6,"perLv":-0.3,"min":1.5},"n":{"base":1,"every":2,"offset":0},"r":{"base":16,"perLv":2},"dur":{"base":3,"perLv":0.4},"tick":0.3,"evo":{"rMul":1.35,"dmgMul":1.6}},"laser":{"max":6,"dmg":{"base":45,"perLv":20},"cd":{"base":6,"perLv":-0.5,"min":2.6},"len":{"base":100,"perLv":12},"dur":0.9,"width":0.12,"kb":50,"evo":{"dmgMul":1.35}},"hole":{"max":5,"dmg":{"base":6,"perLv":3},"boom":{"base":140,"perLv":70},"cd":{"base":9,"perLv":-0.8,"min":4.5},"r":{"base":45,"perLv":6},"dur":1.9,"tick":0.2,"pull":150,"minTargets":3,"kb":140,"evo":{"boomMul":2,"rMul":1.2}},"sigil":{"max":7,"dmg":{"base":9,"perLv":5},"cd":{"base":3.2,"perLv":-0.2,"min":1.6},"r":{"base":34,"perLv":4},"dur":{"base":2.6,"perLv":0.2},"tick":0.35,"evo":{"rMul":1.35,"n":2}},"shield":{"max":6,"dmg":{"base":8,"perLv":5},"n":{"base":1,"perLv":0.4,"min":1,"max":3},"r":{"base":24,"perLv":1.5},"spd":{"base":2.2,"perLv":0.2},"hitCd":0.4,"kb":90,"block":7,"evo":{"n":3,"heal":3,"absorb":0.15}},"hawk":{"max":7,"dmg":{"base":34,"perLv":16},"cd":{"base":2.2,"perLv":-0.14,"min":0.9},"range":230,"flight":0.35,"kb":40,"evo":{"n":2,"stun":0.8}},"flask":{"max":7,"dmg":{"base":22,"perLv":11},"cd":{"base":2.6,"perLv":-0.16,"min":1.1},"r":{"base":22,"perLv":2},"flight":0.45,"range":190,"evo":{"n":2,"dmgMul":1.2}},"manaNova":{"max":8,"dmg":{"base":26,"perLv":13},"cd":{"base":1.6,"perLv":-0.08,"min":0.8},"r":{"base":60,"perLv":6},"dur":0.5,"kb":50},"timeWarp":{"max":8,"r":{"base":70,"perLv":8},"dmg":{"base":4,"perLv":3},"tick":0.5},"starfall":{"max":8,"dmg":{"base":90,"perLv":42},"cd":{"base":3.6,"perLv":-0.22,"min":1.4},"n":{"base":3,"perLv":1},"r":{"base":22,"perLv":2},"delay":0.6,"stagger":0.08,"kb":60},"sacredBlades":{"max":8,"dmg":{"base":60,"perLv":26},"cd":{"base":1.4,"perLv":-0.07,"min":0.7},"r":{"base":70,"perLv":6},"arc":0.9,"dur":0.25,"kb":90},"judgePillar":{"max":8,"dmg":{"base":220,"perLv":110},"cd":{"base":4,"perLv":-0.25,"min":1.8},"r":18,"delay":0.5,"kb":40},"aegisDome":{"max":8,"cd":{"base":20,"perLv":-1,"min":12},"dur":{"base":2,"perLv":0.15},"r":40,"kb":160},"arrowRain":{"max":8,"dmg":{"base":12,"perLv":6},"cd":{"base":3.2,"perLv":-0.2,"min":1.5},"r":{"base":40,"perLv":4},"dur":{"base":2,"perLv":0.15},"tick":0.2,"range":200},"galeStep":{"max":8,"dmg":{"base":14,"perLv":7},"every":0.3,"dur":{"base":1.4,"perLv":0.1},"r":10},"thunderHawk":{"max":8,"dmg":{"base":40,"perLv":18},"cd":{"base":2.4,"perLv":-0.14,"min":1.1},"jumps":{"base":4,"perLv":1},"range":200,"jumpRange":80,"kb":20},"cauldron":{"max":8,"dmg":{"base":10,"perLv":6},"cd":{"base":7,"perLv":-0.4,"min":4},"r":{"base":40,"perLv":4},"dur":{"base":4,"perLv":0.3},"tick":0.5},"transmute":{"max":8,"r":{"base":60,"perLv":6},"chance":{"base":0.12,"perLv":0.03,"min":0,"max":0.6},"xp":{"base":8,"perLv":3}},"elixirRain":{"max":8,"cd":{"base":14,"perLv":-0.8,"min":7},"heal":{"base":0.08,"perLv":0.015},"cdCut":{"base":0.6,"perLv":0.1}}},"passives":{"max":{"might":5,"haste":5,"swift":5,"vital":5,"magnet":4,"crit":5},"mightDmg":0.2,"hasteCd":0.08,"swiftSpd":0.12,"vitalHp":30,"vitalHeal":30,"magnetPick":0.5,"keenCrit":0.07,"keenCritMul":0.2}},"worlds":{"lumora":{"enemies":{"slime":{"hp":22,"spd":24,"dmg":7,"xp":1,"r":6},"bat":{"hp":13,"spd":44,"dmg":5,"xp":1,"r":5},"ghost":{"hp":38,"spd":32,"dmg":9,"xp":2,"r":6},"mush":{"hp":80,"spd":19,"dmg":13,"xp":3,"r":7},"boss":{"hp":2200,"spd":27,"dmg":22,"xp":80,"r":16},"sslime":{"hp":26,"spd":26,"dmg":8,"xp":1,"r":6},"scorp":{"hp":20,"spd":46,"dmg":7,"xp":1,"r":6},"mummy":{"hp":70,"spd":20,"dmg":12,"xp":3,"r":7},"skel":{"hp":40,"spd":34,"dmg":10,"xp":2,"r":6},"islime":{"hp":30,"spd":24,"dmg":9,"xp":1,"r":6},"ibat":{"hp":18,"spd":48,"dmg":7,"xp":1,"r":5},"snowman":{"hp":90,"spd":18,"dmg":14,"xp":3,"r":7},"bossD":{"hp":2200,"spd":30,"dmg":22,"xp":80,"r":16},"bossC":{"hp":2200,"spd":27,"dmg":22,"xp":80,"r":16},"bossS":{"hp":2200,"spd":25,"dmg":22,"xp":80,"r":16},"dragon":{"hp":6000,"spd":44,"dmg":26,"xp":200,"r":20},"whelp":{"hp":28,"spd":66,"dmg":9,"xp":2,"r":5},"rival":{"hp":1400,"spd":56,"dmg":16,"xp":60,"r":7},"umbra":{"hp":9000,"spd":30,"dmg":30,"xp":300,"r":18},"caster":{"hp":32,"spd":30,"dmg":8,"xp":2,"r":6},"charger":{"hp":55,"spd":28,"dmg":12,"xp":2,"r":7},"splitter":{"hp":70,"spd":22,"dmg":10,"xp":3,"r":10},"mini":{"hp":12,"spd":50,"dmg":5,"xp":1,"r":5}}}}}$cfg$::jsonb, 'published', 'built-in defaults', now());

/** Latest published version. */
create or replace function public.current_config_version()
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(max(version), 0) from public.balance_configs where status = 'published'
$$;

/** A number from a config version's `shared` section, e.g. cfg_num(0, 'antiCheat', 'goldBase'). */
create or replace function public.cfg_num(v int, variadic path text[])
returns numeric language sql stable security definer set search_path = '' as $$
  select (c.data -> 'shared' #>> path)::numeric from public.balance_configs c where c.version = v
$$;

-- ---------- meta progression ----------
create table public.meta_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  gold bigint not null default 0 check (gold >= 0),
  shop jsonb not null default '{}'::jsonb,
  heroes text[] not null default array['mage', 'knight'],
  weapons text[] not null default '{}',
  heirloom_weapon text,
  stats jsonb not null default '{}'::jsonb,
  legacy_imported boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.meta_progress enable row level security;
revoke all on public.meta_progress from anon, authenticated;
grant select on public.meta_progress to authenticated;
create policy meta_select_own on public.meta_progress for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.ensure_meta(uid uuid)
returns public.meta_progress language plpgsql security definer set search_path = '' as $$
declare row public.meta_progress;
begin
  insert into public.meta_progress (user_id) values (uid) on conflict (user_id) do nothing;
  select * into row from public.meta_progress where user_id = uid;
  return row;
end $$;

-- ---------- runs ----------
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  world text not null default 'lumora',
  token uuid,
  seed bigint,
  client_run_id text,
  mode text not null default 'solo' check (mode in ('solo', 'coop', 'daily', 'endless')),
  room_id text,
  hero text not null,
  weapon text,
  config_version int not null default 0,
  config_versions int[] not null default '{}',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_ms bigint not null default 0,
  result text check (result in ('dead', 'quit', 'victory', 'escape', 'closed')),
  chapter int,
  kills int,
  level int,
  escapes int not null default 0,
  gold_earned int,
  score bigint,
  status text not null default 'started'
    check (status in ('started', 'submitted', 'verified', 'rejected', 'hidden', 'suspended', 'offline')),
  reject_reason text,
  summary jsonb not null default '{}'::jsonb,
  unique (user_id, client_run_id)
);
create index runs_user_started on public.runs (user_id, started_at desc);
alter table public.runs enable row level security;
revoke all on public.runs from anon, authenticated;
grant select on public.runs to authenticated;
create policy runs_select_own on public.runs for select to authenticated using (user_id = (select auth.uid()));

-- ---------- helpers ----------
create or replace function public.stage_seconds(v int, chapter int)
returns numeric language sql stable security definer set search_path = '' as $$
  select least(public.cfg_num(v, 'stage', 'durMax'), public.cfg_num(v, 'stage', 'durBase') + public.cfg_num(v, 'stage', 'durPerStage') * (chapter - 1))
$$;

/** Seconds of play needed to reach `chapter` (every earlier Stage cleared). */
create or replace function public.min_seconds_to_reach(v int, chapter int)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(public.stage_seconds(v, c)), 0) * public.cfg_num(v, 'antiCheat', 'minTimeFactor')
  from generate_series(1, greatest(chapter - 1, 0)) as c
$$;

/** Most Gold one Run reaching `chapter` may earn. */
create or replace function public.gold_ceiling(v int, chapter int)
returns numeric language sql stable security definer set search_path = '' as $$
  select public.cfg_num(v, 'antiCheat', 'goldBase') * (power(public.cfg_num(v, 'antiCheat', 'goldGrowth'), greatest(chapter, 1)) - 1)
         / greatest(public.cfg_num(v, 'antiCheat', 'goldGrowth') - 1, 0.0001)
$$;

create or replace function public.shop_cost(v int, item text, level int)
returns bigint language sql stable security definer set search_path = '' as $$
  select round(public.cfg_num(v, 'shop', item, 'base') * power(public.cfg_num(v, 'shop', 'costGrowth'), level))::bigint
$$;

create or replace function public.meta_json(m public.meta_progress)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('gold', m.gold, 'shop', m.shop, 'heroes', to_jsonb(m.heroes), 'weapons', to_jsonb(m.weapons),
    'heirloom', m.heirloom_weapon, 'stats', m.stats, 'legacyImported', m.legacy_imported)
$$;

-- ---------- RPCs ----------
create or replace function public.get_meta()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_session();
begin
  return public.meta_json(public.ensure_meta(uid));
end $$;

create or replace function public.start_run(p_hero text, p_mode text default 'solo', p_world text default 'lumora')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  v int := public.current_config_version();
  m public.meta_progress := public.ensure_meta(uid);
  last timestamptz;
  r public.runs;
begin
  if not (p_hero = any (m.heroes)) then
    raise exception 'HERO_LOCKED' using errcode = '22023';
  end if;
  select max(started_at) into last from public.runs where user_id = uid;
  if last is not null and now() - last < make_interval(secs => public.cfg_num(v, 'antiCheat', 'minSecondsBetweenStarts')) then
    raise exception 'RATE_LIMITED' using errcode = '53400';
  end if;
  insert into public.runs (user_id, world, token, seed, mode, hero, config_version, config_versions)
  values (uid, p_world, gen_random_uuid(), floor(random() * 4294967296)::bigint, p_mode, p_hero, v, array[v])
  returning * into r;
  return jsonb_build_object('runId', r.id, 'token', r.token, 'seed', r.seed, 'configVersion', v);
end $$;

/** Checks shared by online and offline submissions. Returns a reject reason or null. */
create or replace function public.run_problem(v int, chapter int, kills int, gold int, play_seconds numeric)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when chapter is null or chapter < 1 or chapter > 999 then 'BAD_CHAPTER'
    when kills is null or kills < 0 or gold is null or gold < 0 then 'BAD_NUMBERS'
    when play_seconds < public.min_seconds_to_reach(v, chapter) then 'TOO_FAST'
    when gold > public.gold_ceiling(v, chapter) then 'GOLD_CEILING'
    when kills > public.cfg_num(v, 'antiCheat', 'killsPerSecond') * greatest(play_seconds, 0) + public.cfg_num(v, 'antiCheat', 'killsPerChapter') * chapter then 'KILL_CEILING'
    else null end
$$;

create or replace function public.check_submit_rate(uid uuid, v int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.runs where user_id = uid and ended_at > now() - interval '1 hour')
     >= public.cfg_num(v, 'antiCheat', 'maxSubmitsPerHour') then
    raise exception 'RATE_LIMITED' using errcode = '53400';
  end if;
end $$;

/**
 * p: {runId, token, result, chapter, kills, level, gold, score, pausedMs, summary}
 * Real play time = now − started_at − pausedMs (pauses can only make it shorter).
 */
create or replace function public.submit_run(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  r public.runs;
  secs numeric;
  problem text;
  g int := coalesce((p ->> 'gold')::int, 0);
  m public.meta_progress;
begin
  select * into r from public.runs where id = (p ->> 'runId')::uuid and user_id = uid for update;
  if r.id is null or r.token is distinct from (p ->> 'token')::uuid then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if r.status <> 'started' then
    raise exception 'RUN_ALREADY_SUBMITTED' using errcode = '23505';
  end if;
  perform public.check_submit_rate(uid, r.config_version);
  secs := extract(epoch from (now() - r.started_at)) - greatest(coalesce((p ->> 'pausedMs')::numeric, 0), 0) / 1000;
  problem := public.run_problem(r.config_version, (p ->> 'chapter')::int, (p ->> 'kills')::int, g, secs);
  update public.runs set
    ended_at = now(), paused_ms = greatest(coalesce((p ->> 'pausedMs')::bigint, 0), 0),
    result = coalesce(p ->> 'result', 'dead'), chapter = (p ->> 'chapter')::int, kills = (p ->> 'kills')::int,
    level = (p ->> 'level')::int, gold_earned = g, score = (p ->> 'score')::bigint,
    summary = coalesce(p -> 'summary', '{}'::jsonb),
    status = case when problem is null then 'submitted' else 'rejected' end,
    reject_reason = problem
  where id = r.id;
  m := public.ensure_meta(uid);
  if problem is null and g > 0 then
    update public.meta_progress set gold = gold + g, updated_at = now() where user_id = uid returning * into m;
  end if;
  return jsonb_build_object('status', case when problem is null then 'submitted' else 'rejected' end, 'reason', problem, 'meta', public.meta_json(m));
end $$;

/** A Run played offline (no token). Same ceilings; time is taken from the client and kept unranked. */
create or replace function public.submit_offline_run(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  v int := coalesce((p ->> 'configVersion')::int, 0);
  secs numeric := greatest(coalesce((p ->> 'playMs')::numeric, 0), 0) / 1000;
  g int := coalesce((p ->> 'gold')::int, 0);
  problem text;
  m public.meta_progress;
  id uuid;
begin
  if not exists (select 1 from public.balance_configs where version = v) then v := 0; end if;
  perform public.check_submit_rate(uid, v);
  problem := public.run_problem(v, (p ->> 'chapter')::int, (p ->> 'kills')::int, g, secs);
  insert into public.runs (user_id, client_run_id, hero, mode, config_version, config_versions, started_at, ended_at,
                           result, chapter, kills, level, gold_earned, score, status, reject_reason, summary)
  values (uid, p ->> 'clientRunId', coalesce(p ->> 'hero', 'mage'), 'solo', v, array[v], now() - make_interval(secs => secs), now(),
          coalesce(p ->> 'result', 'dead'), (p ->> 'chapter')::int, (p ->> 'kills')::int, (p ->> 'level')::int, g, (p ->> 'score')::bigint,
          case when problem is null then 'offline' else 'rejected' end, problem, coalesce(p -> 'summary', '{}'::jsonb))
  on conflict (user_id, client_run_id) do nothing
  returning runs.id into id;
  m := public.ensure_meta(uid);
  if id is not null and problem is null and g > 0 then
    update public.meta_progress set gold = gold + g, updated_at = now() where user_id = uid returning * into m;
  end if;
  -- Gold the Run took from the wallet (Stage-end swaps etc.) is always charged, never below zero.
  if id is not null and coalesce((p ->> 'walletSpent')::int, 0) > 0 then
    update public.meta_progress set gold = greatest(0, gold - (p ->> 'walletSpent')::int), updated_at = now() where user_id = uid returning * into m;
  end if;
  return jsonb_build_object('status', case when id is null then 'duplicate' when problem is null then 'offline' else 'rejected' end,
                            'reason', problem, 'meta', public.meta_json(m));
end $$;

create or replace function public.buy_upgrade(p_item text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  v int := public.current_config_version();
  m public.meta_progress := public.ensure_meta(uid);
  lv int;
  cost bigint;
begin
  if public.cfg_num(v, 'shop', p_item, 'max') is null then
    raise exception 'UNKNOWN_ITEM' using errcode = '22023';
  end if;
  lv := coalesce((m.shop ->> p_item)::int, 0);
  if lv >= public.cfg_num(v, 'shop', p_item, 'max') then
    raise exception 'MAXED' using errcode = '22023';
  end if;
  cost := public.shop_cost(v, p_item, lv);
  if m.gold < cost then
    raise exception 'NOT_ENOUGH_GOLD' using errcode = '22023';
  end if;
  update public.meta_progress set gold = gold - cost, shop = shop || jsonb_build_object(p_item, lv + 1), updated_at = now()
  where user_id = uid returning * into m;
  return public.meta_json(m);
end $$;

create or replace function public.unlock_hero(p_hero text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_session();
  v int := public.current_config_version();
  m public.meta_progress := public.ensure_meta(uid);
  cost numeric := public.cfg_num(v, 'heroes', p_hero, 'cost');
begin
  if cost is null then raise exception 'UNKNOWN_HERO' using errcode = '22023'; end if;
  if p_hero = any (m.heroes) then return public.meta_json(m); end if;
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
    if public.cfg_num(v, 'heroes', h, 'cost') is not null and not (h = any (new_heroes)) then new_heroes := array_append(new_heroes, h); end if;
  end loop;
  update public.meta_progress set
    gold = gold + least(greatest(coalesce((p ->> 'gold')::bigint, 0), 0), public.cfg_num(v, 'antiCheat', 'legacyGoldCap')::bigint),
    shop = new_shop, heroes = new_heroes, legacy_imported = true,
    stats = stats || jsonb_build_object('legacy', jsonb_build_object('importedAt', now(), 'raw', p)),
    updated_at = now()
  where user_id = uid returning * into m;
  return public.meta_json(m);
end $$;

-- grants
do $$
declare f text;
begin
  foreach f in array array['get_meta()', 'start_run(text, text, text)', 'submit_run(jsonb)', 'submit_offline_run(jsonb)',
                          'buy_upgrade(text)', 'unlock_hero(text)', 'import_legacy_meta(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['ensure_meta(uuid)', 'check_submit_rate(uuid, int)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.current_config_version() to anon, authenticated;
