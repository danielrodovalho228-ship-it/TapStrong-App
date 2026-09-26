-- TapStrong — Phase 3: exercise library and review workflow (SPEC §2.1, §7).
--
-- An exercise reaches users only when status = 'released'. Release needs, for
-- the CURRENT muscle mapping: an automated rule check, a second independent
-- mapping check, and a certified reviewer sign-off (name + credential), plus
-- licensed (non-prototype) media. The database enforces all of this.

-- ---------------------------------------------------------------------------
-- Muscle movement groups (push / pull / legs / core) for the weekly balance
-- pass in the generator (SPEC §8).
-- ---------------------------------------------------------------------------

create type public.movement_group as enum ('push', 'pull', 'legs', 'core');

alter table public.muscles add column movement_group public.movement_group;

update public.muscles set movement_group = 'push'
  where key in ('chest', 'upperChest', 'midChest', 'lowerChest', 'shoulders', 'triceps');
update public.muscles set movement_group = 'pull'
  where key in ('upperBack', 'lats', 'rearDelts', 'biceps', 'forearms', 'traps');
update public.muscles set movement_group = 'legs'
  where key in ('quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'hips', 'knees', 'shins');
update public.muscles set movement_group = 'core'
  where key in ('abs', 'upperAbs', 'lowerAbs', 'obliques', 'lowerBack');

alter table public.muscles alter column movement_group set not null;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.exercise_status as enum (
  'draft', 'auto_checked', 'second_checked', 'released', 'retired'
);
create type public.muscle_role as enum ('primary', 'secondary', 'stabilizer');
create type public.review_check as enum ('auto', 'second', 'certified');
create type public.review_result as enum ('pass', 'fail');
create type public.dose_type as enum ('reps', 'time');

-- Where an exercise may appear in a session (SPEC §8 structure).
create type public.session_part as enum (
  'warmup_general', 'warmup_mobility', 'main', 'finisher_cardio', 'finisher_mobility',
  'cooldown_walk', 'cooldown_stretch', 'cooldown_breathing'
);

create type public.movement_pattern as enum (
  'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
  'squat', 'hinge', 'lunge', 'knee_flexion', 'knee_extension', 'calf', 'ankle',
  'hip_isolation', 'shoulder_isolation', 'elbow_flexion', 'elbow_extension', 'wrist',
  'core_flexion', 'core_stability', 'rotation',
  'cardio', 'mobility', 'stretch', 'balance', 'breathing'
);

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9_]*$'),
  name_i18n_key text not null,
  cues_i18n_key text not null,
  -- All listed equipment is required; empty = bodyweight.
  equipment text[] not null default '{}',
  location public.training_location[] not null check (cardinality(location) > 0),
  level smallint not null check (level between 1 and 5),
  min_age_band public.body_band not null,
  -- Position abilities this exercise suits (SPEC §7 health_screen.position).
  positions public.position_ability[] not null check (cardinality(positions) > 0),
  -- Pain areas and health conditions that rule the exercise out.
  contraindications text[] not null default '{}',
  movement_pattern public.movement_pattern not null,
  session_parts public.session_part[] not null check (cardinality(session_parts) > 0),
  dose_type public.dose_type not null,
  -- Uses external load (weights, machines, cables): gets ramp-up sets.
  loaded boolean not null default false,
  unilateral boolean not null default false,
  -- 0 = none/low, 1 = moderate, 2 = high (jumps). Seniors never get 2.
  impact smallint not null default 0 check (impact between 0 and 2),
  media_video text,
  media_poster text,
  media_provider text,
  license_ref text,
  status public.exercise_status not null default 'draft',
  -- Bumped whenever the muscle mapping changes; reviews apply to one version.
  mapping_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- exercise_muscles — the verified exercise ↔ muscle mapping.
-- ---------------------------------------------------------------------------

create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  muscle_key text not null references public.muscles (key),
  role public.muscle_role not null,
  emphasis numeric(3, 2) not null check (emphasis > 0 and emphasis <= 1),
  primary key (exercise_id, muscle_key)
);

create index exercise_muscles_muscle_idx on public.exercise_muscles (muscle_key, role);

-- ---------------------------------------------------------------------------
-- exercise_reviews
-- ---------------------------------------------------------------------------

create table public.exercise_reviews (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  "check" public.review_check not null,
  reviewer_name text,
  credential text,
  result public.review_result not null,
  notes text,
  mapping_version integer not null,
  reviewed_at timestamptz not null default now(),
  constraint exercise_reviews_second_named check ("check" <> 'second' or reviewer_name is not null),
  constraint exercise_reviews_certified_signed check (
    "check" <> 'certified' or (reviewer_name is not null and credential is not null)
  )
);

create index exercise_reviews_exercise_idx on public.exercise_reviews (exercise_id, "check");

-- Reviews always attach to the exercise's current mapping version.
create function public.exercise_reviews_stamp_version() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select e.mapping_version into new.mapping_version
  from public.exercises e where e.id = new.exercise_id;
  return new;
end;
$$;

create trigger exercise_reviews_stamp_version
before insert on public.exercise_reviews
for each row execute function public.exercise_reviews_stamp_version();

-- ---------------------------------------------------------------------------
-- Release workflow guard
-- ---------------------------------------------------------------------------

create function public.exercise_has_pass(ex uuid, version integer, kind public.review_check)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_reviews r
    where r.exercise_id = ex and r.mapping_version = version
      and r."check" = kind and r.result = 'pass'
  );
$$;

create function public.exercises_guard_status() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'new exercises start as draft (got %)', new.status;
    end if;
    return new;
  end if;

  if new.status = old.status or new.status in ('draft', 'retired') then
    return new;
  end if;

  if not public.exercise_has_pass(new.id, new.mapping_version, 'auto') then
    raise exception 'exercise %: no passing automated check for mapping v%', new.slug, new.mapping_version;
  end if;

  if new.status in ('second_checked', 'released')
     and not public.exercise_has_pass(new.id, new.mapping_version, 'second') then
    raise exception 'exercise %: no passing second mapping check for mapping v%', new.slug, new.mapping_version;
  end if;

  if new.status = 'released' then
    if not public.exercise_has_pass(new.id, new.mapping_version, 'certified') then
      raise exception 'exercise %: no certified reviewer sign-off for mapping v%', new.slug, new.mapping_version;
    end if;
    -- Prototype AI loops are placeholders only (SPEC §6).
    if new.media_video is null or new.license_ref is null
       or new.media_provider is null or new.media_provider = 'prototype' then
      raise exception 'exercise %: released exercises need licensed media', new.slug;
    end if;
    if not exists (
      select 1 from public.exercise_muscles m
      where m.exercise_id = new.id and m.role = 'primary'
    ) and new.movement_pattern <> 'breathing' then
      raise exception 'exercise %: no primary muscle', new.slug;
    end if;
  end if;

  return new;
end;
$$;

create trigger exercises_guard_status
before insert or update of status on public.exercises
for each row execute function public.exercises_guard_status();

-- The mapping can change only while the exercise is a draft; each change
-- bumps mapping_version, so earlier reviews no longer count.
create function public.exercise_muscles_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ex_id uuid := coalesce(new.exercise_id, old.exercise_id);
  ex_status public.exercise_status;
begin
  select status into ex_status from public.exercises where id = ex_id;
  if ex_status is not null and ex_status <> 'draft' then
    raise exception 'mapping is locked while the exercise is %; set it back to draft first', ex_status;
  end if;
  update public.exercises set mapping_version = mapping_version + 1 where id = ex_id;
  return coalesce(new, old);
end;
$$;

create trigger exercise_muscles_guard
before insert or update or delete on public.exercise_muscles
for each row execute function public.exercise_muscles_guard();

-- ---------------------------------------------------------------------------
-- Row level security: only released exercises and their mappings are public.
-- Drafts and reviews are for the review tooling (service role) only.
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.exercise_muscles enable row level security;
alter table public.exercise_reviews enable row level security;

create policy exercises_read_released on public.exercises
for select to anon, authenticated
using (status = 'released');

create policy exercise_muscles_read_released on public.exercise_muscles
for select to anon, authenticated
using (exists (
  select 1 from public.exercises e where e.id = exercise_id and e.status = 'released'
));

revoke insert, update, delete on public.exercises from anon, authenticated;
revoke insert, update, delete on public.exercise_muscles from anon, authenticated;
revoke all on public.exercise_reviews from anon, authenticated;
revoke execute on function public.exercise_has_pass(uuid, integer, public.review_check)
  from public, anon, authenticated;
