-- Security round 1, S2-01 / S2-02 / S2-03.
--
-- S2-01: a user could put their own profile under a stranger's Family plan
-- (guardian_id = any adult). S2-02: a teen with their own login could remove
-- their guardian. Now only the current guardian may change guardian_id (to
-- clear it); nobody can set someone else as guardian from the client. Linking
-- an adult who has their own login needs an invite/accept flow (not built).
--
-- S2-03: the age mode is tied to the birth date on the server: under 13 is
-- always a child profile, under 18 never adult or 60+. Body measurements on
-- check-ins follow the age from the birth date, not the editable mode.

create function public.profile_age(birth_year smallint, birth_month smallint) returns integer
language sql
stable
set search_path = ''
as $$
  select extract(year from age(current_date, make_date(birth_year, birth_month, 1)))::integer;
$$;

revoke all on function public.profile_age(smallint, smallint) from public, anon;
grant execute on function public.profile_age(smallint, smallint) to authenticated;

create function public.guard_profile_guardian() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is not null and new.guardian_id is distinct from old.guardian_id
     and (old.guardian_id is distinct from uid or new.guardian_id is not null) then
    raise exception 'only the current guardian can change who manages a profile'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_guardian() from public, anon, authenticated;

create trigger profiles_guard_guardian
before update on public.profiles
for each row execute function public.guard_profile_guardian();

-- Insert: your own profile with no guardian, or a managed one you guard.
drop policy profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
for insert to authenticated
with check (
  (user_id = (select auth.uid()) and guardian_id is null)
  or (user_id is null and guardian_id = (select auth.uid()))
);

create function public.guard_profile_age_mode() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  years integer := public.profile_age(new.birth_year, new.birth_month);
begin
  if tg_op = 'UPDATE'
     and new.birth_year is not distinct from old.birth_year
     and new.birth_month is not distinct from old.birth_month
     and new.mode is not distinct from old.mode then
    return new;
  end if;
  if years < 13 and new.mode <> 'child' then
    raise exception 'under 13 is a child profile, made with parental consent'
      using errcode = 'check_violation';
  end if;
  if years < 18 and new.mode in ('adult', 'senior') then
    raise exception 'a profile under 18 can never be adult'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_age_mode() from public, anon, authenticated;

create trigger profiles_guard_age_mode
before insert or update on public.profiles
for each row execute function public.guard_profile_age_mode();

create or replace function public.guard_checkin_body_fields() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_mode public.app_mode;
  b_year integer;
  b_month integer;
begin
  if new.waist_cm is null and new.weight_kg is null and new.whtr is null and new.bmi is null then
    return new;
  end if;
  select p.mode, p.birth_year, p.birth_month into profile_mode, b_year, b_month
  from public.profiles p where p.id = new.profile_id;
  -- The age from the birth date decides, not only the (editable) mode (S2-03).
  if profile_mode is null or profile_mode not in ('adult', 'senior')
     or public.profile_age(b_year::smallint, b_month::smallint) < 18 then
    raise exception 'body measurements are for adult profiles only'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke all on function public.guard_checkin_body_fields() from public, anon, authenticated;
