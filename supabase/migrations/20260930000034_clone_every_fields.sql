-- Skill pass 2026-09f: new Balance Config fields shared.clone.{every,auraMul,pulseR} (the Shadow Clone casts one
-- of the player's Skills at random every `every` s; always-on Skills as one pulse). Patched into the live config_schema so
-- publish_config accepts them; their defaults keep the current behaviour (every 0 = the clone only repeats six Skills)
-- until an admin publishes the pass that turns it on (Admin → Balance → 2026-09f).
update public.config_schema set schema = jsonb_set(schema,
  '{properties,shared,properties,clone}',
  $j${"description":"Shadow Clone","default":{},"type":"object","properties":{"dmg":{"default":0.35,"description":"Clone damage fraction","type":"number","minimum":0,"maximum":1},"dmgPerLv":{"default":0.08,"description":"Clone damage + per clone level","type":"number","minimum":0,"maximum":1},"dmgMax":{"default":0.6,"description":"Clone damage fraction cap","type":"number","minimum":0,"maximum":1},"every":{"default":0,"description":"Seconds between clone casts, each one of your Skills picked at random (0 = old rule: it only repeats your Bolt/Lance/Boomerang/Chain/Nova/Meteor casts)","type":"number","minimum":0,"maximum":600},"auraMul":{"default":3,"description":"Clone copy of an always-on Skill (Orbit, Frost Aura, Holy Shield, Time Warp, Gale Step): one pulse at this × its damage","type":"number","minimum":0,"maximum":10},"pulseR":{"default":50,"description":"Smallest radius of that pulse","type":"number","minimum":0,"maximum":500}}}$j$::jsonb)
where id = 1;
