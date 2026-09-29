-- Security round 2, S2-P2-2 / S2-P2-3.
--
-- S2-P2-2: any right PIN opened a 5-minute window in which anyone holding the
-- phone could set a new PIN without knowing the old one. Now:
--  - verify_parent_pin opens no window;
--  - set_parent_pin(new_pin, old_pin) changes a PIN only with the right old
--    PIN (same counter and lock, same row lock) or inside the window a fresh
--    email-code sign-in opens (10 minutes, used once);
--  - a first PIN needs neither only while the account manages no minors.
-- S2-P2-3: every answer carries the PIN's version (when it was set), so a
-- phone can tell its offline copy is stale.

drop function public.verify_parent_pin(text);
drop function public.set_parent_pin(text);

-- The shared check, under the account's counter row lock (S2-P1-1).
create function public.check_parent_pin(uid uuid, pin text)
returns table (result text, failures integer, locked_until timestamptz, pin_version timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.parent_pin_lockouts;
  stored text;
  version timestamptz;
  tries integer;
begin
  insert into public.parent_pin_lockouts (user_id) values (uid) on conflict (user_id) do nothing;
  select * into rec from public.parent_pin_lockouts l where l.user_id = uid for update;
  select p.pin_hash, p.updated_at into stored, version from public.parent_pins p where p.user_id = uid;

  if rec.locked_until is not null and rec.locked_until > now() then
    return query select 'locked'::text, 0, rec.locked_until, version;
    return;
  end if;
  if stored is null then
    return query select 'no_pin'::text, 0, null::timestamptz, null::timestamptz;
    return;
  end if;

  tries := case when rec.locked_until is not null then 0 else rec.failures end;
  if pin is not null and pin ~ '^\d{4}$' and extensions.crypt(pin, stored) = stored then
    update public.parent_pin_lockouts
      set failures = 0, locked_until = null, updated_at = now()
      where user_id = uid;
    return query select 'ok'::text, 0, null::timestamptz, version;
    return;
  end if;

  tries := tries + 1;
  if tries >= 5 then
    update public.parent_pin_lockouts
      set failures = 0, locked_until = now() + interval '15 minutes', updated_at = now()
      where user_id = uid
      returning * into rec;
    return query select 'locked'::text, 0, rec.locked_until, version;
    return;
  end if;
  update public.parent_pin_lockouts
    set failures = tries, locked_until = null, updated_at = now()
    where user_id = uid;
  return query select 'wrong'::text, tries, null::timestamptz, version;
end;
$$;

revoke all on function public.check_parent_pin(uuid, text) from public, anon, authenticated;

create function public.verify_parent_pin(pin text)
returns table (result text, failures integer, locked_until timestamptz, pin_version timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return query select * from public.check_parent_pin(uid, pin);
end;
$$;

-- 'ok' | 'invalid' | 'reauth' | 'wrong' | 'locked'
create function public.set_parent_pin(new_pin text, old_pin text default null) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  has_pin boolean;
  has_minors boolean;
  window_open boolean;
  checked record;
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
    select 1 from public.profiles p where p.guardian_id = uid and p.mode in ('teen', 'child')
  ) into has_minors;
  select exists (
    select 1 from public.parent_pin_windows w where w.user_id = uid and w.open_until > now()
  ) into window_open;

  if has_pin and old_pin is not null and not window_open then
    select * into checked from public.check_parent_pin(uid, old_pin);
    if checked.result <> 'ok' then
      return checked.result;
    end if;
  elsif (has_pin or has_minors) and not window_open then
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

-- The email-code window: 10 minutes (was 15), used once by set_parent_pin.
create or replace function public.open_pin_reset_window() returns boolean
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
  values (uid, now() + interval '10 minutes')
  on conflict (user_id) do update set open_until = excluded.open_until;
  update public.pin_reset_code_lockouts
    set failures = 0, locked_until = null, updated_at = now()
    where user_id = uid;
  return true;
end;
$$;

-- Old windows opened by a right PIN are no longer valid.
delete from public.parent_pin_windows;

revoke all on function public.verify_parent_pin(text) from public, anon;
revoke all on function public.set_parent_pin(text, text) from public, anon;
revoke all on function public.open_pin_reset_window() from public, anon;
grant execute on function public.verify_parent_pin(text) to authenticated;
grant execute on function public.set_parent_pin(text, text) to authenticated;
grant execute on function public.open_pin_reset_window() to authenticated;
