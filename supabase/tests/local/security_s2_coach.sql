-- Security round 1, S2-04: the coach's per-IP and global daily budgets.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-00000000e8a1', true);

do $$
declare
  ip1 text := repeat('a', 64);
  ip2 text := repeat('b', 64);
begin
  -- Server side (the function's service role): 3 per IP, 5 in total.
  for i in 1..3 loop
    assert public.consume_coach_budget(ip1, 3, 5) = 'ok', 'call within the IP budget';
  end loop;
  assert public.consume_coach_budget(ip1, 3, 5) = 'ip_limit', 'fourth call from one IP';
  assert public.consume_coach_budget(ip2, 3, 5) = 'ok', 'another IP still works';
  assert public.consume_coach_budget(ip2, 3, 5) = 'ok', 'another IP still works (2)';
  assert public.consume_coach_budget(repeat('c', 64), 3, 5) = 'global_limit', 'global budget reached';
  assert (select calls from public.coach_budget where scope = 'global') = 5, 'refused calls not counted';
  begin
    perform public.consume_coach_budget('1.2.3.4', 3, 5);
    raise exception 'a raw IP was stored';
  exception when invalid_parameter_value then null;
  end;

  -- A client (even signed in) can't spend or read the budget.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e8a1', false);
  execute 'set role authenticated';
  begin
    perform public.consume_coach_budget(ip2, 1000, 1000);
    raise exception 'a client spent the coach budget';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.coach_budget;
    raise exception 'a client read the coach budget';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

select 'security_s2_coach: all assertions passed';
