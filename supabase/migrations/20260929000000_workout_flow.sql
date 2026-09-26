-- Phase 4 — workout flow (SPEC §7, §8): plans, sessions, items, set logs,
-- muscle activity, streaks, pain reports and swap history.
--
-- The app is local-first until accounts sync (Phase 5); these tables mirror
-- the local workout store so sync is a straight copy. RLS on every table:
-- a user sees only rows of profiles they can access (own + managed family).

create type public.session_status as enum ('planned', 'active', 'done', 'skipped', 'partial');
create type public.session_kind as enum ('regular', 'finisher');
create type public.item_role as enum ('warmup', 'main', 'finisher', 'mobility', 'cooldown');
create type public.load_unit as enum ('lb', 'kg');
create type public.pain_type as enum ('sharp', 'dull', 'tired');
create type public.pain_action as enum ('stopped', 'swapped', 'skipped', 'continued');
create type public.swap_reason as enum ('user_choice', 'machine_taken', 'pain');

-- ---------------------------------------------------------------------------
-- plans — a generated program.
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weeks smallint not null default 4 check (weeks between 1 and 52),
  sessions_per_week smallint not null check (sessions_per_week between 1 and 7),
  created_from jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index plans_profile_idx on public.plans (profile_id);

-- ---------------------------------------------------------------------------
-- sessions — one workout. profile_id is kept on the row (not only through
-- the plan) so RLS stays a single check and one-off sessions need no plan.
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  index smallint check (index >= 0),
  kind public.session_kind not null default 'regular',
  scheduled_for date,
  status public.session_status not null default 'planned',
  minutes smallint check (minutes between 10 and 120),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index sessions_profile_idx on public.sessions (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- session_items — the sequence, in order: warm-up → main → finisher → cool-down.
-- ---------------------------------------------------------------------------

create table public.session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  "order" smallint not null check ("order" >= 0),
  exercise_id uuid not null references public.exercises (id),
  role public.item_role not null,
  part text not null check (
    part in (
      'warmup_general', 'warmup_mobility', 'ramp_up', 'main', 'finisher_cardio',
      'finisher_mobility', 'cooldown_walk', 'cooldown_stretch', 'cooldown_breathing'
    )
  ),
  target_muscle text references public.muscles (key),
  goal public.muscle_goal,
  sets smallint not null check (sets between 1 and 10),
  reps_min smallint check (reps_min between 1 and 100),
  reps_max smallint check (reps_max between 1 and 100),
  hold_s_min smallint check (hold_s_min between 1 and 600),
  hold_s_max smallint check (hold_s_max between 1 and 600),
  duration_s smallint check (duration_s between 1 and 3600),
  rest_s smallint not null default 0 check (rest_s between 0 and 600),
  per_side boolean not null default false,
  load_hint text check (load_hint in ('bodyweight', 'light', 'moderate', 'heavy', 'ramp')),
  unique (session_id, "order"),
  check (reps_min is null or reps_max is null or reps_min <= reps_max),
  check (hold_s_min is null or hold_s_max is null or hold_s_min <= hold_s_max)
);

-- ---------------------------------------------------------------------------
-- set_logs — one row per finished set or timed step. exercise_id is the
-- exercise actually done (it changes when an item is swapped mid-way).
-- ---------------------------------------------------------------------------

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_item_id uuid not null references public.session_items (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  set_no smallint not null check (set_no between 1 and 20),
  reps smallint check (reps between 0 and 200),
  seconds smallint check (seconds between 0 and 3600),
  load numeric(6, 2) check (load >= 0 and load <= 2000),
  unit public.load_unit,
  rpe smallint check (rpe between 1 and 10),
  logged_at timestamptz not null default now(),
  unique (session_item_id, set_no),
  check (load is null or unit is not null)
);

-- ---------------------------------------------------------------------------
-- muscle_activity — derived from set logs; feeds the body colors (SPEC §8).
-- ---------------------------------------------------------------------------

create table public.muscle_activity (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  muscle_key text not null references public.muscles (key),
  last_trained_at timestamptz,
  -- "Also worked": last time as a secondary muscle.
  last_secondary_at timestamptz,
  volume_7d smallint not null default 0 check (volume_7d >= 0),
  primary key (profile_id, muscle_key)
);

-- ---------------------------------------------------------------------------
-- streaks — one row per profile (SPEC §8: 1 rest day a week, freezes max 2).
-- ---------------------------------------------------------------------------

create table public.streaks (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  current integer not null default 0 check (current >= 0),
  best integer not null default 0 check (best >= current),
  freezes_available smallint not null default 0 check (freezes_available between 0 and 2),
  last_active_date date,
  rest_days date[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- pain_reports — SPEC §2.2. Health data: never sent to analytics.
-- ---------------------------------------------------------------------------

create table public.pain_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  exercise_id uuid references public.exercises (id),
  area text not null check (
    area in ('neck', 'shoulder', 'elbow_wrist', 'lower_back', 'hip', 'knee', 'ankle_foot', 'other')
  ),
  side public.body_side,
  type public.pain_type not null,
  action_taken public.pain_action not null,
  reported_at timestamptz not null default now()
);

create index pain_reports_profile_idx on public.pain_reports (profile_id, reported_at desc);

-- ---------------------------------------------------------------------------
-- exercise_swaps — swap history (SPEC §8 "Swap"), later used to learn
-- preferences.
-- ---------------------------------------------------------------------------

create table public.exercise_swaps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  item_order smallint not null check (item_order >= 0),
  from_exercise_id uuid not null references public.exercises (id),
  to_exercise_id uuid not null references public.exercises (id),
  reason public.swap_reason not null,
  sets_done_before smallint not null default 0 check (sets_done_before between 0 and 10),
  swapped_at timestamptz not null default now(),
  check (from_exercise_id <> to_exercise_id)
);

create index exercise_swaps_profile_idx on public.exercise_swaps (profile_id, swapped_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.sessions enable row level security;
alter table public.session_items enable row level security;
alter table public.set_logs enable row level security;
alter table public.muscle_activity enable row level security;
alter table public.streaks enable row level security;
alter table public.pain_reports enable row level security;
alter table public.exercise_swaps enable row level security;

create policy plans_all on public.plans
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy sessions_all on public.sessions
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy session_items_all on public.session_items
for all to authenticated
using (
  exists (
    select 1 from public.sessions s
    where s.id = session_items.session_id and public.can_access_profile(s.profile_id)
  )
)
with check (
  exists (
    select 1 from public.sessions s
    where s.id = session_items.session_id and public.can_access_profile(s.profile_id)
  )
);

create policy set_logs_all on public.set_logs
for all to authenticated
using (
  exists (
    select 1
    from public.session_items i
    join public.sessions s on s.id = i.session_id
    where i.id = set_logs.session_item_id and public.can_access_profile(s.profile_id)
  )
)
with check (
  exists (
    select 1
    from public.session_items i
    join public.sessions s on s.id = i.session_id
    where i.id = set_logs.session_item_id and public.can_access_profile(s.profile_id)
  )
);

create policy muscle_activity_all on public.muscle_activity
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy streaks_all on public.streaks
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy pain_reports_all on public.pain_reports
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

-- A swap must belong to a session of the same profile.
create policy exercise_swaps_all on public.exercise_swaps
for all to authenticated
using (public.can_access_profile(profile_id))
with check (
  public.can_access_profile(profile_id)
  and exists (
    select 1 from public.sessions s
    where s.id = exercise_swaps.session_id and s.profile_id = exercise_swaps.profile_id
  )
);
