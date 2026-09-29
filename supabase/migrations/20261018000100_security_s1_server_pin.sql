-- Security round 1, S1-03 (Daniel's decision): the parent PIN is checked on
-- the server on every platform. Only a bcrypt hash is stored, in a table no
-- client can read; verify_parent_pin() enforces the lockout (5 wrong → 15 min,
-- apart from the email-code counter) inside the check, so the phone no longer
-- reports its own results. The phone keeps its Keychain/Keystore copy only as
-- an offline fallback (native).
--
-- Changing the PIN needs a short window opened by the right PIN (5 min) or by
-- a fresh email-code sign-in (15 min, the forgotten-PIN flow). A first PIN
-- needs no window only while the account manages no minors yet.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.parent_pins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.parent_pin_windows (
  user_id uuid primary key references auth.users (id) on delete cascade,
  open_until timestamptz not null
);

alter table public.parent_pins enable row level security;
alter table public.parent_pin_windows enable row level security;
-- No policies: clients use the functions below and never read a hash.
revoke all on public.parent_pins, public.parent_pin_windows from anon, authenticated;

-- Whether the account has a server PIN, and the lock end (null when not locked).
create function public.parent_pin_status()
returns table (has_pin boolean, locked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.parent_pins p where p.user_id = (select auth.uid())),
         (select l.locked_until from public.parent_pin_lockouts l
          where l.user_id = (select auth.uid()) and l.locked_until > now());
$$;

-- 'ok' | 'wrong' | 'locked' | 'no_pin', with the wrong-try count and lock end.
create function public.verify_parent_pin(pin text)
returns table (result text, failures integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  stored text;
  lock timestamptz;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select l.locked_until into lock from public.parent_pin_lockouts l
  where l.user_id = uid and l.locked_until > now();
  if lock is not null then
    return query select 'locked'::text, 0, lock;
    return;
  end if;
  select p.pin_hash into stored from public.parent_pins p where p.user_id = uid;
  if stored is null then
    return query select 'no_pin'::text, 0, null::timestamptz;
    return;
  end if;
  if pin is not null and pin ~ '^\d{4}$' and extensions.crypt(pin, stored) = stored then
    update public.parent_pin_lockouts
      set failures = 0, locked_until = null, updated_at = now()
      where user_id = uid;
    -- The right PIN opens a short window to change it (Settings → change PIN).
    insert into public.parent_pin_windows (user_id, open_until)
    values (uid, now() + interval '5 minutes')
    on conflict (user_id) do update set open_until = excluded.open_until;
    return query select 'ok'::text, 0, null::timestamptz;
    return;
  end if;
  lock := public.parent_pin_failed();
  return query
    select case when lock is null then 'wrong' else 'locked' end,
           coalesce((select l.failures::integer from public.parent_pin_lockouts l where l.user_id = uid), 0),
           lock;
end;
$$;

-- A fresh email-code sign-in opens the window for the forgotten-PIN flow, and
-- clears the code's wrong-try count (the code was right). Called by the app
-- while the code's own session is active.
create function public.open_pin_reset_window() returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  fresh boolean;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' in ('otp', 'magiclink')
      and to_timestamp((a ->> 'timestamp')::double precision) > now() - interval '10 minutes'
  ) into fresh;
  if not fresh then
    return false;
  end if;
  insert into public.parent_pin_windows (user_id, open_until)
  values (uid, now() + interval '15 minutes')
  on conflict (user_id) do update set open_until = excluded.open_until;
  update public.pin_reset_code_lockouts
    set failures = 0, locked_until = null, updated_at = now()
    where user_id = uid;
  return true;
end;
$$;

-- 'ok' | 'invalid' | 'reauth' (no open window: enter the PIN or use the email code).
create function public.set_parent_pin(new_pin text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  has_pin boolean;
  has_minors boolean;
  window_open boolean;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce((select u.is_anonymous from auth.users u where u.id = uid), false) then
    raise exception 'save your account first' using errcode = '42501';
  end if;
  if new_pin is null or new_pin !~ '^\d{4}$' then
    return 'invalid';
  end if;
  select exists (select 1 from public.parent_pins p where p.user_id = uid) into has_pin;
  select exists (
    select 1 from public.profiles p
    where p.guardian_id = uid and p.mode in ('teen', 'child')
  ) into has_minors;
  select exists (
    select 1 from public.parent_pin_windows w where w.user_id = uid and w.open_until > now()
  ) into window_open;
  if (has_pin or has_minors) and not window_open then
    return 'reauth';
  end if;
  insert into public.parent_pins (user_id, pin_hash)
  values (uid, extensions.crypt(new_pin, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  delete from public.parent_pin_windows where user_id = uid;
  update public.parent_pin_lockouts
    set failures = 0, locked_until = null, updated_at = now()
    where user_id = uid;
  return 'ok';
end;
$$;

revoke all on function public.parent_pin_status() from public, anon;
revoke all on function public.verify_parent_pin(text) from public, anon;
revoke all on function public.open_pin_reset_window() from public, anon;
revoke all on function public.set_parent_pin(text) from public, anon;
grant execute on function public.parent_pin_status() to authenticated;
grant execute on function public.verify_parent_pin(text) to authenticated;
grant execute on function public.open_pin_reset_window() to authenticated;
grant execute on function public.set_parent_pin(text) to authenticated;

-- The client no longer clears its own locks: only a right PIN, a new PIN or
-- a fresh email-code sign-in does, inside the functions above.
revoke execute on function public.parent_pin_passed() from authenticated;
revoke execute on function public.pin_reset_code_passed() from authenticated;
