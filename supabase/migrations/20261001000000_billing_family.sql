-- Phase 6 — payments and family (SPEC §8 "Paywall & account", §2.3).
--
-- * subscriptions: the store truth, written only by the RevenueCat webhook
--   Edge Function (service role). Clients read their own row.
-- * Family plan: up to 5 profiles (the owner + 4 managed), Daniel Sep 2026.
-- * Children under 13 (COPPA): a child profile can only be created through
--   create_child_profile(), which requires a Family plan that has already
--   been CHARGED (the store transaction is the verifiable consent method —
--   a free trial does not count) and the parent's acceptance of the notice.
-- * referrals: the 1-week reward for both people is granted once, after the
--   invited person completes a first workout (referral-reward function).

create type public.plan_kind as enum ('free', 'premium', 'family');
create type public.subscription_status as enum ('trial', 'active', 'grace', 'expired');

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan public.plan_kind not null default 'free',
  status public.subscription_status not null default 'expired',
  product_id text,
  store text check (store in ('app_store', 'play_store', 'promotional', 'test')),
  trial_ends_at timestamptz,
  expires_at timestamptz,
  will_renew boolean not null default false,
  -- First paid (non-trial) period: evidence for the COPPA consent method.
  first_charged_at timestamptz,
  last_transaction_id text,
  last_event_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy subscriptions_read_own on public.subscriptions
for select to authenticated
using (user_id = (select auth.uid()));

revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- Family plan in force (trial, paid or grace period) for a user.
create function public.has_family_plan(uid uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.plan = 'family'
      and s.status in ('trial', 'active', 'grace')
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

-- Family plan that has been charged at least once (COPPA consent evidence).
create function public.family_plan_charged(uid uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.plan = 'family'
      and s.status in ('active', 'grace')
      and s.first_charged_at is not null
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

revoke all on function public.has_family_plan(uuid) from public, anon, authenticated;
revoke all on function public.family_plan_charged(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- consent_records — verifiable parental consent (COPPA).
-- ---------------------------------------------------------------------------

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  child_profile_id uuid not null unique references public.profiles (id) on delete cascade,
  method text not null check (method in ('store_transaction')),
  transaction_ref text not null,
  notice_version text not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.consent_records enable row level security;

create policy consent_records_read_own on public.consent_records
for select to authenticated
using (owner_id = (select auth.uid()));

revoke insert, update, delete on public.consent_records from anon, authenticated;

alter table public.family_members
  add constraint family_members_consent_fk
  foreign key (consent_record_id) references public.consent_records (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Managed profiles: Family plan only, at most 4 besides the owner, and a
-- child profile only through create_child_profile().
-- ---------------------------------------------------------------------------

create function public.guard_managed_profiles() returns trigger
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

create trigger profiles_guard_managed
before insert or update of mode, guardian_id on public.profiles
for each row execute function public.guard_managed_profiles();

-- Creates a child profile with its consent record and family link, in one step.
create function public.create_child_profile(
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

-- ---------------------------------------------------------------------------
-- Referral reward bookkeeping (granted by the referral-reward function).
-- ---------------------------------------------------------------------------

-- Each person gets the week once: the invited person once (one referral per
-- user), and the inviter once in total (inviter_rewarded on the first one).
alter table public.referrals
  add column rewarded_at timestamptz,
  add column inviter_rewarded boolean not null default false,
  add column reward_error text;

-- The invited person's first completed workout, if any (service role only).
create function public.first_completed_workout(uid uuid) returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(s.ended_at)
  from public.sessions s
  join public.profiles p on p.id = s.profile_id
  where p.user_id = uid and s.status = 'done';
$$;

revoke all on function public.first_completed_workout(uuid) from public, anon, authenticated;

-- The referral-reward function (service role) calls it.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.first_completed_workout(uuid) to service_role;
  end if;
end $$;
