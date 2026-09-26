-- RLS tests for the foundations migration. Runs on plain Postgres after
-- auth_stub.sql + migrations (scripts/db-test.sh). Any failed assert aborts.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), -- parent A
  ('00000000-0000-0000-0000-00000000000b'); -- stranger B

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

-- Parent A has a charged Family plan (written by the webhook in production).
insert into public.subscriptions (user_id, plan, status, store, first_charged_at, last_transaction_id)
values ('00000000-0000-0000-0000-00000000000a', 'family', 'active', 'test', now(), 'tx-a');

-- Parent A creates own profile and a child profile (with consent, Phase 6).
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a'); end $$;

insert into public.profiles (id, user_id, birth_month, birth_year, sex, body_band, mode)
values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 4, 1988, 'f', 'adult', 'adult');

select public.create_child_profile('20000000-0000-0000-0000-00000000000c', 6::smallint, 2016::smallint, 'm', null, 'parent-notice-v1');

insert into public.restrictions (profile_id, area, source)
values ('20000000-0000-0000-0000-00000000000c', 'knees', 'manual');

insert into public.muscle_goals (profile_id, muscle_key, goal)
values ('10000000-0000-0000-0000-00000000000a', 'upperChest', 'grow');

do $$ begin
  assert (select count(*) from public.profiles) = 2, 'parent sees own + child profile';
  assert (select count(*) from public.restrictions) = 1, 'parent sees child restriction';
end $$;

-- Stranger B sees nothing and cannot write into A's family.
reset role;
do $$ begin perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b'); end $$;

do $$ begin
  assert (select count(*) from public.profiles) = 0, 'stranger sees no profiles';
  assert (select count(*) from public.restrictions) = 0, 'stranger sees no restrictions';
  assert (select count(*) from public.family_members) = 0, 'stranger sees no family links';
  assert (select count(*) from public.muscles) = 25, 'muscles are readable';
end $$;

do $$ begin
  begin
    insert into public.restrictions (profile_id, area, source)
    values ('20000000-0000-0000-0000-00000000000c', 'hips', 'manual');
    raise exception 'stranger inserted a restriction on a child profile';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.profiles (user_id, birth_month, birth_year, body_band, mode)
    values ('00000000-0000-0000-0000-00000000000a', 1, 1990, 'adult', 'adult');
    raise exception 'stranger created a profile for another user';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.family_members (owner_id, member_profile_id, role)
    values ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000c', 'child');
    raise exception 'stranger linked a child they do not guard';
  exception when insufficient_privilege then null;
  end;

  update public.profiles set display_name = 'x' where id = '20000000-0000-0000-0000-00000000000c';
  assert not found, 'stranger updated a child profile';

  begin
    insert into public.muscles (key, region, label_i18n_key) values ('fake', 'upper', 'x');
    raise exception 'client wrote to the muscles reference table';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Anonymous users see reference data only.
reset role;
set role anon;
do $$ begin
  assert (select count(*) from public.muscles) = 25, 'anon reads muscles';
end $$;
reset role;

-- Child-data constraints (checked as table owner, past the consent gate).
do $$ begin
  perform set_config('tapstrong.child_consent', 'granted', true);
  begin
    insert into public.profiles (user_id, birth_month, birth_year, body_band, mode)
    values ('00000000-0000-0000-0000-00000000000b', 1, 2016, 'kid', 'child');
    raise exception 'child profile without guardian was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.profiles (guardian_id, birth_month, birth_year, body_band, mode, weight_kg)
    values ('00000000-0000-0000-0000-00000000000a', 1, 2016, 'kid', 'child', 30);
    raise exception 'child profile with body measurements was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.profiles (user_id, birth_month, birth_year, body_band, mode, waist_cm)
    values ('00000000-0000-0000-0000-00000000000b', 1, 2011, 'teen', 'teen', 70);
    raise exception 'teen profile with waist measurement was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.profiles (user_id, birth_month, birth_year, body_band, mode)
    values ('00000000-0000-0000-0000-00000000000b', 1, 2016, 'kid', 'adult');
    raise exception 'kid band in adult mode was accepted';
  exception when check_violation then null;
  end;
end $$;

-- RLS is enabled on every public table.
do $$ begin
  assert not exists (
    select 1 from pg_tables where schemaname = 'public' and not rowsecurity
  ), 'a public table has RLS disabled';
end $$;

\echo 'rls_foundations: all assertions passed'
