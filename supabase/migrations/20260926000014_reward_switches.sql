-- Owner switches for three reward rules (default = the new behaviour), editable in the Admin:
--   bench.discard      1: Bench skills can be removed for free at the Stage end (0: not)
--   economy.spShop     1: Skill Points can be bought for Gold at the Stage end (0: off, the default)
--   loot.kingChestItem 1: Kings also drop a chest item, two chests per King (0: only the wheel, the default)
-- Patched into the live config_schema so publish_config accepts them; older published configs lack
-- them and the game uses the defaults.
update public.config_schema set schema =
  jsonb_set(jsonb_set(jsonb_set(schema,
    '{properties,shared,properties,bench,properties,discard}', $j${"default":1,"description":"Stage end: Bench skills can be removed for free (1) or not (0)","type":"number","minimum":0,"maximum":1}$j$::jsonb),
    '{properties,shared,properties,economy,properties,spShop}', $j${"default":0,"description":"Stage end: Skill Points can be bought for Gold (1) or not (0)","type":"number","minimum":0,"maximum":1}$j$::jsonb),
    '{properties,shared,properties,loot,properties,kingChestItem}', $j${"default":0,"description":"Kings also drop a chest item (1: two chests per King) or only open the wheel (0)","type":"number","minimum":0,"maximum":1}$j$::jsonb)
where id = 1;
