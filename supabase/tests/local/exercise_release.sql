-- Tests for the exercise release workflow (runs after migrations + seed.sql).
\set ON_ERROR_STOP on
\o /dev/null

-- The seed loaded, all as drafts with valid mappings.
do $$ begin
  assert (select count(*) from public.exercises) >= 40, 'seed library loaded';
  assert not exists (select 1 from public.exercises where status <> 'draft'), 'seed is all draft';
  assert not exists (select 1 from public.exercises where media_provider <> 'prototype'),
    'seed media is prototype only';
end $$;

-- New exercises must start as draft.
do $$ begin
  begin
    insert into public.exercises (slug, name_i18n_key, cues_i18n_key, location, level, min_age_band,
      positions, movement_pattern, session_parts, dose_type, status)
    values ('zz_direct', 'x', 'x', '{home}', 1, 'kid', '{standing}', 'squat', '{main}', 'reps', 'released');
    raise exception 'inserted an exercise directly as released';
  exception when raise_exception then
    if sqlerrm not like 'new exercises start as draft%' then raise; end if;
  end;
end $$;

-- Walk one exercise through the workflow.
insert into public.exercises (slug, name_i18n_key, cues_i18n_key, location, level, min_age_band,
  positions, movement_pattern, session_parts, dose_type, media_provider)
values ('zz_test_squat', 'x', 'x', '{home}', 1, 'kid', '{standing}', 'squat', '{main}', 'reps', 'prototype');
insert into public.exercise_muscles (exercise_id, muscle_key, role, emphasis)
select id, 'quads', 'primary', 1.0 from public.exercises where slug = 'zz_test_squat';

create or replace function pg_temp.expect_error(stmt text, fragment text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like '%' || fragment || '%' then return; end if;
    raise exception 'expected error containing "%", got "%"', fragment, sqlerrm;
  end;
  raise exception 'expected error containing "%", statement succeeded', fragment;
end $$;

select pg_temp.expect_error(
  $q$update public.exercises set status = 'released' where slug = 'zz_test_squat'$q$,
  'no passing automated check');

insert into public.exercise_reviews (exercise_id, "check", result)
select id, 'auto', 'pass' from public.exercises where slug = 'zz_test_squat';
update public.exercises set status = 'auto_checked' where slug = 'zz_test_squat';

select pg_temp.expect_error(
  $q$update public.exercises set status = 'released' where slug = 'zz_test_squat'$q$,
  'no passing second mapping check');

-- A certified review needs a name and a credential.
select pg_temp.expect_error(
  $q$insert into public.exercise_reviews (exercise_id, "check", reviewer_name, result)
     select id, 'certified', 'Pat Lee', 'pass' from public.exercises where slug = 'zz_test_squat'$q$,
  'exercise_reviews_certified_signed');

insert into public.exercise_reviews (exercise_id, "check", reviewer_name, result)
select id, 'second', 'Sam Diaz', 'pass' from public.exercises where slug = 'zz_test_squat';
insert into public.exercise_reviews (exercise_id, "check", reviewer_name, credential, result)
select id, 'certified', 'Pat Lee', 'NSCA-CSCS', 'pass' from public.exercises where slug = 'zz_test_squat';

-- Prototype media can never be released.
select pg_temp.expect_error(
  $q$update public.exercises set status = 'released' where slug = 'zz_test_squat'$q$,
  'released exercises need licensed media');

update public.exercises
set media_provider = 'gym_animations', media_video = 'v/zz.mp4', license_ref = 'LIC-1'
where slug = 'zz_test_squat';
update public.exercises set status = 'released' where slug = 'zz_test_squat';

-- The mapping of a released exercise is locked.
select pg_temp.expect_error(
  $q$insert into public.exercise_muscles (exercise_id, muscle_key, role, emphasis)
     select id, 'glutes', 'secondary', 0.5 from public.exercises where slug = 'zz_test_squat'$q$,
  'mapping is locked');

-- Clients see released exercises only.
set role anon;
do $$ begin
  assert (select count(*) from public.exercises) = 1, 'anon sees only the released exercise';
  assert (select slug from public.exercises) = 'zz_test_squat', 'the released one';
  assert (select count(*) from public.exercise_muscles) = 1, 'anon sees only its mapping';
end $$;
select pg_temp.expect_error($q$select count(*) from public.exercise_reviews$q$, 'permission denied');
select pg_temp.expect_error(
  $q$update public.exercises set level = 5 where slug = 'zz_test_squat'$q$, 'permission denied');
reset role;

-- Changing the mapping after going back to draft invalidates old reviews.
update public.exercises set status = 'draft' where slug = 'zz_test_squat';
insert into public.exercise_muscles (exercise_id, muscle_key, role, emphasis)
select id, 'glutes', 'secondary', 0.5 from public.exercises where slug = 'zz_test_squat';
select pg_temp.expect_error(
  $q$update public.exercises set status = 'auto_checked' where slug = 'zz_test_squat'$q$,
  'no passing automated check for mapping v3');

\o
\echo 'exercise_release: all assertions passed'
