-- Phase 9 — "Movement that hurts" (SPEC §8).
--
-- exercises: the joint movements each exercise needs, the movements it can do
-- in a shorter range, and whether it is a recovery-only exercise. Like the
-- muscle mapping, these tags are reviewed before release.
--
-- movement_pains: a person's report of which movements of a joint hurt,
-- with the traffic-light checks and weekly retests. Health data: RLS by
-- profile; never used for analytics.

alter table public.exercises
  add column joint_movements jsonb not null default '[]' check (jsonb_typeof(joint_movements) = 'array'),
  add column range_limit text[] not null default '{}',
  add column rehab boolean not null default false;

create table public.movement_pains (
  id uuid primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  area text not null check (
    area in ('neck', 'shoulder', 'elbow_wrist', 'lower_back', 'hip', 'knee', 'ankle_foot')
  ),
  side public.body_side,
  painful text[] not null check (cardinality(painful) between 1 and 20),
  pain_free text[] not null default '{}',
  score smallint not null check (score between 0 and 10),
  duration text not null check (
    duration in ('under_2_weeks', '2_6_weeks', '6_12_weeks', 'over_3_months')
  ),
  level smallint not null default 1 check (level between 1 and 6),
  active boolean not null default true,
  checks jsonb not null default '[]' check (jsonb_typeof(checks) = 'array'),
  retests jsonb not null default '[]' check (jsonb_typeof(retests) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index movement_pains_profile_idx on public.movement_pains (profile_id, created_at desc);

alter table public.movement_pains enable row level security;

create policy movement_pains_all on public.movement_pains
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));
