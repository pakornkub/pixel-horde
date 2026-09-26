-- Owner switch bench.passives (default 1, editable in the Admin): once the passive slots are full, a new passive
-- is offered "→ Bench" and swaps into a passive slot at the Stage end like an attack Skill (0: not offered, the old rule).
-- Patched into the live config_schema so publish_config accepts it; older published configs lack it and get the default.
update public.config_schema set schema = jsonb_set(schema,
  '{properties,shared,properties,bench,properties,passives}',
  $j${"default":1,"description":"Full passive slots: new passives go to the Bench and swap at the Stage end (1) or are not offered (0)","type":"number","minimum":0,"maximum":1}$j$::jsonb)
where id = 1;
