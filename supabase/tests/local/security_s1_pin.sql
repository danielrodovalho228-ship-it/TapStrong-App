-- Security round 1, S1-03: the parent PIN is checked on the server, the lock
-- is enforced inside the check, and no client can read a hash or clear a lock.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-00000000e6a1', false), -- adult, no family yet
  ('00000000-0000-0000-0000-00000000e6a2', false), -- owner with a teen
  ('00000000-0000-0000-0000-00000000e6a3', true);  -- anonymous

insert into public.profiles (user_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-00000000e6a1', 4, 1985, 'adult', 'adult'),
  ('00000000-0000-0000-0000-00000000e6a2', 4, 1980, 'adult', 'adult');
insert into public.subscriptions (user_id, plan, status, store, first_charged_at, last_transaction_id)
values ('00000000-0000-0000-0000-00000000e6a2', 'family', 'active', 'app_store', now(), 'tx-e6');
insert into public.profiles (guardian_id, birth_month, birth_year, body_band, mode)
values ('00000000-0000-0000-0000-00000000e6a2', 3, extract(year from now())::int - 15, 'teen', 'teen');

create or replace function pg_temp.act_as(uid text, claims text default '{}') returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', claims, false);
  execute 'set role authenticated';
end $$;

do $$
declare
  r record;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e6a1');
  select * into r from public.verify_parent_pin('1234');
  assert r.result = 'no_pin', 'no PIN yet';
  -- No minors yet: the first PIN needs no window.
  assert public.set_parent_pin('12a4') = 'invalid', 'only 4 digits';
  assert public.set_parent_pin('1234') = 'ok', 'first PIN';
  assert (select has_pin from public.parent_pin_status()), 'status sees the PIN';
  -- Replacing it needs the right PIN (or the email code) first.
  assert public.set_parent_pin('9999') = 'reauth', 'PIN replaced without proof';
  select * into r from public.verify_parent_pin('0000');
  assert r.result = 'wrong' and r.failures = 1, 'wrong PIN counted on the server';
  select * into r from public.verify_parent_pin('1234');
  assert r.result = 'ok' and r.pin_version is not null, 'right PIN, with its version';
  -- Round 2 (S2-P2-2): a right PIN opens no window; changing needs the old PIN.
  assert public.set_parent_pin('5678') = 'reauth', 'PIN changed right after an unlock without the old one';
  assert public.set_parent_pin('5678', '0000') = 'wrong', 'PIN changed with a wrong old PIN';
  select * into r from public.verify_parent_pin('0000');
  assert r.failures = 2, 'a wrong old PIN counts toward the lock';
  assert public.set_parent_pin('5678', '1234') = 'ok', 'change with the old PIN';
  select * into r from public.verify_parent_pin('1234');
  assert r.result = 'wrong', 'old PIN no longer works';
  assert r.failures = 1, 'the count restarted with the right old PIN';
  select * into r from public.verify_parent_pin('5678');
  assert r.result = 'ok', 'new PIN works';

  -- 5 wrong in a row lock it; the right PIN is refused while locked.
  for i in 1..4 loop perform public.verify_parent_pin('0000'); end loop;
  select * into r from public.verify_parent_pin('0000');
  assert r.result = 'locked' and r.locked_until > now() + interval '14 minutes', 'fifth wrong locks';
  select * into r from public.verify_parent_pin('5678');
  assert r.result = 'locked', 'right PIN accepted while locked';

  -- The client can't read the hash, open a window, or clear a lock itself.
  begin
    perform 1 from public.parent_pins;
    raise exception 'client read the PIN hash';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.parent_pin_windows (user_id, open_until)
    values ('00000000-0000-0000-0000-00000000e6a1', now() + interval '1 hour');
    raise exception 'client opened its own window';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.parent_pin_passed();
    raise exception 'client cleared the PIN lock';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pin_reset_code_passed();
    raise exception 'client cleared the code lock';
  exception when insufficient_privilege then null;
  end;
  -- Without a fresh email-code sign-in, no reset window.
  assert public.open_pin_reset_window() = false, 'window without a fresh code';
end $$;

do $$
declare
  r record;
  old_otp text := format('{"amr":[{"method":"otp","timestamp":%s}]}',
                         extract(epoch from now() - interval '1 hour')::bigint);
  new_otp text := format('{"amr":[{"method":"otp","timestamp":%s}]}',
                         extract(epoch from now() - interval '1 minute')::bigint);
  password text := format('{"amr":[{"method":"password","timestamp":%s}]}',
                          extract(epoch from now())::bigint);
begin
  -- An owner who already manages a teen needs proof even for the first PIN.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e6a2');
  assert public.set_parent_pin('2468') = 'reauth', 'first PIN with a teen and no proof';
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e6a2', old_otp);
  assert public.open_pin_reset_window() = false, 'an old sign-in opened the window';
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e6a2', password);
  assert public.open_pin_reset_window() = false, 'a password sign-in opened the window';
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e6a2', new_otp);
  assert public.open_pin_reset_window() = true, 'fresh email code opens the window';
  -- Back on the phone's own session: the window still holds.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e6a2');
  assert public.set_parent_pin('2468') = 'ok', 'PIN set after the email code';
  -- Round 2: the email-code window is used once.
  assert public.set_parent_pin('1357') = 'reauth', 'the email-code window was used twice';
  select * into r from public.verify_parent_pin('2468');
  assert r.result = 'ok', 'new PIN works';

  -- Each account has its own PIN and lock.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e6a1');
  select * into r from public.verify_parent_pin('2468');
  assert r.result = 'locked', 'e6a1 is still locked from before';

  -- Anonymous: no PIN to set; signed out: nothing at all.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000e6a3');
  begin
    perform public.set_parent_pin('1234');
    raise exception 'anonymous user set a PIN';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
  begin
    perform public.verify_parent_pin('1234');
    raise exception 'anon checked a PIN';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

select 'security_s1_pin: all assertions passed';
