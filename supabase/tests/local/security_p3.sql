-- Security round 1, P3: referral farming, the inviter cap, and account
-- deletion keeping a teen's own profile.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous, created_at, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000f3a1', false, now(), now()),                     -- inviter
  ('00000000-0000-0000-0000-00000000f3a2', false, now(), now()),                     -- new, confirmed
  ('00000000-0000-0000-0000-00000000f3a3', false, now(), null),                      -- unconfirmed
  ('00000000-0000-0000-0000-00000000f3a4', false, now() - interval '30 days', now()), -- old account
  ('00000000-0000-0000-0000-00000000f3a5', true, now(), null),                       -- anonymous
  ('00000000-0000-0000-0000-00000000f3a6', false, now(), now()),                     -- guardian
  ('00000000-0000-0000-0000-00000000f3a7', false, now(), now());                     -- teen with login

insert into public.referral_codes (user_id, code) values ('00000000-0000-0000-0000-00000000f3a1', 'FARM2345');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$ begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000f3a3');
  assert public.redeem_referral('FARM2345') = false, 'unconfirmed email redeemed';
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000f3a4');
  assert public.redeem_referral('FARM2345') = false, 'a 30-day-old account redeemed';
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000f3a5');
  assert public.redeem_referral('FARM2345') = false, 'anonymous account redeemed';
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000f3a2');
  assert public.redeem_referral('FARM2345') = true, 'a new confirmed account redeems';
  execute 'reset role';
end $$;

-- A "completed workout" needs 6 logged sets over 10 minutes.
insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode)
values ('00000000-0000-0000-0000-00000000f3b2', '00000000-0000-0000-0000-00000000f3a2', 4, 1990, 'adult', 'adult');

do $$
declare
  ex uuid := (select id from public.exercises limit 1);
  quick uuid := gen_random_uuid();
  real uuid := gen_random_uuid();
  item uuid;
begin
  -- Marked done, 2 minutes, 1 set: not a workout.
  insert into public.sessions (id, profile_id, status, started_at, ended_at)
  values (quick, '00000000-0000-0000-0000-00000000f3b2', 'done', now() - interval '2 minutes', now());
  insert into public.session_items (session_id, "order", exercise_id, role, part, sets)
  values (quick, 0, ex, 'main', 'main', 1) returning id into item;
  insert into public.set_logs (session_item_id, exercise_id, set_no, reps) values (item, ex, 1, 10);
  assert public.first_completed_workout('00000000-0000-0000-0000-00000000f3a2') is null, 'a 2-minute tap counted';

  insert into public.sessions (id, profile_id, status, started_at, ended_at)
  values (real, '00000000-0000-0000-0000-00000000f3b2', 'done', now() - interval '25 minutes', now());
  insert into public.session_items (session_id, "order", exercise_id, role, part, sets)
  values (real, 0, ex, 'main', 'main', 6) returning id into item;
  for n in 1..6 loop
    insert into public.set_logs (session_item_id, exercise_id, set_no, reps) values (item, ex, n, 10);
  end loop;
  assert public.first_completed_workout('00000000-0000-0000-0000-00000000f3a2') is not null, 'a real workout not counted';
end $$;

-- The inviter cap is taken in one locked step.
do $$
declare
  ref uuid;
begin
  select id into ref from public.referrals where code = 'FARM2345';
  assert public.claim_inviter_reward(ref, 1) = true, 'first inviter week';
  assert public.claim_inviter_reward(ref, 1) = false, 'the same referral claimed twice';
  perform public.release_inviter_reward(ref);
  assert (select not inviter_rewarded from public.referrals where id = ref), 'week not given back';
  assert public.claim_inviter_reward(ref, 0) = false, 'cap 0 still granted';
  -- Clients can't call it.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f3a1', false);
  execute 'set role authenticated';
  begin
    perform public.claim_inviter_reward(ref, 100);
    raise exception 'a client claimed an inviter week';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

-- Deleting the guardian keeps the teen's own profile, drops login-less ones.
insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode)
values ('00000000-0000-0000-0000-00000000f3b6', '00000000-0000-0000-0000-00000000f3a6', 4, 1980, 'adult', 'adult');
insert into public.subscriptions (user_id, plan, status, store, first_charged_at, last_transaction_id)
values ('00000000-0000-0000-0000-00000000f3a6', 'family', 'active', 'app_store', now(), 'tx-p3');
insert into public.profiles (id, user_id, guardian_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-00000000f3b7', '00000000-0000-0000-0000-00000000f3a7',
   '00000000-0000-0000-0000-00000000f3a6', 3, extract(year from now())::smallint - 15, 'teen', 'teen');
insert into public.profiles (id, guardian_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-00000000f3b8', '00000000-0000-0000-0000-00000000f3a6', 2, 1950, 'senior', 'senior');
delete from auth.users where id = '00000000-0000-0000-0000-00000000f3a6';
do $$ begin
  assert exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000f3b7' and guardian_id is null),
    'the teen''s own profile was deleted with the guardian';
  assert not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000f3b8'),
    'a login-less managed profile outlived its guardian';
end $$;

select 'security_p3: all assertions passed';
