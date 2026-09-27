-- QA round 3: the parent PIN lockout mirrored on the server.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-00000000a0a1', false),
  ('00000000-0000-0000-0000-00000000a0a2', false);

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
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000a0a1');
  -- Four wrong tries: not locked yet.
  for i in 1..4 loop
    lock := public.parent_pin_failed();
    if lock is not null then raise exception 'locked after % tries', i; end if;
  end loop;
  -- The fifth locks for about 15 minutes.
  lock := public.parent_pin_failed();
  if lock is null or lock < now() + interval '14 minutes' then
    raise exception 'fifth wrong try did not lock: %', lock;
  end if;
  if public.parent_pin_locked_until() is null then raise exception 'lock not reported'; end if;
  -- More tries while locked don't extend or clear it.
  if public.parent_pin_failed() is distinct from lock then raise exception 'lock changed'; end if;

  -- Another account is not affected and can't see it.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000a0a2');
  if public.parent_pin_locked_until() is not null then raise exception 'lock leaked to another user'; end if;
  begin
    perform 1 from public.parent_pin_lockouts;
    raise exception 'a client read the lockout table';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.parent_pin_lockouts set locked_until = null;
    raise exception 'a client edited the lockout table';
  exception when insufficient_privilege then null;
  end;

  -- The right PIN (or a reset) clears it.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000a0a1');
  perform public.parent_pin_passed();
  if public.parent_pin_locked_until() is not null then raise exception 'lock not cleared'; end if;
  execute 'reset role';

  -- Signed out: refused.
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
  begin
    perform public.parent_pin_failed();
    raise exception 'anon counted a try';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;
