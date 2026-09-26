-- RLS and child-data tests for the Phase 7 progress tables.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), -- adult
  ('00000000-0000-0000-0000-0000000000a2'), -- teen
  ('00000000-0000-0000-0000-0000000000a3'); -- stranger

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

-- Adults may store body measurements.
do $$ begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  insert into public.profiles (id, user_id, birth_month, birth_year, sex, body_band, mode)
  values ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 3, 1982, 'f', 'mid', 'adult');
  insert into public.checkins (profile_id, strength, waist_cm, weight_kg, whtr, bmi)
  values ('10000000-0000-0000-0000-0000000000a1', '[]', 84, 70, 0.51, 24.2);
  insert into public.repair_results (profile_id, test_key, left_value, right_value)
  values ('10000000-0000-0000-0000-0000000000a1', 'single_leg_balance', 22, 9);
  insert into public.repair_plans (profile_id, weeks, sessions_per_week, focus, retest_at)
  values ('10000000-0000-0000-0000-0000000000a1', 6, 2, '[{"muscleKey":"glutes","goal":"strengthen"}]', now() + interval '42 days');
  insert into public.sessions (profile_id, kind, status) values ('10000000-0000-0000-0000-0000000000a1', 'repair', 'planned');

  begin
    insert into public.repair_results (profile_id, test_key) values ('10000000-0000-0000-0000-0000000000a1', 'squat');
    raise exception 'empty repair result accepted';
  exception when check_violation then null;
  end;
end $$;

-- A teen gets strength only: body fields are refused.
do $$ begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  insert into public.profiles (id, user_id, birth_month, birth_year, sex, body_band, mode)
  values ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 5, 2011, 'm', 'teen', 'teen');
  insert into public.checkins (profile_id, strength)
  values ('10000000-0000-0000-0000-0000000000a2', '[{"exerciseId":"x","kind":"reps","change":2}]');
  begin
    insert into public.checkins (profile_id, waist_cm) values ('10000000-0000-0000-0000-0000000000a2', 70);
    raise exception 'teen waist accepted';
  exception when check_violation then null;
  end;
  begin
    update public.checkins set weight_kg = 50 where profile_id = '10000000-0000-0000-0000-0000000000a2';
    raise exception 'teen weight accepted on update';
  exception when check_violation then null;
  end;
  begin
    insert into public.checkins (profile_id, bmi) values ('10000000-0000-0000-0000-0000000000a2', 20);
    raise exception 'teen BMI accepted';
  exception when check_violation then null;
  end;
end $$;

-- RLS: strangers see nothing and cannot write to others' profiles.
do $$ begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
  assert (select count(*) from public.checkins) = 0, 'stranger sees no checkins';
  assert (select count(*) from public.repair_results) = 0, 'stranger sees no repair results';
  assert (select count(*) from public.repair_plans) = 0, 'stranger sees no repair plans';
  begin
    insert into public.checkins (profile_id) values ('10000000-0000-0000-0000-0000000000a1');
    raise exception 'stranger wrote a checkin';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  assert (select count(*) from public.checkins) = 1, 'adult sees only own checkin';
  assert (select count(*) from public.repair_results) = 1, 'adult sees own repair result';
end $$;

reset role;

\echo progress_repair: all assertions passed
