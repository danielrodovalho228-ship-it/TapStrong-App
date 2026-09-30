-- Phase 27 (C): Moments, the small surprises. One row per Moment a profile
-- has seen (so it never repeats), with its date, the workout it closed and
-- the answer to the coach's question ("did today go well?"). Only ids and
-- kinds: no free text, no weights, no body data. Same access as the other
-- progress tables: the profile's owner or guardian (can_access_profile).

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  moment_id text not null check (length(moment_id) between 1 and 80 and moment_id ~ '^[a-z0-9_:.-]+$'),
  kind text not null check (kind in (
    'first_workout', 'first_back', 'first_mobility', 'first_week',
    'map_new_muscle', 'map_all_back',
    'milestone_workouts', 'milestone_reps', 'milestone_sets',
    'fact', 'coach_pain', 'birthday', 'app_month', 'app_year',
    'repair_even', 'month_highlight'
  )),
  shown_at timestamptz not null,
  workout_id uuid,
  answer text check (answer in ('good', 'not_yet')),
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, moment_id)
);

create index moments_profile_idx on public.moments (profile_id, shown_at desc);

alter table public.moments enable row level security;

create policy moments_all on public.moments
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

revoke all on public.moments from anon;
