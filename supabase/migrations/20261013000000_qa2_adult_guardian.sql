-- QA round 2 (R2-04): only an adult (18+) can manage family profiles or give
-- parental consent. The guardian's own profile (user_id = auth user) must
-- exist and show an age of 18 or more.

create function public.is_adult_owner(uid uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = uid
      and make_date(p.birth_year, p.birth_month, 1) + interval '18 years' <= current_date
  );
$$;

revoke all on function public.is_adult_owner(uuid) from public, anon, authenticated;

create or replace function public.guard_managed_profiles() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mode = 'child'
     and (tg_op = 'INSERT' or old.mode is distinct from 'child')
     and coalesce(current_setting('tapstrong.child_consent', true), '') <> 'granted' then
    raise exception 'child profiles need verified parental consent' using errcode = '42501';
  end if;

  if new.guardian_id is not null and (tg_op = 'INSERT' or old.guardian_id is distinct from new.guardian_id) then
    if not public.is_adult_owner(new.guardian_id) then
      raise exception 'only an adult can manage family profiles' using errcode = '42501';
    end if;
    if not public.has_family_plan(new.guardian_id) then
      raise exception 'managed profiles need the Family plan' using errcode = '42501';
    end if;
    if (select count(*) from public.profiles p where p.guardian_id = new.guardian_id) >= 4 then
      raise exception 'the Family plan holds up to 5 profiles' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_managed_profiles() from public, anon, authenticated;

create or replace function public.create_child_profile(
  profile_id uuid,
  birth_month smallint,
  birth_year smallint,
  sex public.sex,
  display_name text,
  notice_version text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  tx text;
  consent uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce((select u.is_anonymous from auth.users u where u.id = uid), false) then
    raise exception 'save your account first' using errcode = '42501';
  end if;
  if not public.is_adult_owner(uid) then
    raise exception 'only an adult can give parental consent' using errcode = '42501';
  end if;
  if not public.family_plan_charged(uid) then
    raise exception 'a charged Family plan is required' using errcode = '42501';
  end if;
  if notice_version is null or length(notice_version) = 0 then
    raise exception 'the parent notice must be accepted' using errcode = '22023';
  end if;

  select s.last_transaction_id into tx from public.subscriptions s where s.user_id = uid;

  perform set_config('tapstrong.child_consent', 'granted', true);
  insert into public.profiles (id, guardian_id, display_name, birth_month, birth_year, sex, body_band, mode)
  values (profile_id, uid, display_name, birth_month, birth_year, sex, 'kid', 'child');
  perform set_config('tapstrong.child_consent', '', true);

  insert into public.consent_records (owner_id, child_profile_id, method, transaction_ref, notice_version)
  values (uid, profile_id, 'store_transaction', coalesce(tx, 'unknown'), notice_version)
  returning id into consent;

  insert into public.family_members (owner_id, member_profile_id, role, consent_record_id)
  values (uid, profile_id, 'child', consent);
  return profile_id;
end;
$$;

revoke all on function public.create_child_profile(uuid, smallint, smallint, public.sex, text, text) from public, anon;
grant execute on function public.create_child_profile(uuid, smallint, smallint, public.sex, text, text) to authenticated;
