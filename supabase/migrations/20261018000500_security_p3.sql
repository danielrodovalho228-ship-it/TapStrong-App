-- Security round 1, P3.
--
-- Referral farming: a referral is redeemed only by a saved account with a
-- confirmed email, within 14 days of creating it; a "completed workout" for
-- the reward needs at least 6 logged sets over 10 minutes or more; the
-- inviter's yearly cap is checked and taken in one locked step.
--
-- Account deletion: a teen with their own login keeps their profile when the
-- guardian deletes their account (guardian_id is cleared); managed profiles
-- without a login are still deleted with the guardian.

create or replace function public.redeem_referral(referral_code text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  owner uuid;
  me record;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select u.is_anonymous, u.email_confirmed_at, u.created_at into me from auth.users u where u.id = uid;
  if coalesce(me.is_anonymous, true) or me.email_confirmed_at is null
     or me.created_at < now() - interval '14 days' then
    return false;
  end if;
  select c.user_id into owner from public.referral_codes c where c.code = upper(referral_code);
  if owner is null or owner = uid then
    return false;
  end if;
  insert into public.referrals (code, invited_user_id)
  values (upper(referral_code), uid)
  on conflict (invited_user_id) do nothing;
  return found;
end;
$$;

revoke all on function public.redeem_referral(text) from public, anon;
grant execute on function public.redeem_referral(text) to authenticated;

create or replace function public.first_completed_workout(uid uuid) returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(s.ended_at)
  from public.sessions s
  join public.profiles p on p.id = s.profile_id
  where p.user_id = uid
    and s.status = 'done'
    and s.started_at is not null
    and s.ended_at >= s.started_at + interval '10 minutes'
    and (select count(*) from public.set_logs l
         join public.session_items i on i.id = l.session_item_id
         where i.session_id = s.id) >= 6;
$$;

revoke all on function public.first_completed_workout(uuid) from public, anon, authenticated;

-- Takes one of the inviter's yearly reward weeks, or returns false when the
-- cap is reached. The code row is locked so two claims can't both pass.
create function public.claim_inviter_reward(referral_id uuid, yearly_cap integer) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_code text;
  used integer;
begin
  select r.code into ref_code from public.referrals r where r.id = referral_id;
  if ref_code is null then
    return false;
  end if;
  perform 1 from public.referral_codes c where c.code = ref_code for update;
  select count(*) into used from public.referrals r
  where r.code = ref_code and r.inviter_rewarded and r.inviter_rewarded_at > now() - interval '365 days';
  if used >= yearly_cap then
    return false;
  end if;
  update public.referrals
    set inviter_rewarded = true, inviter_rewarded_at = now()
    where id = referral_id and not inviter_rewarded;
  return found;
end;
$$;

-- Gives the week back when granting it failed.
create function public.release_inviter_reward(referral_id uuid) returns void
language sql
security definer
set search_path = ''
as $$
  update public.referrals
    set inviter_rewarded = false, inviter_rewarded_at = null, reward_error = 'grant_inviter_failed'
    where id = referral_id;
$$;

revoke all on function public.claim_inviter_reward(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_inviter_reward(uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.first_completed_workout(uuid) to service_role;
    grant execute on function public.claim_inviter_reward(uuid, integer) to service_role;
    grant execute on function public.release_inviter_reward(uuid) to service_role;
  end if;
end $$;

-- Account deletion keeps a teen's own profile.
alter table public.profiles drop constraint profiles_guardian_id_fkey;
alter table public.profiles
  add constraint profiles_guardian_id_fkey
  foreign key (guardian_id) references auth.users (id) on delete set null;

create function public.delete_managed_profiles() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Profiles with no login of their own go with their guardian; the others
  -- keep going, with guardian_id cleared by the foreign key.
  delete from public.profiles p where p.guardian_id = old.id and p.user_id is null;
  return old;
end;
$$;

revoke all on function public.delete_managed_profiles() from public, anon, authenticated;

create trigger users_delete_managed_profiles
before delete on auth.users
for each row execute function public.delete_managed_profiles();

-- The guardian's own account being deleted clears guardian_id through the
-- foreign key: that is not a client changing it (S2-02 still holds).
create or replace function public.guard_profile_guardian() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is not null and new.guardian_id is distinct from old.guardian_id
     and (old.guardian_id is distinct from uid or new.guardian_id is not null)
     and not (new.guardian_id is null
              and not exists (select 1 from auth.users u where u.id = old.guardian_id)) then
    raise exception 'only the current guardian can change who manages a profile'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_guardian() from public, anon, authenticated;
