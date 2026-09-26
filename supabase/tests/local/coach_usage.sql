-- Tests for the coach call limit (runs after rls_foundations.sql).
\set ON_ERROR_STOP on

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1');

do $$
declare ok boolean;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
  execute 'set role authenticated';

  assert public.consume_coach_call(2) = true, 'first call allowed';
  assert public.consume_coach_call(2) = true, 'second call allowed';
  assert public.consume_coach_call(2) = false, 'third call over the limit';

  begin
    perform count(*) from public.coach_usage;
    assert (select count(*) from public.coach_usage) = 0, 'usage rows are not readable by clients';
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role authenticated';
  assert public.consume_coach_call(30) = false, 'no user, no calls';
  execute 'reset role';
end $$;

-- The new enum value exists.
do $$ begin
  assert 'fitness' = any (enum_range(null::public.main_goal)::text[]), 'fitness goal missing';
end $$;

\echo 'coach_usage: all assertions passed'
