-- Phase 5 — account & growth (SPEC §7, §12): referral codes, referrals and
-- badges. Accounts themselves are Supabase Auth users: the anonymous user
-- created for the coach is upgraded in place when the person saves progress.

-- ---------------------------------------------------------------------------
-- referral_codes — one short code per signed-up user.
-- ---------------------------------------------------------------------------

create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{6,10}$'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- referrals — who joined with whose link. Rewards (free weeks) are granted by
-- the payments phase; this table only records the link.
-- ---------------------------------------------------------------------------

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.referral_codes (code) on delete cascade,
  invited_user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index referrals_code_idx on public.referrals (code);

-- ---------------------------------------------------------------------------
-- badges — milestones earned (mockup 24).
-- ---------------------------------------------------------------------------

create table public.badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  key text not null check (key in ('first_workout', 'streak_7', 'streak_30', 'first_pr', 'full_body_week')),
  earned_at timestamptz not null default now(),
  primary key (profile_id, key)
);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.badges enable row level security;

-- Codes and referrals are written only through the functions below.
create policy referral_codes_read_own on public.referral_codes
for select to authenticated
using (user_id = (select auth.uid()));

create policy referrals_read_own on public.referrals
for select to authenticated
using (
  invited_user_id = (select auth.uid())
  or code in (select c.code from public.referral_codes c where c.user_id = (select auth.uid()))
);

revoke insert, update, delete on public.referral_codes, public.referrals from anon, authenticated;

create policy badges_all on public.badges
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

-- ---------------------------------------------------------------------------
-- my_referral_code() — returns the caller's code, creating it on first use.
-- Only for saved accounts (not anonymous users) and not for child profiles
-- (no social sharing under 13, SPEC §2.3).
-- ---------------------------------------------------------------------------

create function public.my_referral_code() returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  attempt int := 0;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce((select u.is_anonymous from auth.users u where u.id = uid), false) then
    raise exception 'save your account first' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.user_id = uid and p.mode = 'child') then
    raise exception 'no referral links for child profiles' using errcode = '42501';
  end if;

  select c.code into result from public.referral_codes c where c.user_id = uid;
  if result is not null then
    return result;
  end if;

  loop
    attempt := attempt + 1;
    result := '';
    for i in 1..7 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.referral_codes (user_id, code) values (uid, result);
      return result;
    exception when unique_violation then
      if attempt > 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- redeem_referral(code) — records that the caller joined with a link.
-- Once per user, never with one's own code. Unknown codes are ignored.
-- ---------------------------------------------------------------------------

create function public.redeem_referral(referral_code text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  owner uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
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

revoke all on function public.my_referral_code() from public, anon;
revoke all on function public.redeem_referral(text) from public, anon;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.redeem_referral(text) to authenticated;
