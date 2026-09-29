-- QA round 10, decision 1: the reset-code lockout, apart from the PIN's.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-00000000c0d1', false),
  ('00000000-0000-0000-0000-00000000c0d2', false);

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
  -- Wrong PINs (counted server side since round 2) don't touch the code count.
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c0d1', false);
  for i in 1..5 loop perform public.parent_pin_failed(); end loop;
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000c0d1');
  if public.parent_pin_locked_until() is null then raise exception 'PIN not locked'; end if;
  if public.pin_reset_code_locked_until() is not null then raise exception 'PIN lock blocked the code'; end if;

  for i in 1..4 loop
    lock := public.pin_reset_code_failed();
    if lock is not null then raise exception 'code locked after % tries', i; end if;
  end loop;
  lock := public.pin_reset_code_failed();
  if lock is null or lock < now() + interval '14 minutes' then
    raise exception 'fifth wrong code did not lock: %', lock;
  end if;
  if public.pin_reset_code_failed() is distinct from lock then raise exception 'lock changed'; end if;

  -- Another account is not affected and can't read or edit the table.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000c0d2');
  if public.pin_reset_code_locked_until() is not null then raise exception 'lock leaked'; end if;
  begin
    perform 1 from public.pin_reset_code_lockouts;
    raise exception 'a client read the code lockout table';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.pin_reset_code_lockouts set locked_until = null;
    raise exception 'a client edited the code lockout table';
  exception when insufficient_privilege then null;
  end;

  -- The right code clears it, and only the code's count — server side only
  -- since security round 1 (open_pin_reset_window does it; clients can't).
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c0d1', false);
  perform public.pin_reset_code_passed();
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000c0d1');
  if public.pin_reset_code_locked_until() is not null then raise exception 'code lock not cleared'; end if;
  if public.parent_pin_locked_until() is null then raise exception 'code pass cleared the PIN lock'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
  begin
    perform public.pin_reset_code_failed();
    raise exception 'anon counted a code';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;
