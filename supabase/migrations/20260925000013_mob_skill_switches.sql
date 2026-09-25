-- Switches for monster skills: shared.caster.on (normal monsters shoot) and shared.charger.on
-- (normal monsters charge), both off by default. Patched into the live config_schema so
-- publish_config accepts them; older published configs lack them and the game uses the default.
update public.config_schema set schema = jsonb_set(jsonb_set(schema,
  '{properties,shared,properties,caster,properties,on}',
  $j${"default":0,"description":"Normal monsters shoot (1) or just walk (0); King-summoned turrets always shoot","type":"number","minimum":0,"maximum":1}$j$::jsonb),
  '{properties,shared,properties,charger,properties,on}',
  $j${"default":0,"description":"Normal monsters charge (1) or just walk (0)","type":"number","minimum":0,"maximum":1}$j$::jsonb)
where id = 1;
