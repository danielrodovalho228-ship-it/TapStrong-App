-- Security round 2, S2-P2-4: a teen can't make themselves adult by moving
-- their birth date; only the guardian can make it earlier; every change is
-- logged; 60+ mode needs 60+.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000b1', false), -- guardian G
  ('00000000-0000-0000-0000-0000000000b2', false), -- teen T with own login, managed by G
  ('00000000-0000-0000-0000-0000000000b3', false), -- teen S with own login, no guardian
  ('00000000-0000-0000-0000-0000000000b4', false); -- adult A

insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 4, 1980, 'adult', 'adult'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b3', 3,
   extract(year from now())::smallint - 15, 'teen', 'teen'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b4', 4, 1990, 'adult', 'adult');
insert into public.subscriptions (user_id, plan, status, store, first_charged_at, last_transaction_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'family', 'active', 'app_store', now(), 'tx-r2-bd');
insert into public.profiles (id, user_id, guardian_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000b1', 3, extract(year from now())::smallint - 15, 'teen', 'teen'),
  -- M: a teen profile G manages on their phone (no login of its own).
  ('00000000-0000-0000-0000-0000000000c5', null,
   '00000000-0000-0000-0000-0000000000b1', 3, extract(year from now())::smallint - 15, 'teen', 'teen');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$
declare
  teen_year smallint := extract(year from now())::smallint - 15;
  n integer;
begin
  -- The round-2 repro: T makes themselves adult (1990) keeping the guardian.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
  begin
    update public.profiles set birth_year = 1990, mode = 'adult', body_band = 'adult'
    where id = '00000000-0000-0000-0000-0000000000c2';
    raise exception 'teen made themselves adult by moving the birth date';
  exception when insufficient_privilege then null;
  end;
  -- Nor a year older while staying a teen (walks towards 18).
  begin
    update public.profiles set birth_year = teen_year - 1
    where id = '00000000-0000-0000-0000-0000000000c2';
    raise exception 'teen made their birth date earlier';
  exception when insufficient_privilege then null;
  end;
  -- Nor an earlier month in the same year.
  begin
    update public.profiles set birth_month = 1
    where id = '00000000-0000-0000-0000-0000000000c2';
    raise exception 'teen made their birth month earlier';
  exception when insufficient_privilege then null;
  end;
  -- A later date (younger) is fine.
  update public.profiles set birth_month = 6 where id = '00000000-0000-0000-0000-0000000000c2';

  -- A teen without a guardian is held by the teen mode.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b3');
  begin
    update public.profiles set birth_year = 1990, mode = 'adult', body_band = 'adult'
    where id = '00000000-0000-0000-0000-0000000000c3';
    raise exception 'guardian-less teen made themselves adult';
  exception when insufficient_privilege then null;
  end;

  -- The guardian can fix a managed profile's date either way (never into an
  -- adult mode while under 18). A teen with their own login is fixed by
  -- support: the guardian can't edit that profile (Phase 24, S1-01).
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
  update public.profiles set birth_year = teen_year - 1, birth_month = 3
  where id = '00000000-0000-0000-0000-0000000000c5';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'the guardian could not fix the birth date'; end if;
  update public.profiles set birth_month = 5 where id = '00000000-0000-0000-0000-0000000000c5';

  -- The log, readable by the guardian.
  select count(*) into n from public.profile_birth_changes
  where profile_id = '00000000-0000-0000-0000-0000000000c5';
  if n <> 2 then raise exception 'guardian sees % birth date changes, expected 2', n; end if;
  select count(*) into n from public.profile_birth_changes
  where profile_id = '00000000-0000-0000-0000-0000000000c5'
    and changed_by = '00000000-0000-0000-0000-0000000000b1'
    and old_birth_year = teen_year and new_birth_year = teen_year - 1;
  if n <> 1 then raise exception 'the guardian''s change is not logged'; end if;
  -- ...and the teen's later date on T's own profile (G is its guardian).
  select count(*) into n from public.profile_birth_changes
  where profile_id = '00000000-0000-0000-0000-0000000000c2' and new_birth_month = 6;
  if n <> 1 then raise exception 'the teen''s own change is not logged'; end if;
  -- Nobody writes or erases the log from the client.
  begin
    insert into public.profile_birth_changes (profile_id) values ('00000000-0000-0000-0000-0000000000c2');
    raise exception 'client wrote the birth date log';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profile_birth_changes;
    raise exception 'client erased the birth date log';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profile_birth_changes set new_birth_year = 1990;
    raise exception 'client edited the birth date log';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
  select count(*) into n from public.profile_birth_changes;
  if n <> 1 then raise exception 'teen sees % changes, expected their own 1', n; end if;
  -- Another user sees none.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000b4');
  select count(*) into n from public.profile_birth_changes;
  if n <> 0 then raise exception 'a stranger reads the birth date log'; end if;

  -- An adult without a guardian fixes their own date freely (logged).
  update public.profiles set birth_year = 1988 where id = '00000000-0000-0000-0000-0000000000c4';
  select count(*) into n from public.profile_birth_changes;
  if n <> 1 then raise exception 'adult change not logged'; end if;
  -- 60+ mode only for 60 and over.
  begin
    update public.profiles set mode = 'senior' where id = '00000000-0000-0000-0000-0000000000c4';
    raise exception 'a 38-year-old switched to the 60+ mode';
  exception when check_violation then null;
  end;
  update public.profiles set birth_year = extract(year from now())::smallint - 65, mode = 'senior'
  where id = '00000000-0000-0000-0000-0000000000c4';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'a 65-year-old could not use the 60+ mode'; end if;

  execute 'reset role';
  raise notice 'security_r2_birth_date: all assertions passed';
end $$;
