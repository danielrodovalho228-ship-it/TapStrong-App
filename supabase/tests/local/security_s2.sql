-- Security round 1, S2-01..S2-03: nobody joins a stranger's family, a teen
-- can't drop their guardian, and the age mode follows the birth date.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-00000000e7a1', false), -- adult D with a Family plan
  ('00000000-0000-0000-0000-00000000e7a2', false), -- user C
  ('00000000-0000-0000-0000-00000000e7a3', false), -- teen T with own login
  ('00000000-0000-0000-0000-00000000e7a4', false); -- guardian G (Family) of T

insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-00000000e7b1', '00000000-0000-0000-0000-00000000e7a1', 4, 1985, 'adult', 'adult'),
  ('00000000-0000-0000-0000-00000000e7b2', '00000000-0000-0000-0000-00000000e7a2', 4, 1990, 'adult', 'adult'),
  ('00000000-0000-0000-0000-00000000e7b4', '00000000-0000-0000-0000-00000000e7a4', 4, 1980, 'adult', 'adult');
insert into public.subscriptions (user_id, plan, status, store, first_charged_at, last_transaction_id) values
  ('00000000-0000-0000-0000-00000000e7a1', 'family', 'active', 'app_store', now(), 'tx-e7a'),
  ('00000000-0000-0000-0000-00000000e7a4', 'family', 'active', 'app_store', now(), 'tx-e7b');
-- T has a login and is managed by G (created by support tooling).
insert into public.profiles (id, user_id, guardian_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-00000000e7b3', '00000000-0000-0000-0000-00000000e7a3',
   '00000000-0000-0000-0000-00000000e7a4', 3, extract(year from now())::smallint - 15, 'teen', 'teen');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$
declare
  teen_year smallint := extract(year from now())::smallint - 15;
  kid_year smallint := extract(year from now())::smallint - 11;
begin
  -- S2-01: C can't put their own profile under D's Family plan.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e7a2');
  begin
    update public.profiles set guardian_id = '00000000-0000-0000-0000-00000000e7a1'
    where id = '00000000-0000-0000-0000-00000000e7b2';
    raise exception 'user joined a stranger''s family';
  exception when insufficient_privilege then null;
  end;
  -- Nor insert a new own profile with D as guardian.
  delete from public.profiles where id = '00000000-0000-0000-0000-00000000e7b2';
  begin
    insert into public.profiles (user_id, guardian_id, birth_month, birth_year, body_band, mode)
    values ('00000000-0000-0000-0000-00000000e7a2', '00000000-0000-0000-0000-00000000e7a1', 4, 1990, 'adult', 'adult');
    raise exception 'user inserted a profile under a stranger''s family';
  exception when insufficient_privilege then null;
  end;
  insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode)
  values ('00000000-0000-0000-0000-00000000e7b2', '00000000-0000-0000-0000-00000000e7a2', 4, 1990, 'adult', 'adult');

  -- S2-02: T can't remove G, nor pick another guardian.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e7a3');
  begin
    update public.profiles set guardian_id = null where id = '00000000-0000-0000-0000-00000000e7b3';
    raise exception 'teen removed their guardian';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set guardian_id = '00000000-0000-0000-0000-00000000e7a1'
    where id = '00000000-0000-0000-0000-00000000e7b3';
    raise exception 'teen picked another guardian';
  exception when insufficient_privilege then null;
  end;
  -- S2-03: nor make themselves adult.
  begin
    update public.profiles set mode = 'adult', body_band = 'young' where id = '00000000-0000-0000-0000-00000000e7b3';
    raise exception 'teen made themselves adult';
  exception when check_violation then null;
  end;
  -- Nor move their birth date to look adult... the mode still can't follow.
  begin
    update public.profiles set birth_year = teen_year - 1, mode = 'adult', body_band = 'young'
    where id = '00000000-0000-0000-0000-00000000e7b3';
    raise exception 'teen became adult with a small date change';
  exception when check_violation then null;
  end;
  -- Normal edits still work.
  update public.profiles set units = 'metric' where id = '00000000-0000-0000-0000-00000000e7b3';

  -- The guardian can't switch the teen to adult either, and no body data.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e7a4');
  begin
    update public.profiles set mode = 'adult', body_band = 'young' where id = '00000000-0000-0000-0000-00000000e7b3';
    raise exception 'guardian made a teen adult';
  exception when check_violation then null;
  end;
  begin
    insert into public.checkins (profile_id, taken_at, weight_kg)
    values ('00000000-0000-0000-0000-00000000e7b3', now(), 60);
    raise exception 'weight stored for a teen';
  exception when check_violation then null;
  end;
  -- A profile born 11 years ago can't be inserted as adult or teen.
  begin
    insert into public.profiles (guardian_id, birth_month, birth_year, body_band, mode)
    values ('00000000-0000-0000-0000-00000000e7a4', 1, kid_year, 'teen', 'teen');
    raise exception 'an 11-year-old inserted as teen';
  exception when check_violation then null;
  end;
  -- Letting go of a teen who has their own login isn't a client action
  -- either (no flow needs it yet: support or a future guardian RPC).
  begin
    update public.profiles set guardian_id = null where id = '00000000-0000-0000-0000-00000000e7b3';
    raise exception 'guardian detached a teen from the client';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  assert (select guardian_id from public.profiles where id = '00000000-0000-0000-0000-00000000e7b3')
    = '00000000-0000-0000-0000-00000000e7a4', 'guardian changed';
end $$;

-- Adults: an adult may choose 60+ mode; body data is fine.
do $$ begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e7a2');
  update public.profiles set mode = 'senior', body_band = 'senior' where id = '00000000-0000-0000-0000-00000000e7b2';
  insert into public.checkins (profile_id, taken_at, weight_kg)
  values ('00000000-0000-0000-0000-00000000e7b2', now(), 80);
  execute 'reset role';
end $$;

select 'security_s2: all assertions passed';
