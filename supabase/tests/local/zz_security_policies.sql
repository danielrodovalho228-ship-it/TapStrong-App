-- Security round 1, permanent protection: runs last in db:test, after every
-- migration. Fails the build if
--  - a public table has no row-level security,
--  - a policy allows everyone (using true) outside the reference-data list,
--  - a write policy (insert / update / all) has no WITH CHECK,
--  - a SECURITY DEFINER function has no fixed search_path or anon can run it,
--  - anon can write to any public table.
-- See docs/SECURITY.md (rule 2 and rule 4).
\set ON_ERROR_STOP on

do $$
declare
  -- Public reference data only: readable without login, never user data.
  open_ok constant text[] := array['muscles'];
  bad text;
begin
  select string_agg(c.relname, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if bad is not null then raise exception 'tables without row-level security: %', bad; end if;

  select string_agg(p.tablename || '.' || p.policyname, ', ') into bad
  from pg_policies p
  where p.schemaname = 'public'
    and (p.qual = 'true' or p.with_check = 'true')
    and not (p.tablename = any (open_ok) and p.cmd = 'SELECT');
  if bad is not null then raise exception 'policies open to everyone: %', bad; end if;

  select string_agg(p.tablename || '.' || p.policyname, ', ') into bad
  from pg_policies p
  where p.schemaname = 'public' and p.cmd in ('INSERT', 'UPDATE', 'ALL') and p.with_check is null;
  if bad is not null then raise exception 'write policies without WITH CHECK: %', bad; end if;

  select string_agg(f.proname, ', ') into bad
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
  where n.nspname = 'public' and f.prosecdef
    and (f.proconfig is null
         or not exists (select 1 from unnest(f.proconfig) c where c like 'search_path=%'));
  if bad is not null then raise exception 'SECURITY DEFINER functions without search_path: %', bad; end if;

  select string_agg(f.proname, ', ') into bad
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
  where n.nspname = 'public' and f.prosecdef and has_function_privilege('anon', f.oid, 'execute');
  if bad is not null then raise exception 'SECURITY DEFINER functions anon can run: %', bad; end if;

  select string_agg(distinct c.relname, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'insert')
         or has_table_privilege('anon', c.oid, 'update')
         or has_table_privilege('anon', c.oid, 'delete'))
    and exists (select 1 from pg_policies p
                where p.schemaname = 'public' and p.tablename = c.relname
                  and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                  and 'anon' = any (p.roles));
  if bad is not null then raise exception 'tables anon can write: %', bad; end if;
end $$;

select 'zz_security_policies: all assertions passed';
