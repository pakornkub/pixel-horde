-- Security advisor follow-up: pin search_path on the two remaining trigger functions and take EXECUTE
-- away from API roles on internal helpers. They are only called from SECURITY DEFINER functions and
-- triggers (which run as the owner), never by the clients, so /rest/v1/rpc should not expose them.

alter function public.audit_log_immutable() set search_path = '';
alter function public.balance_configs_immutable() set search_path = '';

do $$
declare f text;
begin
  foreach f in array array['assert_admin()', 'is_admin()', 'audit_trigger()', 'runs_mark_day()', 'cfg_num(int, text[])',
    'config_problems(jsonb)', 'gold_ceiling(int, int)', 'min_seconds_to_reach(int, int)', 'run_problem(int, int, int, int, numeric)',
    'shop_cost(int, text, int)', 'stage_seconds(int, int)', 'active_season(text)', 'current_config_version()', 'flag(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
