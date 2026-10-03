-- Minimal stand-in for Supabase's auth schema and roles, so migrations and RLS
-- tests can run on plain Postgres (see scripts/db-test.sh). Not used in Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, is_anonymous boolean not null default false);
-- Columns Supabase's auth.users has and the migrations read (security round 1, P3).
alter table auth.users add column if not exists created_at timestamptz not null default now();
alter table auth.users add column if not exists email_confirmed_at timestamptz default now();

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- auth.jwt(): the claims of the request, like Supabase's (tests set request.jwt.claims).
create or replace function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

-- Minimal Supabase Storage (Phase 32): buckets and objects with RLS on, and
-- the same table grants Supabase gives anon / authenticated, so a bucket's
-- policies (or their absence) are what decides.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.buckets, storage.objects to anon, authenticated;
