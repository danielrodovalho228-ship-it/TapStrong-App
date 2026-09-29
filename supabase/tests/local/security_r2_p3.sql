-- Security round 2, P3 (database): a referral workout needs 10 real minutes
-- on the server; a guardian can't delete a teen's own-login profile;
-- clients can't call parent_pin_failed.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous, created_at, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000003a1', false, now(), now()), -- new user U
  ('00000000-0000-0000-0000-0000000003a2', false, now(), now()), -- guardian G
  ('00000000-0000-0000-0000-0000000003a3', false, now(), now()); -- teen T with own login
insert into public.subscriptions (user_id, plan, status, store, first_charged_at, last_transaction_id) values
  ('00000000-0000-0000-0000-0000000003a2', 'family', 'active', 'app_store', now(), 'tx-r2-p3');
insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003a1', 4, 1990, 'adult', 'adult'),
  ('00000000-0000-0000-0000-0000000003b2', '00000000-0000-0000-0000-0000000003a2', 4, 1980, 'adult', 'adult');
insert into public.profiles (id, user_id, guardian_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-0000000003b3', '00000000-0000-0000-0000-0000000003a3',
   '00000000-0000-0000-0000-0000000003a2', 3, extract(year from now())::smallint - 15, 'teen', 'teen'),
  ('00000000-0000-0000-0000-0000000003b4', null,
   '00000000-0000-0000-0000-0000000003a2', 3, extract(year from now())::smallint - 15, 'teen', 'teen');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.six_sets(session uuid, ex uuid) returns void language plpgsql as $$
declare
  item uuid;
begin
  insert into public.session_items (session_id, "order", exercise_id, role, part, sets)
  values (session, 0, ex, 'main', 'main', 6) returning id into item;
  for n in 1..6 loop
    insert into public.set_logs (session_item_id, exercise_id, set_no, reps) values (item, ex, n, 10);
  end loop;
end $$;

do $$
declare
  forged uuid := gen_random_uuid();
  real uuid := gen_random_uuid();
  ex uuid := (select id from public.exercises limit 1); -- read before switching role
begin
  -- The fake: a done workout with 25 client-side minutes, sent in one go,
  -- with forged server times.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000003a1');
  insert into public.sessions (id, profile_id, status, started_at, ended_at, received_at, done_received_at)
  values (forged, '00000000-0000-0000-0000-0000000003b1', 'done', now() - interval '25 minutes', now(),
          now() - interval '1 day', now());
  perform pg_temp.six_sets(forged, ex);
  assert (select received_at > now() - interval '1 minute' from public.sessions where id = forged),
    'client set received_at';
  -- Nor moved later.
  update public.sessions set received_at = now() - interval '1 day' where id = forged;
  assert (select received_at > now() - interval '1 minute' from public.sessions where id = forged),
    'client moved received_at';
  execute 'reset role';
  assert public.first_completed_workout('00000000-0000-0000-0000-0000000003a1') is null,
    'a workout sent in one go counted for the referral';

  -- The real one: sent when it starts, done 25 real minutes later.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000003a1');
  insert into public.sessions (id, profile_id, status, started_at)
  values (real, '00000000-0000-0000-0000-0000000003b1', 'active', now());
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  -- (the clock moves on: backdated by the server, not the client)
  update public.sessions set received_at = now() - interval '25 minutes' where id = real;
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000003a1');
  update public.sessions set status = 'done', started_at = now() - interval '25 minutes', ended_at = now()
  where id = real;
  perform pg_temp.six_sets(real, ex);
  execute 'reset role';
  assert public.first_completed_workout('00000000-0000-0000-0000-0000000003a1') is not null,
    'a real workout did not count';
end $$;

do $$
declare
  n integer;
begin
  -- A guardian can't delete a teen who has their own login…
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000003a2');
  delete from public.profiles where id = '00000000-0000-0000-0000-0000000003b3';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'guardian deleted a teen''s own-login profile'; end if;
  -- …but still removes a profile they manage without a login.
  delete from public.profiles where id = '00000000-0000-0000-0000-0000000003b4';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'guardian could not remove a managed profile'; end if;
  -- The teen still deletes their own.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000003a3');
  delete from public.profiles where id = '00000000-0000-0000-0000-0000000003b3';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'teen could not delete their own profile'; end if;

  -- parent_pin_failed is server-only now.
  begin
    perform public.parent_pin_failed();
    raise exception 'client called parent_pin_failed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  raise notice 'security_r2_p3: all assertions passed';
end $$;
