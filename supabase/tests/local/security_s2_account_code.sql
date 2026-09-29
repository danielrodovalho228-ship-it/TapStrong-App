-- Security round 1, S2-07: the Account email code locks after 5 wrong tries.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-00000000e9a1', true),
  ('00000000-0000-0000-0000-00000000e9a2', true);

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$
declare
  lock timestamptz;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e9a1');
  for i in 1..4 loop
    assert public.account_code_failed('Dan@Example.com') is null, 'locked too early';
  end loop;
  lock := public.account_code_failed('dan@example.com ');
  assert lock > now() + interval '14 minutes', 'fifth wrong code (same email, any case) locks';
  assert public.account_code_locked_until('DAN@example.com') is not null, 'lock reported';
  assert public.account_code_locked_until('other@example.com') is null, 'another email is free';
  begin
    perform 1 from public.account_code_lockouts;
    raise exception 'a client read the lockouts';
  exception when insufficient_privilege then null;
  end;
  -- Another session has its own count; no raw email stored anywhere.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e9a2');
  assert public.account_code_locked_until('dan@example.com') is null, 'lock leaked to another session';
  execute 'reset role';
  assert not exists (select 1 from public.account_code_lockouts where email_hash like '%@%'), 'raw email stored';
  execute 'set role anon';
  begin
    perform public.account_code_failed('dan@example.com');
    raise exception 'anon counted a code';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

select 'security_s2_account_code: all assertions passed';
