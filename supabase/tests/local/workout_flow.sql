-- RLS and constraint tests for the Phase 4 workout tables.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000d1'), -- owner
  ('00000000-0000-0000-0000-0000000000d2'); -- stranger

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

-- Owner logs a workout.
do $$
declare
  ex uuid := (select id from public.exercises where slug = 'push_up');
  ex2 uuid := (select id from public.exercises where slug = 'march_in_place');
  sid uuid;
  iid uuid;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
  insert into public.profiles (id, user_id, birth_month, birth_year, sex, body_band, mode)
  values ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', 1, 1985, 'm', 'adult', 'adult');

  insert into public.sessions (profile_id, status, minutes, started_at)
  values ('10000000-0000-0000-0000-0000000000d1', 'active', 40, now())
  returning id into sid;

  insert into public.session_items (session_id, "order", exercise_id, role, part, target_muscle, goal, sets, reps_min, reps_max, rest_s, load_hint)
  values (sid, 0, ex, 'main', 'main', 'midChest', 'grow', 3, 8, 12, 75, 'bodyweight')
  returning id into iid;

  insert into public.set_logs (session_item_id, exercise_id, set_no, reps) values (iid, ex, 1, 10);
  insert into public.exercise_swaps (profile_id, session_id, item_order, from_exercise_id, to_exercise_id, reason, sets_done_before)
  values ('10000000-0000-0000-0000-0000000000d1', sid, 0, ex, ex2, 'user_choice', 1);
  insert into public.pain_reports (profile_id, session_id, exercise_id, area, side, type, action_taken)
  values ('10000000-0000-0000-0000-0000000000d1', sid, ex, 'shoulder', 'right', 'dull', 'swapped');
  insert into public.streaks (profile_id, current, best, freezes_available, last_active_date)
  values ('10000000-0000-0000-0000-0000000000d1', 1, 1, 0, current_date);
  insert into public.muscle_activity (profile_id, muscle_key, last_trained_at, volume_7d)
  values ('10000000-0000-0000-0000-0000000000d1', 'midChest', now(), 1);

  assert (select count(*) from public.set_logs) = 1, 'owner sees own set log';
  assert (select count(*) from public.exercise_swaps) = 1, 'owner sees own swap';

  -- Constraints.
  begin
    insert into public.session_items (session_id, "order", exercise_id, role, part, sets, reps_min, reps_max)
    values (sid, 1, ex, 'main', 'main', 3, 12, 8);
    raise exception 'reps_min > reps_max was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.streaks set freezes_available = 3;
    raise exception 'more than 2 freezes was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.exercise_swaps (profile_id, session_id, item_order, from_exercise_id, to_exercise_id, reason)
    values ('10000000-0000-0000-0000-0000000000d1', sid, 0, ex, ex, 'user_choice');
    raise exception 'a swap to the same exercise was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.set_logs (session_item_id, exercise_id, set_no, reps) values (iid, ex, 1, 9);
    raise exception 'a duplicate set number was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.set_logs (session_item_id, exercise_id, set_no, load) values (iid, ex, 2, 20);
    raise exception 'a load without a unit was accepted';
  exception when check_violation then null;
  end;
end $$;

-- Stranger sees nothing and cannot write into the owner's workout.
do $$
declare
  ex uuid := (select id from public.exercises where slug = 'push_up');
  sid uuid;
  iid uuid;
begin
  execute 'reset role';
  select id into sid from public.sessions where profile_id = '10000000-0000-0000-0000-0000000000d1';
  select id into iid from public.session_items where session_id = sid;

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
  assert (select count(*) from public.sessions) = 0, 'stranger sees no sessions';
  assert (select count(*) from public.session_items) = 0, 'stranger sees no items';
  assert (select count(*) from public.set_logs) = 0, 'stranger sees no set logs';
  assert (select count(*) from public.pain_reports) = 0, 'stranger sees no pain reports';
  assert (select count(*) from public.exercise_swaps) = 0, 'stranger sees no swaps';
  assert (select count(*) from public.streaks) = 0, 'stranger sees no streaks';
  assert (select count(*) from public.muscle_activity) = 0, 'stranger sees no muscle activity';

  begin
    insert into public.set_logs (session_item_id, exercise_id, set_no, reps) values (iid, ex, 3, 10);
    raise exception 'stranger logged a set in another user''s workout';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.session_items (session_id, "order", exercise_id, role, part, sets)
    values (sid, 5, ex, 'main', 'main', 3);
    raise exception 'stranger added an item to another user''s workout';
  exception when insufficient_privilege then null;
  end;

  -- Stranger's own profile cannot claim the owner's session for a swap.
  insert into public.profiles (id, user_id, birth_month, birth_year, sex, body_band, mode)
  values ('10000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d2', 1, 1990, 'f', 'adult', 'adult');
  begin
    insert into public.exercise_swaps (profile_id, session_id, item_order, from_exercise_id, to_exercise_id, reason)
    values ('10000000-0000-0000-0000-0000000000d2', sid, 0, ex,
            (select id from public.exercises where slug = 'march_in_place'), 'user_choice');
    raise exception 'a swap was attached to another profile''s session';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

\echo workout_flow: all assertions passed
