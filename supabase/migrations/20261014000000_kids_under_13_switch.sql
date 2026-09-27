-- Phase 12 (Daniel): children under 13 are OFF for launch. The database has
-- its own switch, so a child profile can't be created even by a modified
-- app. Turn it on for version 2 (after the lawyer's review) together with
-- EXPO_PUBLIC_KIDS_UNDER_13_ENABLED=true:
--   update public.app_settings set value = 'true' where key = 'kids_under_13_enabled';

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- No policies: clients never read or write it; security-definer functions do.
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value) values ('kids_under_13_enabled', 'false');

create function public.kids_under_13_enabled() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.value)::text::boolean from public.app_settings s where s.key = 'kids_under_13_enabled'),
    false
  );
$$;

revoke all on function public.kids_under_13_enabled() from public, anon, authenticated;

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
  if not public.kids_under_13_enabled() then
    raise exception 'child profiles under 13 are not available' using errcode = '42501';
  end if;
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
