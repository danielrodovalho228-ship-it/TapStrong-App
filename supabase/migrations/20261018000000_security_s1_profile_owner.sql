-- Security round 1, S1-01: a guardian could point a managed profile at
-- someone else's login (profiles.user_id) and keep reading and writing that
-- person's data through guardian_id. user_id may now only stay the same or
-- become the caller's own id; the trigger fires on every update, whatever the
-- column list. Server code (service role, no auth.uid()) is not limited here.
--
-- The inviter's view of referrals also exposed invited_user_id (a way to learn
-- another user's id): clients now read only the referral that invited them,
-- and inviters get counts and dates from my_referral_stats().

create function public.guard_profile_user_id() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if new.user_id is distinct from old.user_id
     and uid is not null
     and new.user_id is distinct from uid then
    raise exception 'a profile can only be linked to your own login' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_user_id() from public, anon, authenticated;

create trigger profiles_guard_user_id
before update on public.profiles
for each row execute function public.guard_profile_user_id();

-- The same rule in the policy itself: a row written by a client must end up
-- owned by the caller, or managed by the caller with no other login on it.
drop policy profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (user_id = (select auth.uid()) or guardian_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  or (guardian_id = (select auth.uid()) and user_id is null)
);

drop policy referrals_read_own on public.referrals;
create policy referrals_read_own on public.referrals
for select to authenticated
using (invited_user_id = (select auth.uid()));

-- Counts and dates only, never who was invited.
create function public.my_referral_stats()
returns table (invited integer, rewarded integer, last_invited_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (where r.inviter_rewarded)::integer,
         max(r.created_at)
  from public.referrals r
  join public.referral_codes c on c.code = r.code
  where c.user_id = (select auth.uid());
$$;

revoke all on function public.my_referral_stats() from public, anon;
grant execute on function public.my_referral_stats() to authenticated;
