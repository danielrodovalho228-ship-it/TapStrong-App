-- Phase 7 — progress & Repair (SPEC §8 "Measurements", §9 Repair).
--
-- checkins: the 4-week check-in. Strength changes for everyone; body fields
-- (waist, weight, WHtR, BMI) for adult and 60+ profiles only (SPEC §2.3).
-- The rule is enforced here too, not only in the app, so a child or teen row
-- can never hold body data. Before/after photos are never stored server-side.
--
-- repair_results: one row per Repair check test taken.
-- repair_plans: the 6-week plan built from a check.

alter type public.session_kind add value if not exists 'repair';

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  taken_at timestamptz not null default now(),
  strength jsonb not null default '[]' check (jsonb_typeof(strength) = 'array'),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 20 and 350),
  whtr numeric(4, 2) check (whtr between 0.2 and 1.5),
  bmi numeric(4, 1) check (bmi between 8 and 90),
  created_at timestamptz not null default now()
);

create index checkins_profile_idx on public.checkins (profile_id, taken_at desc);

create function public.guard_checkin_body_fields() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_mode public.app_mode;
begin
  if new.waist_cm is null and new.weight_kg is null and new.whtr is null and new.bmi is null then
    return new;
  end if;
  select p.mode into profile_mode from public.profiles p where p.id = new.profile_id;
  if profile_mode is null or profile_mode not in ('adult', 'senior') then
    raise exception 'body measurements are for adult profiles only'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke all on function public.guard_checkin_body_fields() from public, anon, authenticated;

create trigger checkins_body_fields
before insert or update on public.checkins
for each row execute function public.guard_checkin_body_fields();

create table public.repair_results (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  test_key text not null check (test_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  value smallint check (value between 0 and 600),
  left_value smallint check (left_value between 0 and 600),
  right_value smallint check (right_value between 0 and 600),
  pass_left boolean,
  pass_right boolean,
  tested_at timestamptz not null default now(),
  check (
    value is not null
    or (left_value is not null and right_value is not null)
    or (pass_left is not null and pass_right is not null)
  )
);

create index repair_results_profile_idx on public.repair_results (profile_id, tested_at desc);

create table public.repair_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weeks smallint not null check (weeks between 1 and 12),
  sessions_per_week smallint not null check (sessions_per_week between 1 and 7),
  focus jsonb not null check (jsonb_typeof(focus) = 'array'),
  retest_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index repair_plans_profile_idx on public.repair_plans (profile_id, created_at desc);

alter table public.checkins enable row level security;
alter table public.repair_results enable row level security;
alter table public.repair_plans enable row level security;

create policy checkins_all on public.checkins
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy repair_results_all on public.repair_results
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

create policy repair_plans_all on public.repair_plans
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));
