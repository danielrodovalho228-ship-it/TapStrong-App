-- Security rounds 1 and 2, permanent protection: runs last in db:test, after
-- every migration, over every non-system schema. Fails the build if
--  - a table has no row-level security,
--  - a view or materialized view that clients can read bypasses RLS (views
--    need security_invoker; materialized views never have it),
--  - a policy expression doesn't depend on who is asking (no auth.*,
--    can_access_profile, user_id, owner or guardian): `true`, `1 = 1`,
--    `not false`… outside the reference-data allowlist,
--  - a policy applies to anon or to {public} (no TO clause, which includes
--    anon) for writes, or for reads outside the reference data,
--  - a write policy (insert / update / all) has no WITH CHECK,
--  - a SECURITY DEFINER function has no fixed search_path or anon can run it,
--  - anon can write to a table.
-- Then it plants each of those mistakes (round 2, S2-P2-7) and expects the
-- check to catch it, so the check itself can't quietly go blind.
-- See docs/SECURITY.md (rule 2 and rule 4).
\set ON_ERROR_STOP on

create function pg_temp.user_schema(nsp name) returns boolean language sql immutable as $$
  select nsp !~ '^(pg_|_)' and nsp not in (
    'information_schema', 'auth', 'extensions', 'storage', 'graphql', 'graphql_public',
    'realtime', 'vault', 'pgsodium', 'pgsodium_masks', 'supabase_functions',
    'supabase_migrations', 'net', 'cron', 'pgbouncer', 'pgmq');
$$;

create function pg_temp.security_findings() returns setof text language sql as $$
  -- Reference data only: readable without login, never user data.
  with ref(tbl) as (values ('public.muscles'), ('public.exercises'), ('public.exercise_muscles')),
  -- Views allowed to run as their owner (none today).
  view_ok(v) as (select null::text where false),
  pol as (
    select p.schemaname || '.' || p.tablename as tbl, p.policyname, p.cmd, p.roles,
           p.qual, p.with_check
    from pg_policies p where pg_temp.user_schema(p.schemaname)
  ),
  owner_free as (select 'auth\.|can_access|user_id|owner|guardian'::text as re)
  select 'table without row-level security: ' || n.nspname || '.' || c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where pg_temp.user_schema(n.nspname) and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  select 'view without security_invoker: ' || n.nspname || '.' || c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where pg_temp.user_schema(n.nspname) and c.relkind in ('v', 'm')
    and (c.relkind = 'm'
         or not coalesce(c.reloptions && array['security_invoker=true', 'security_invoker=on',
                                                'security_invoker=1'], false))
    and (has_table_privilege('anon', c.oid, 'select')
         or has_table_privilege('authenticated', c.oid, 'select'))
    and n.nspname || '.' || c.relname not in (select v from view_ok)
  union all
  select 'policy that ignores who is asking: ' || tbl || '.' || policyname
  from pol, owner_free o
  where (qual !~ o.re or with_check !~ o.re)
    and not (cmd = 'SELECT' and tbl in (select tbl from ref))
  union all
  select 'policy open to anon / public: ' || tbl || '.' || policyname
  from pol
  where roles && array['anon', 'public']::name[]
    and not (cmd = 'SELECT' and tbl in (select tbl from ref))
  union all
  select 'write policy without WITH CHECK: ' || tbl || '.' || policyname
  from pol where cmd in ('INSERT', 'UPDATE', 'ALL') and with_check is null
  union all
  select 'SECURITY DEFINER function without search_path: ' || n.nspname || '.' || f.proname
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
  where pg_temp.user_schema(n.nspname) and f.prosecdef
    and (f.proconfig is null
         or not exists (select 1 from unnest(f.proconfig) c where c like 'search_path=%'))
  union all
  select 'SECURITY DEFINER function anon can run: ' || n.nspname || '.' || f.proname
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
  where pg_temp.user_schema(n.nspname) and f.prosecdef
    and has_function_privilege('anon', f.oid, 'execute')
  union all
  select distinct 'table anon can write: ' || n.nspname || '.' || c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where pg_temp.user_schema(n.nspname) and c.relkind in ('r', 'p')
    and (has_table_privilege('anon', c.oid, 'insert')
         or has_table_privilege('anon', c.oid, 'update')
         or has_table_privilege('anon', c.oid, 'delete'))
    and exists (select 1 from pol
                where pol.tbl = n.nspname || '.' || c.relname
                  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                  and roles && array['anon', 'public']::name[]);
$$;

-- The real schema: no findings.
do $$
declare
  bad text;
begin
  select string_agg(f, E'\n  ') into bad from pg_temp.security_findings() f;
  if bad is not null then raise exception E'security catalog findings:\n  %', bad; end if;
end $$;

-- Regression: each planted mistake must be caught (then rolled back).
create function pg_temp.expect_caught(plant text, expected text) returns void
language plpgsql as $$
declare
  hit boolean;
begin
  begin
    execute plant;
    select exists (select 1 from pg_temp.security_findings() f where f = expected) into hit;
    raise exception 'undo:%', case when hit then 'caught' else 'missed' end;
  exception when raise_exception then
    if sqlerrm <> 'undo:caught' then
      raise exception 'the catalog test missed "%" (planted: %)', expected, plant;
    end if;
  end;
end $$;

select pg_temp.expect_caught(
  'create view public.pins_leak as select * from public.parent_pins;
   grant select on public.pins_leak to anon',
  'view without security_invoker: public.pins_leak');
select pg_temp.expect_caught(
  'create materialized view public.mv_leak as select user_id from public.profiles;
   grant select on public.mv_leak to authenticated',
  'view without security_invoker: public.mv_leak');
select pg_temp.expect_caught(
  'create policy leak on public.parent_pins for select to authenticated using (1 = 1)',
  'policy that ignores who is asking: public.parent_pins.leak');
select pg_temp.expect_caught(
  'create policy leak on public.profiles for insert to authenticated with check (not false)',
  'policy that ignores who is asking: public.profiles.leak');
select pg_temp.expect_caught(
  'create policy leak on public.profiles for select to authenticated using (true)',
  'policy that ignores who is asking: public.profiles.leak');
select pg_temp.expect_caught(
  'create policy leak on public.profiles for insert with check (auth.uid() is null)',
  'policy open to anon / public: public.profiles.leak');
select pg_temp.expect_caught(
  'create policy leak on public.profiles for update to authenticated using (user_id = auth.uid())',
  'write policy without WITH CHECK: public.profiles.leak');
select pg_temp.expect_caught(
  'create schema api; create table api.notes (body text)',
  'table without row-level security: api.notes');
select pg_temp.expect_caught(
  'create schema api; create function api.peek() returns int language sql security definer
   as ''select 1''',
  'SECURITY DEFINER function without search_path: api.peek');
select pg_temp.expect_caught(
  'create schema api; create function api.peek() returns int language sql security definer
   set search_path = '''' as ''select 1''',
  'SECURITY DEFINER function anon can run: api.peek');
select pg_temp.expect_caught(
  'grant insert on public.set_logs to anon;
   create policy leak on public.set_logs for insert to anon with check (auth.uid() is not null)',
  'table anon can write: public.set_logs');

select 'zz_security_policies: all assertions passed';
