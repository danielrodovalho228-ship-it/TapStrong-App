-- TapStrong — Phase 0 foundations (SPEC §7).
-- Profiles, family links, health screen, restrictions, preferences, muscle goals
-- and the muscle reference table. Exercise library tables arrive in Phase 3,
-- workout tables in Phase 4.
--
-- RLS is enabled on every table. A user sees their own profile plus the
-- profiles they manage (guardian or family owner).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.sex as enum ('m', 'f');
create type public.body_band as enum ('kid', 'teen', 'young', 'adult', 'mid', 'senior', 'elder');
create type public.app_mode as enum ('child', 'teen', 'adult', 'senior');
create type public.units as enum ('imperial', 'metric');
create type public.position_ability as enum ('standing', 'with_support', 'seated_only');
create type public.restriction_source as enum ('pain_report', 'repair', 'manual');
create type public.body_side as enum ('left', 'right', 'both');
create type public.training_location as enum ('gym', 'home', 'outdoors');
create type public.main_goal as enum (
  'look', 'lose_weight', 'strength', 'bone_health', 'sport', 'mobility', 'balance'
);
create type public.muscle_goal as enum ('grow', 'firm', 'strengthen', 'balance', 'mobility');
create type public.body_view as enum ('front', 'back');
create type public.body_region as enum ('upper', 'core', 'lower');
create type public.family_role as enum ('child', 'parent', 'partner');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
--
-- `id` is the profile id. `user_id` links a profile to its own login and is
-- null for managed profiles without one (children under 13, SPEC §2.3).
-- `guardian_id` is the adult account that manages the profile.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  guardian_id uuid references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  birth_month smallint not null check (birth_month between 1 and 12),
  birth_year smallint not null check (birth_year between 1900 and 2100),
  -- Null = neutral body option (SPEC §11.8).
  sex public.sex,
  body_band public.body_band not null,
  height_cm numeric(5, 1) check (height_cm between 50 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 15 and 350),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  units public.units not null default 'imperial',
  locale text not null default 'en' check (locale in ('en', 'es', 'pt-BR')),
  mode public.app_mode not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_has_owner check (user_id is not null or guardian_id is not null),
  constraint profiles_not_own_guardian check (guardian_id is distinct from user_id),
  -- Under 13: created and managed by a parent or guardian (COPPA).
  constraint profiles_child_needs_guardian check (mode <> 'child' or guardian_id is not null),
  -- Under 13: no body measurements.
  constraint profiles_child_no_measurements check (
    mode <> 'child' or (height_cm is null and weight_kg is null and waist_cm is null)
  ),
  -- Waist (and therefore WHtR) is adults only (SPEC §2.3, §8 "Measurements").
  constraint profiles_waist_adults_only check (waist_cm is null or mode in ('adult', 'senior')),
  -- Age mode must match the age band for minors.
  constraint profiles_mode_matches_band check (
    (body_band = 'kid') = (mode = 'child') and (body_band = 'teen') = (mode = 'teen')
  )
);

create index profiles_guardian_id_idx on public.profiles (guardian_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- family_members — links an owner account to profiles it manages.
-- ---------------------------------------------------------------------------

create table public.family_members (
  owner_id uuid not null references auth.users (id) on delete cascade,
  member_profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.family_role not null,
  -- Verifiable parental consent record (COPPA). Table defined in Phase 6.
  consent_record_id uuid,
  created_at timestamptz not null default now(),
  primary key (owner_id, member_profile_id)
);

create index family_members_member_idx on public.family_members (member_profile_id);

-- ---------------------------------------------------------------------------
-- Access helper. security definer so policies on `profiles` can call it
-- without recursing into their own RLS.
-- ---------------------------------------------------------------------------

create function public.can_access_profile(target uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target
      and (p.user_id = (select auth.uid()) or p.guardian_id = (select auth.uid()))
  )
  or exists (
    select 1
    from public.family_members fm
    where fm.member_profile_id = target
      and fm.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.can_access_profile(uuid) from public;
grant execute on function public.can_access_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- health_screen — SPEC §2.2. One row per answer set; the latest one applies.
-- ---------------------------------------------------------------------------

create table public.health_screen (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pain_areas text[] not null default '{}',
  conditions text[] not null default '{}',
  position public.position_ability not null default 'standing',
  red_flag boolean not null default false,
  answered_at timestamptz not null default now()
);

create index health_screen_profile_idx on public.health_screen (profile_id, answered_at desc);

-- ---------------------------------------------------------------------------
-- restrictions — filter every future workout (SPEC §2.2).
-- ---------------------------------------------------------------------------

create table public.restrictions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  area text not null,
  side public.body_side,
  source public.restriction_source not null,
  note text check (char_length(note) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index restrictions_profile_active_idx on public.restrictions (profile_id) where active;

-- ---------------------------------------------------------------------------
-- preferences — one row per profile.
-- ---------------------------------------------------------------------------

create table public.preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  location public.training_location not null default 'home',
  minutes smallint not null default 30 check (minutes between 10 and 120),
  days_per_week smallint not null default 3 check (days_per_week between 1 and 7),
  equipment text[] not null default '{}',
  main_goals public.main_goal[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger preferences_set_updated_at
before update on public.preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- muscles — reference table. Keys match the body-map hotspots (SPEC §5).
-- ---------------------------------------------------------------------------

create table public.muscles (
  key text primary key check (key ~ '^[a-z][a-zA-Z]*$'),
  region public.body_region not null,
  -- Views where the hotspot appears. Parents (e.g. chest) may have no hotspot.
  views public.body_view[] not null default '{}',
  label_i18n_key text not null,
  parent_key text references public.muscles (key)
);

-- ---------------------------------------------------------------------------
-- muscle_goals — per-muscle goal chosen on the body map.
-- ---------------------------------------------------------------------------

create table public.muscle_goals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  muscle_key text not null references public.muscles (key),
  goal public.muscle_goal not null,
  priority smallint not null default 1 check (priority between 1 and 5),
  primary key (profile_id, muscle_key)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.health_screen enable row level security;
alter table public.restrictions enable row level security;
alter table public.preferences enable row level security;
alter table public.muscles enable row level security;
alter table public.muscle_goals enable row level security;

-- profiles
create policy profiles_select on public.profiles
for select to authenticated
using (public.can_access_profile(id));

-- A user may create their own profile, or a managed profile they guard.
create policy profiles_insert on public.profiles
for insert to authenticated
with check (
  user_id = (select auth.uid())
  or (user_id is null and guardian_id = (select auth.uid()))
);

create policy profiles_update on public.profiles
for update to authenticated
using (user_id = (select auth.uid()) or guardian_id = (select auth.uid()))
with check (user_id = (select auth.uid()) or guardian_id = (select auth.uid()));

create policy profiles_delete on public.profiles
for delete to authenticated
using (user_id = (select auth.uid()) or guardian_id = (select auth.uid()));

-- family_members: the owner manages links, and only to profiles they guard.
-- (Linking an adult with their own login needs an invite flow — Phase 6.)
create policy family_members_select on public.family_members
for select to authenticated
using (owner_id = (select auth.uid()));

create policy family_members_insert on public.family_members
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = member_profile_id and p.guardian_id = (select auth.uid())
  )
);

create policy family_members_delete on public.family_members
for delete to authenticated
using (owner_id = (select auth.uid()));

-- Per-profile tables share the same rule.
create policy health_screen_all on public.health_screen
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy restrictions_all on public.restrictions
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy preferences_all on public.preferences
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy muscle_goals_all on public.muscle_goals
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

-- muscles: public read-only reference data.
create policy muscles_read on public.muscles
for select to anon, authenticated
using (true);

revoke insert, update, delete on public.muscles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: muscle keys from the body-map hotspot list (SPEC §5).
-- ---------------------------------------------------------------------------

insert into public.muscles (key, region, views, label_i18n_key, parent_key) values
  -- parents (no hotspot of their own)
  ('chest', 'upper', '{}', 'muscles.chest', null),
  ('abs', 'core', '{}', 'muscles.abs', null),
  -- front and back
  ('traps', 'upper', '{front,back}', 'muscles.traps', null),
  -- front
  ('shoulders', 'upper', '{front}', 'muscles.shoulders', null),
  ('upperChest', 'upper', '{front}', 'muscles.upperChest', 'chest'),
  ('midChest', 'upper', '{front}', 'muscles.midChest', 'chest'),
  ('lowerChest', 'upper', '{front}', 'muscles.lowerChest', 'chest'),
  ('biceps', 'upper', '{front}', 'muscles.biceps', null),
  ('forearms', 'upper', '{front}', 'muscles.forearms', null),
  ('upperAbs', 'core', '{front}', 'muscles.upperAbs', 'abs'),
  ('lowerAbs', 'core', '{front}', 'muscles.lowerAbs', 'abs'),
  ('obliques', 'core', '{front}', 'muscles.obliques', null),
  ('hips', 'lower', '{front}', 'muscles.hips', null),
  ('adductors', 'lower', '{front}', 'muscles.adductors', null),
  ('quads', 'lower', '{front}', 'muscles.quads', null),
  ('knees', 'lower', '{front}', 'muscles.knees', null),
  ('shins', 'lower', '{front}', 'muscles.shins', null),
  -- back
  ('rearDelts', 'upper', '{back}', 'muscles.rearDelts', null),
  ('upperBack', 'upper', '{back}', 'muscles.upperBack', null),
  ('lats', 'upper', '{back}', 'muscles.lats', null),
  ('triceps', 'upper', '{back}', 'muscles.triceps', null),
  ('lowerBack', 'core', '{back}', 'muscles.lowerBack', null),
  ('glutes', 'lower', '{back}', 'muscles.glutes', null),
  ('hamstrings', 'lower', '{back}', 'muscles.hamstrings', null),
  ('calves', 'lower', '{back}', 'muscles.calves', null);
