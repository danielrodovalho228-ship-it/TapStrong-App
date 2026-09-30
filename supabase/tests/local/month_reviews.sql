-- Phase 26: month reviews are readable and writable only by the profile's
-- owner (or guardian), never by another user or anon.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000026a1', false), -- owner O
  ('00000000-0000-0000-0000-0000000026a2', false); -- stranger S
insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-0000000026b1', '00000000-0000-0000-0000-0000000026a1', 4, 1985, 'adult', 'adult'),
  ('00000000-0000-0000-0000-0000000026b2', '00000000-0000-0000-0000-0000000026a2', 4, 1990, 'adult', 'adult');

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
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000026a1');
  insert into public.month_reviews (profile_id, block_no, starts_on, ends_on, summary, choice, changes, focus)
  values ('00000000-0000-0000-0000-0000000026b1', 0, '2026-08-31', '2026-09-28',
          '{"workouts": 9}', 'continue', '[{"from":"a","to":"b","reason":"variety"}]',
          '[{"muscle":"hamstrings","reason":"lowGoal"}]');
  update public.month_reviews set choice = 'repeat' where profile_id = '00000000-0000-0000-0000-0000000026b1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'owner could not update their month'; end if;
  -- Not onto someone else's profile.
  begin
    insert into public.month_reviews (profile_id, block_no, starts_on, ends_on, summary)
    values ('00000000-0000-0000-0000-0000000026b2', 0, '2026-08-31', '2026-09-28', '{}');
    raise exception 'owner wrote a month for another profile';
  exception when insufficient_privilege then null;
  end;
  -- Bad values are refused.
  begin
    insert into public.month_reviews (profile_id, block_no, starts_on, ends_on, summary, choice)
    values ('00000000-0000-0000-0000-0000000026b1', 1, '2026-09-28', '2026-10-26', '{}', 'whatever');
    raise exception 'unknown choice stored';
  exception when check_violation then null;
  end;
  begin
    insert into public.month_reviews (profile_id, block_no, starts_on, ends_on, summary, focus)
    values ('00000000-0000-0000-0000-0000000026b1', 1, '2026-09-28', '2026-10-26', '{}',
            '[{"muscle":"a"},{"muscle":"b"},{"muscle":"c"}]');
    raise exception 'three focus muscles stored';
  exception when check_violation then null;
  end;

  -- A stranger sees nothing and changes nothing.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000026a2');
  select count(*) into n from public.month_reviews;
  if n <> 0 then raise exception 'a stranger read a month review'; end if;
  update public.month_reviews set choice = 'auto';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'a stranger changed a month review'; end if;
  delete from public.month_reviews;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'a stranger deleted a month review'; end if;
  -- Nor moves one onto their profile.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000026a1');
  begin
    update public.month_reviews set profile_id = '00000000-0000-0000-0000-0000000026b2';
    raise exception 'owner moved a month to another profile';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
  begin
    perform 1 from public.month_reviews;
    raise exception 'anon read month reviews';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  raise notice 'month_reviews: all assertions passed';
end $$;
