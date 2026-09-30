-- Phase 27: Moments are readable and writable only by the profile's owner
-- (or guardian), never by another user or anon.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000027a1', false), -- owner O
  ('00000000-0000-0000-0000-0000000027a2', false); -- stranger S
insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-0000000027b1', '00000000-0000-0000-0000-0000000027a1', 4, 1985, 'adult', 'adult'),
  ('00000000-0000-0000-0000-0000000027b2', '00000000-0000-0000-0000-0000000027a2', 4, 1990, 'adult', 'adult');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$
declare
  n integer;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000027a1');
  insert into public.moments (profile_id, moment_id, kind, shown_at, workout_id)
  values ('00000000-0000-0000-0000-0000000027b1', 'workouts:10', 'milestone_workouts',
          '2026-09-30T18:00:00Z', '00000000-0000-0000-0000-0000000027c1');
  insert into public.moments (profile_id, moment_id, kind, shown_at)
  values ('00000000-0000-0000-0000-0000000027b1', 'coach_pain:2026-09-24', 'coach_pain',
          '2026-09-30T18:00:00Z');
  update public.moments set answer = 'good' where moment_id like 'coach_pain:%';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'owner could not answer the coach'; end if;
  -- Never twice for the same person.
  begin
    insert into public.moments (profile_id, moment_id, kind, shown_at)
    values ('00000000-0000-0000-0000-0000000027b1', 'workouts:10', 'milestone_workouts', now());
    raise exception 'the same Moment stored twice';
  exception when unique_violation then null;
  end;
  -- Not onto someone else's profile.
  begin
    insert into public.moments (profile_id, moment_id, kind, shown_at)
    values ('00000000-0000-0000-0000-0000000027b2', 'fact:f01', 'fact', now());
    raise exception 'owner wrote a Moment for another profile';
  exception when insufficient_privilege then null;
  end;
  -- Bad values are refused: unknown kind, free text in the id, unknown answer.
  begin
    insert into public.moments (profile_id, moment_id, kind, shown_at)
    values ('00000000-0000-0000-0000-0000000027b1', 'loot:box', 'loot_box', now());
    raise exception 'unknown kind stored';
  exception when check_violation then null;
  end;
  begin
    insert into public.moments (profile_id, moment_id, kind, shown_at)
    values ('00000000-0000-0000-0000-0000000027b1', 'My knee hurts a lot', 'fact', now());
    raise exception 'free text stored as a Moment id';
  exception when check_violation then null;
  end;
  begin
    update public.moments set answer = 'maybe' where moment_id = 'workouts:10';
    raise exception 'unknown answer stored';
  exception when check_violation then null;
  end;

  -- A stranger sees nothing and changes nothing.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000027a2');
  select count(*) into n from public.moments;
  if n <> 0 then raise exception 'a stranger read a Moment'; end if;
  update public.moments set answer = 'not_yet';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'a stranger changed a Moment'; end if;
  delete from public.moments;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'a stranger deleted a Moment'; end if;
  -- Nor moves one onto their profile.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000027a1');
  begin
    update public.moments set profile_id = '00000000-0000-0000-0000-0000000027b2';
    raise exception 'owner moved a Moment to another profile';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
  begin
    perform 1 from public.moments;
    raise exception 'anon read Moments';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  raise notice 'moments: all assertions passed';
end $$;
