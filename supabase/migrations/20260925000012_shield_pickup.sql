-- Shield pickup: four new Balance Config fields under shared.loot. The live config_schema row is
-- patched in place (so publish_config accepts them); older published configs simply lack them and
-- the game fills in the defaults.
update public.config_schema set schema = jsonb_set(schema, '{properties,shared,properties,loot,properties}',
  schema #> '{properties,shared,properties,loot,properties}' || $j${
    "shieldChance": {"default":0.004,"description":"Shield drop chance (normal monster)","type":"number","minimum":0,"maximum":1},
    "shieldElite": {"default":0.15,"description":"Shield drop chance (elite monster)","type":"number","minimum":0,"maximum":1},
    "shieldAbsorb": {"default":0.3,"description":"Shield absorbs this much damage (× max HP)","type":"number","minimum":0,"maximum":1},
    "shieldDur": {"default":10,"description":"Shield lasts (s)","type":"number","minimum":0,"maximum":600}
  }$j$::jsonb)
where id = 1;
