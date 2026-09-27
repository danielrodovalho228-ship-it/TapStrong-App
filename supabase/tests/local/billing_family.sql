-- Tests for subscriptions, Family limits and child consent (Phase 6).
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000f1', false), -- family on trial
  ('00000000-0000-0000-0000-0000000000f2', false), -- no plan
  ('00000000-0000-0000-0000-0000000000f3', false); -- family, charged

insert into public.subscriptions (user_id, plan, status, store, trial_ends_at, last_transaction_id)
values ('00000000-0000-0000-0000-0000000000f1', 'family', 'trial', 'test', now() + interval '5 days', 'tx-1');
insert into public.subscriptions (user_id, plan, status, store, first_charged_at, last_transaction_id)
values ('00000000-0000-0000-0000-0000000000f3', 'family', 'active', 'test', now(), 'tx-3');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$ begin
  -- Clients read only their own subscription and cannot write it.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
  assert (select count(*) from public.subscriptions) = 0, 'no plan: no row visible';
  begin
    insert into public.subscriptions (user_id, plan, status)
    values ('00000000-0000-0000-0000-0000000000f2', 'family', 'active');
    raise exception 'client granted itself a plan';
  exception when insufficient_privilege then null;
  end;

  -- Without a Family plan, no managed profiles.
  begin
    insert into public.profiles (guardian_id, birth_month, birth_year, body_band, mode)
    values ('00000000-0000-0000-0000-0000000000f2', 1, 1950, 'senior', 'senior');
    raise exception 'managed profile without Family plan';
  exception when insufficient_privilege then null;
  end;

  -- Trial: a 60+ parent profile is fine; a child is not (trial is not consent).
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
  assert (select count(*) from public.subscriptions) = 1, 'owner sees own subscription';
  insert into public.profiles (guardian_id, birth_month, birth_year, body_band, mode)
  values ('00000000-0000-0000-0000-0000000000f1', 1, 1950, 'senior', 'senior');
  begin
    perform public.create_child_profile(gen_random_uuid(), 5::smallint, 2016::smallint, 'f', 'Mia', 'parent-notice-v1');
    raise exception 'child profile during the free trial';
  exception when insufficient_privilege then null;
  end;

  -- A child profile cannot be inserted directly, even with a charged plan.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000f3');
  begin
    insert into public.profiles (guardian_id, birth_month, birth_year, body_band, mode)
    values ('00000000-0000-0000-0000-0000000000f3', 5, 2016, 'kid', 'child');
    raise exception 'child profile inserted without the consent function';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_child_profile(gen_random_uuid(), 5::smallint, 2016::smallint, 'f', 'Mia', '');
    raise exception 'child profile without accepting the notice';
  exception when invalid_parameter_value then null;
  end;

  -- With a charged Family plan and the notice: profile, consent and link.
  perform public.create_child_profile('20000000-0000-0000-0000-0000000000f3', 5::smallint, 2016::smallint, 'f', 'Mia', 'parent-notice-v1');
  assert (select count(*) from public.consent_records where child_profile_id = '20000000-0000-0000-0000-0000000000f3'
          and method = 'store_transaction' and transaction_ref = 'tx-3') = 1, 'consent recorded';
  assert (select count(*) from public.family_members where member_profile_id = '20000000-0000-0000-0000-0000000000f3'
          and consent_record_id is not null) = 1, 'family link with consent';

  -- QA B-01: the child's birth date can't move the profile out of kids mode.
  begin
    update public.profiles set birth_year = 2010, body_band = 'teen', mode = 'teen'
    where id = '20000000-0000-0000-0000-0000000000f3';
    raise exception 'child profile re-aged to teen';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set body_band = 'teen', mode = 'teen'
    where id = '20000000-0000-0000-0000-0000000000f3';
    raise exception 'child profile switched to teen mode before 13';
  exception when check_violation then null;
  end;
  -- A typo fix that keeps kids mode is fine.
  update public.profiles set birth_month = 6 where id = '20000000-0000-0000-0000-0000000000f3';

  -- Up to 5 profiles: the owner + 4 managed.
  insert into public.profiles (guardian_id, birth_month, birth_year, body_band, mode)
  select '00000000-0000-0000-0000-0000000000f3', 1, 1950, 'senior', 'senior' from generate_series(1, 3);
  begin
    insert into public.profiles (guardian_id, birth_month, birth_year, body_band, mode)
    values ('00000000-0000-0000-0000-0000000000f3', 1, 1950, 'senior', 'senior');
    raise exception 'a sixth profile was accepted';
  exception when check_violation then null;
  end;

  -- The stranger sees none of it.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
  assert (select count(*) from public.consent_records) = 0, 'stranger sees no consent records';
  assert (select count(*) from public.profiles where guardian_id = '00000000-0000-0000-0000-0000000000f3') = 0,
    'stranger sees no family profiles';
  execute 'reset role';
end $$;

-- Deleting the account removes everything that belongs to it (cascade).
do $$ begin
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f3';
  assert (select count(*) from public.profiles where guardian_id = '00000000-0000-0000-0000-0000000000f3') = 0, 'managed profiles gone';
  assert (select count(*) from public.consent_records where owner_id = '00000000-0000-0000-0000-0000000000f3') = 0, 'consent gone';
  assert (select count(*) from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000f3') = 0, 'subscription row gone';
end $$;

\echo 'billing_family: all assertions passed'
