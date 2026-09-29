-- Security round 2, S2-P2-4: a teen could make themselves adult by moving
-- their birth date (birth_year = 1990, mode = 'adult') while keeping their
-- guardian; the coach trusts the stored birth date.
--
-- Now a profile that has a guardian, or is in teen / child mode, may change
-- its birth date only through its guardian, or only to a later date (a
-- younger age). Every birth date change is logged. The 60+ mode needs a
-- birth date of 60 or more.

create table public.profile_birth_changes (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  changed_by uuid,
  old_birth_year smallint,
  old_birth_month smallint,
  new_birth_year smallint,
  new_birth_month smallint,
  old_mode public.app_mode,
  new_mode public.app_mode,
  changed_at timestamptz not null default now()
);

create index profile_birth_changes_profile on public.profile_birth_changes (profile_id);

-- Written only by the trigger below. The profile's owner and guardian can
-- read its history; nobody can write or change it from the client.
alter table public.profile_birth_changes enable row level security;

create policy profile_birth_changes_select on public.profile_birth_changes
for select to authenticated
using (public.can_access_profile(profile_id));

revoke all on public.profile_birth_changes from anon, authenticated;
grant select on public.profile_birth_changes to authenticated;

create or replace function public.guard_profile_age_mode() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  years integer := public.profile_age(new.birth_year, new.birth_month);
  date_changed boolean := tg_op = 'UPDATE'
    and (new.birth_year is distinct from old.birth_year
         or new.birth_month is distinct from old.birth_month);
begin
  if tg_op = 'UPDATE' and not date_changed and new.mode is not distinct from old.mode then
    return new;
  end if;
  -- A minor's birth date moves earlier (older) only through the guardian.
  if date_changed and uid is not null
     and (old.guardian_id is not null or old.mode in ('teen', 'child'))
     and uid is distinct from old.guardian_id
     and make_date(new.birth_year, new.birth_month, 1)
         < make_date(old.birth_year, old.birth_month, 1) then
    raise exception 'only the guardian can make this birth date earlier'
      using errcode = '42501';
  end if;
  if years < 13 and new.mode <> 'child' then
    raise exception 'under 13 is a child profile, made with parental consent'
      using errcode = 'check_violation';
  end if;
  if years < 18 and new.mode in ('adult', 'senior') then
    raise exception 'a profile under 18 can never be adult'
      using errcode = 'check_violation';
  end if;
  if years < 60 and new.mode = 'senior' then
    raise exception 'the 60+ mode is for profiles aged 60 and over'
      using errcode = 'check_violation';
  end if;
  if date_changed then
    insert into public.profile_birth_changes
      (profile_id, changed_by, old_birth_year, old_birth_month, new_birth_year,
       new_birth_month, old_mode, new_mode)
    values
      (new.id, uid, old.birth_year, old.birth_month, new.birth_year, new.birth_month,
       old.mode, new.mode);
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_age_mode() from public, anon, authenticated;
