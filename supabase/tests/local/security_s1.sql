-- Security round 1, S1-01: no profile can be pointed at someone else's login,
-- and inviters can't learn who they invited.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-00000000e5a1', false), -- guardian (Family plan)
  ('00000000-0000-0000-0000-00000000e5a2', false), -- victim
  ('00000000-0000-0000-0000-00000000e5a3', false); -- stranger

insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-00000000e5b1', '00000000-0000-0000-0000-00000000e5a1', 4, 1985, 'adult', 'adult'),
  ('00000000-0000-0000-0000-00000000e5b2', '00000000-0000-0000-0000-00000000e5a2', 4, 1990, 'adult', 'adult');
insert into public.subscriptions (user_id, plan, status, store, first_charged_at, last_transaction_id)
values ('00000000-0000-0000-0000-00000000e5a1', 'family', 'active', 'app_store', now(), 'tx-e5');
-- A managed adult profile (60+ parent) guarded by e5a1.
insert into public.profiles (id, guardian_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-00000000e5b3', '00000000-0000-0000-0000-00000000e5a1', 2, 1950, 'senior', 'senior');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$ begin
  -- The guardian can't hand the managed profile to the victim's login.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e5a1');
  begin
    update public.profiles set user_id = '00000000-0000-0000-0000-00000000e5a2'
    where id = '00000000-0000-0000-0000-00000000e5b3';
    raise exception 'guardian linked a managed profile to another login';
  exception when insufficient_privilege then null;
  end;
  -- Nor with other columns in the same update (the trigger fires on any update).
  begin
    update public.profiles set user_id = '00000000-0000-0000-0000-00000000e5a2', units = 'metric'
    where id = '00000000-0000-0000-0000-00000000e5b3';
    raise exception 'guardian linked a managed profile to another login (multi-column)';
  exception when insufficient_privilege then null;
  end;
  -- Nor move their own profile onto the victim.
  begin
    update public.profiles set user_id = '00000000-0000-0000-0000-00000000e5a2'
    where id = '00000000-0000-0000-0000-00000000e5b1';
    raise exception 'user moved their profile to another login';
  exception when insufficient_privilege or unique_violation then null;
  end;
  -- Normal edits still work.
  update public.profiles set units = 'metric' where id = '00000000-0000-0000-0000-00000000e5b3';
  assert (select units from public.profiles where id = '00000000-0000-0000-0000-00000000e5b3') = 'metric',
    'guardian could not edit the managed profile';

  -- The victim still finds only their own profile by user_id.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e5a2');
  assert (select count(*) from public.profiles where user_id = '00000000-0000-0000-0000-00000000e5a2') = 1,
    'victim sees a planted profile';
  update public.profiles set units = 'metric' where id = '00000000-0000-0000-0000-00000000e5b2';

  -- A stranger can't read or change the managed profile.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e5a3');
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000e5b3') = 0,
    'stranger reads a managed profile';
  update public.profiles set user_id = '00000000-0000-0000-0000-00000000e5a3'
  where id = '00000000-0000-0000-0000-00000000e5b3';
  execute 'reset role';
  assert (select user_id from public.profiles where id = '00000000-0000-0000-0000-00000000e5b3') is null,
    'stranger claimed a managed profile';
end $$;

-- Referrals: the inviter sees counts, never who.
insert into public.referral_codes (user_id, code) values ('00000000-0000-0000-0000-00000000e5a1', 'E5CODE22');
insert into public.referrals (code, invited_user_id) values ('E5CODE22', '00000000-0000-0000-0000-00000000e5a2');

do $$
declare
  stats record;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e5a1');
  assert (select count(*) from public.referrals) = 0, 'inviter reads invited_user_id';
  select * into stats from public.my_referral_stats();
  assert stats.invited = 1 and stats.rewarded = 0 and stats.last_invited_at is not null,
    'referral stats wrong';
  -- The invited person still sees their own referral.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e5a2');
  assert (select count(*) from public.referrals) = 1, 'invited user lost their referral';
  select * into stats from public.my_referral_stats();
  assert stats.invited = 0, 'stats leak to the invited user';
  execute 'reset role';
  -- Server code (no auth.uid()) may still relink, e.g. support tooling.
  update public.profiles set user_id = null, guardian_id = '00000000-0000-0000-0000-00000000e5a1'
  where id = '00000000-0000-0000-0000-00000000e5b3';
end $$;

select 'security_s1: all assertions passed';
