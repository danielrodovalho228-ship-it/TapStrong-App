-- Phase 10 — QA round 1, P0 safety fixes.
--
-- B-01: a child profile (under 13, created with parental consent) can't be
-- moved out of kids mode by editing its birth date. It becomes a teen only
-- when the stored birth date really reaches 13.
-- C-02: red-flag restrictions ("Doctor first") get their own source.

alter type public.restriction_source add value if not exists 'doctor';

create function public.guard_child_age() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.mode = 'child' then
    if new.birth_year is distinct from old.birth_year
       or new.birth_month is distinct from old.birth_month then
      if new.mode <> 'child' then
        raise exception 'a child profile birth date cannot move it out of kids mode'
          using errcode = 'check_violation';
      end if;
    end if;
    if new.mode <> 'child'
       and make_date(old.birth_year, old.birth_month, 1) + interval '13 years' > current_date then
      raise exception 'a child profile stays in kids mode until 13'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.guard_child_age() from public, anon, authenticated;

create trigger profiles_child_age
before update on public.profiles
for each row execute function public.guard_child_age();
