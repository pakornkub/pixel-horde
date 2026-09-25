-- Internal helpers are not callable by API roles; the public RPCs still are.
begin;
select plan(6);
select ok(not has_function_privilege('anon', 'public.shop_cost(int, text, int)', 'execute'), 'anon cannot call shop_cost');
select ok(not has_function_privilege('authenticated', 'public.is_admin()', 'execute'), 'authenticated cannot call is_admin');
select ok(not has_function_privilege('authenticated', 'public.flag(text)', 'execute'), 'authenticated cannot call flag');
select ok(has_function_privilege('anon', 'public.get_live_state()', 'execute'), 'anon can call get_live_state');
select ok(has_function_privilege('authenticated', 'public.submit_run(jsonb)', 'execute'), 'authenticated can call submit_run');
select ok((select proconfig from pg_proc where proname = 'audit_log_immutable') = array['search_path=""'], 'audit_log_immutable pins search_path');
select * from finish();
rollback;
