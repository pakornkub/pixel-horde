-- Heart Crack tiers 1–10 (balance pass 2026-09e, owner decision 2026-09-27): new Balance Config fields
-- shared.heartCrack.{ramp,maxTier,undoPer,hpPer,dmgPer,spawnPer} (every tier is the same step up from the base
-- difficulty, up to maxTier), shared.score.crack (Score bonus per tier), shared.skills.hawk.nearCh (the Hawk dives the
-- nearest monster in the first Chapters) and shared.heroes.ranger.crit (Kit's Hunter's Eye). Defaults keep today's game
-- (ramp 0 = the Tier 1–3 table, maxTier 3, no bonus) until the pass is published.
-- The server clamps a Run's tier and the unlocked tier to the Run's config maxTier instead of a fixed 3; runs.crack
-- may hold up to 20 (the field's range). submit_run is 0031's with only those two clamps changed.
update public.config_schema set schema = jsonb_set(jsonb_set(jsonb_set(jsonb_set(schema,
  '{properties,shared,properties,heartCrack}',
  $j${"description":"Heart Crack difficulty tiers (unlocked by beating Umbra)","default":{},"type":"object","properties":{"hp1":{"default":1.25,"description":"Tier 1: monster HP ×","type":"number","minimum":0,"maximum":10},"dmg1":{"default":1.15,"description":"Tier 1: monster damage ×","type":"number","minimum":0,"maximum":10},"spawn1":{"default":1.15,"description":"Tier 1: spawn rate ×","type":"number","minimum":0,"maximum":10},"hp2":{"default":1.5,"description":"Tier 2: monster HP ×","type":"number","minimum":0,"maximum":10},"dmg2":{"default":1.3,"description":"Tier 2: monster damage ×","type":"number","minimum":0,"maximum":10},"spawn2":{"default":1.3,"description":"Tier 2: spawn rate ×","type":"number","minimum":0,"maximum":10},"hp3":{"default":1.8,"description":"Tier 3: monster HP ×","type":"number","minimum":0,"maximum":10},"dmg3":{"default":1.45,"description":"Tier 3: monster damage ×","type":"number","minimum":0,"maximum":10},"spawn3":{"default":1.45,"description":"Tier 3: spawn rate ×","type":"number","minimum":0,"maximum":10},"ramp":{"default":0,"description":"Tiers follow the per-tier ramp below (1) or the Tier 1–3 table above (0)","type":"number","minimum":0,"maximum":1},"maxTier":{"default":3,"description":"Highest Heart Crack tier a player can unlock","type":"number","minimum":1,"maximum":20},"undoPer":{"default":0,"description":"Ramp: share of the base difficulty help (shared.difficulty, except Gold) each tier takes away","type":"number","minimum":0,"maximum":1},"hpPer":{"default":0,"description":"Ramp: monster HP + per tier","type":"number","minimum":0,"maximum":1},"dmgPer":{"default":0,"description":"Ramp: monster damage + per tier","type":"number","minimum":0,"maximum":1},"spawnPer":{"default":0,"description":"Ramp: spawn rate + per tier","type":"number","minimum":0,"maximum":1}}}$j$::jsonb),
  '{properties,shared,properties,score}',
  $j${"description":"Arcade Score","default":{},"type":"object","properties":{"chapter":{"default":1000,"description":"Per Chapter cleared × Chapter number","type":"number","minimum":0,"maximum":10000},"king":{"default":500,"description":"Per King killed × Chapter number","type":"number","minimum":0,"maximum":5000},"kill":{"default":1,"description":"Per monster","type":"number","minimum":0,"maximum":10},"combo":{"default":5,"description":"Per elemental Combo","type":"number","minimum":0,"maximum":50},"victory":{"default":20000,"description":"Beating Umbra","type":"number","minimum":0,"maximum":200000},"fastBase":{"default":1500,"description":"Fast finish: seconds budget","type":"number","minimum":0,"maximum":15000},"fastMul":{"default":10,"description":"Fast finish: points per second under the budget","type":"number","minimum":0,"maximum":100},"escape":{"default":3000,"description":"Minus per King that escaped","type":"number","minimum":0,"maximum":30000},"revivePenalty":{"default":0.15,"description":"Share of the Score lost when buying a revive","type":"number","minimum":0,"maximum":1},"crack":{"default":0,"description":"Heart Crack bonus: Score × (1 + this × tier)","type":"number","minimum":0,"maximum":5}}}$j$::jsonb),
  '{properties,shared,properties,skills,properties,hawk}',
  $j${"description":"Kit: Hawk Companion","default":{},"type":"object","properties":{"max":{"default":7,"description":"Max level","type":"number","minimum":1,"maximum":20},"dmg":{"description":"Dive damage","default":{},"type":"object","properties":{"base":{"default":34,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":16,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"cd":{"description":"Cooldown (s)","default":{},"type":"object","properties":{"base":{"default":2.2,"description":"Value before levels","type":"number","minimum":-1000000,"maximum":1000000},"perLv":{"default":-0.14,"description":"Added per skill level","type":"number","minimum":-10000,"maximum":10000},"min":{"default":0.9,"description":"Lower limit","type":"number","minimum":-1000000,"maximum":1000000},"max":{"description":"Upper limit","type":"number","minimum":-1000000,"maximum":1000000}}},"range":{"default":230,"description":"Hunting range","type":"number","minimum":0,"maximum":2300},"flight":{"default":0.35,"description":"Dive time (s)","type":"number","minimum":0,"maximum":600},"kb":{"default":40,"description":"Knockback","type":"number","minimum":0,"maximum":400},"r":{"default":0,"description":"Dive splash radius: monsters this close to the prey are hit too (0 = prey only)","type":"number","minimum":0,"maximum":200},"guardN":{"default":0,"description":"Monsters this close to Kit that make the Hawk defend: it dives the nearest one instead of the biggest (0 = never)","type":"number","minimum":0,"maximum":50},"guardR":{"default":40,"description":"Hawk defend radius around Kit","type":"number","minimum":0,"maximum":400},"nearCh":{"default":0,"description":"Through this Chapter the Hawk dives the nearest monster instead of the biggest (0 = never)","type":"number","minimum":0,"maximum":20},"evo":{"description":"Changes applied when the skill evolves","default":{},"type":"object","properties":{"n":{"default":2,"description":"Hawks","type":"number","minimum":1,"maximum":4},"stun":{"default":0.8,"description":"Stun (s); bosses are slowed","type":"number","minimum":0,"maximum":600}}},"awk":{"description":"Stormhunter (Awakened, awaken.form 1): Hawk Flock; Arrow Rain turns to fire arrows on its prey","default":{},"type":"object","properties":{"n":{"default":5,"description":"Hawks in the flock","type":"number","minimum":1,"maximum":12},"dmgMul":{"default":0.6,"description":"Damage × per hawk","type":"number","minimum":0,"maximum":10},"r":{"default":16,"description":"Splash radius of each dive","type":"number","minimum":0,"maximum":160},"galePull":{"default":40,"description":"Gale Step blades pull monsters toward them (Gathered)","type":"number","minimum":0,"maximum":400},"shockMul":{"default":1.5,"description":"Thunder Hawk damage × on Shocked monsters","type":"number","minimum":0,"maximum":10},"shockJump":{"default":1.6,"description":"Thunder Hawk jump range × toward Shocked monsters","type":"number","minimum":0,"maximum":10}}}}}$j$::jsonb),
  '{properties,shared,properties,heroes,properties,ranger}',
  $j${"description":"Kit","default":{},"type":"object","properties":{"cost":{"default":500,"description":"Unlock price","type":"number","minimum":0,"maximum":5000},"spd":{"default":0.12,"description":"Speed bonus","type":"number","minimum":0,"maximum":1},"pick":{"default":0.3,"description":"Pickup range bonus","type":"number","minimum":0,"maximum":10},"hp":{"default":0,"description":"Max HP bonus","type":"number","minimum":0,"maximum":200},"crit":{"default":0,"description":"Hunter's Eye: crit chance bonus (still under the crit cap)","type":"number","minimum":0,"maximum":1}}}$j$::jsonb)
where id = 1;

alter table public.runs drop constraint if exists runs_crack_check;
alter table public.runs add constraint runs_crack_check check (crack between 0 and 20);

/** Highest Heart Crack tier of a config version (heartCrack.maxTier; 3 for versions published before the field). */
create or replace function public.crack_max(v int)
returns int language sql stable security definer set search_path = '' as $$
  select least(20, greatest(1, coalesce(public.cfg_num(v, 'heartCrack', 'maxTier'), 3)))::int
$$;
revoke all on function public.crack_max(int) from public, anon, authenticated;

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
  -- time suspended between sessions never counts as play time
  secs := extract(epoch from (now() - r.started_at)) - greatest(coalesce((p ->> 'pausedMs')::numeric, 0), 0) / 1000 - r.suspended_ms / 1000.0;
  problem := public.run_problem(r.config_version, (p ->> 'chapter')::int, (p ->> 'kills')::int, g, secs,
                                r.mode, coalesce((p ->> 'joinChapter')::int, 1), coalesce((p ->> 'team')::int, 1));
  -- a Run continued from a checkpoint must name the one the server knows (copied or stale saves fail)
  if problem is null and p ? 'resumedHash' and (p ->> 'resumedHash') is not null
     and (p ->> 'resumedHash') is distinct from coalesce(r.resumed_hash, r.checkpoint_hash) then
    problem := 'STALE_CHECKPOINT';
  end if;
  update public.runs set
    ended_at = now(), paused_ms = greatest(coalesce((p ->> 'pausedMs')::bigint, 0), 0),
    result = coalesce(p ->> 'result', 'dead'), chapter = (p ->> 'chapter')::int, kills = (p ->> 'kills')::int,
    level = (p ->> 'level')::int, gold_earned = g, score = (p ->> 'score')::bigint,
    endless_score = greatest(coalesce((p ->> 'endlessScore')::bigint, 0), 0),
    victory = coalesce((p ->> 'victory')::boolean, false),
    crack = least(greatest(coalesce((p ->> 'crack')::int, 0), 0), public.crack_max(r.config_version)),
    summary = coalesce(p -> 'summary', '{}'::jsonb),
    status = case when problem is null then 'submitted' else 'rejected' end,
    reject_reason = problem
  where id = r.id;
  m := public.ensure_meta(uid);
  if problem is null and g > 0 then
    update public.meta_progress set gold = gold + g, updated_at = now() where user_id = uid returning * into m;
  end if;
  if problem is null then m := public.add_found_weapons(uid, r.world, p -> 'weaponsFound'); end if;
  -- achievements, lifetime totals and the bestiary (ticket 32)
  if problem is null then
    perform public.apply_run_facts(uid, p -> 'facts');
    select * into m from public.meta_progress where user_id = uid;
  end if;
  -- beating Umbra unlocks the next Heart Crack tier (up to heartCrack.maxTier), only above the tier the Run used
  if problem is null and coalesce((p ->> 'victory')::boolean, false) then
    update public.meta_progress
      set stats = jsonb_set(stats, '{heartCrack}', to_jsonb(least(public.crack_max(r.config_version), greatest(coalesce((stats ->> 'heartCrack')::int, 0),
                  least(greatest(coalesce((p ->> 'crack')::int, 0), 0), public.crack_max(r.config_version)) + 1)))), updated_at = now()
    where user_id = uid returning * into m;
  end if;
  -- Gold the Run took from the wallet (Stage-end swaps etc.) is always charged, never below zero.
  if coalesce((p ->> 'walletSpent')::int, 0) > 0 then
    update public.meta_progress set gold = greatest(0, gold - (p ->> 'walletSpent')::int), updated_at = now() where user_id = uid returning * into m;
  end if;
  if problem is null then
    perform public.record_leaderboard(r.id);
  end if;
  return jsonb_build_object('status', case when problem is null then 'submitted' else 'rejected' end, 'reason', problem, 'meta', public.meta_json(m));
end $$;
