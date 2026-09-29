-- Security round 2, S2-P1-1: verify_parent_pin read the lock without a row
-- lock, ran bcrypt, then counted the failure, so wrong PINs sent together were
-- all checked before the 5th locked the PIN. Now the account's counter row is
-- created if needed and locked FOR UPDATE first, and held through the compare
-- and the count: parallel tries queue up and at most 5 are ever checked
-- before the lock.

create or replace function public.verify_parent_pin(pin text)
returns table (result text, failures integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rec public.parent_pin_lockouts;
  stored text;
  tries integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.parent_pin_lockouts (user_id) values (uid) on conflict (user_id) do nothing;
  select * into rec from public.parent_pin_lockouts l where l.user_id = uid for update;

  if rec.locked_until is not null and rec.locked_until > now() then
    return query select 'locked'::text, 0, rec.locked_until;
    return;
  end if;

  select p.pin_hash into stored from public.parent_pins p where p.user_id = uid;
  if stored is null then
    return query select 'no_pin'::text, 0, null::timestamptz;
    return;
  end if;

  -- An expired lock starts a fresh count.
  tries := case when rec.locked_until is not null then 0 else rec.failures end;

  if pin is not null and pin ~ '^\d{4}$' and extensions.crypt(pin, stored) = stored then
    update public.parent_pin_lockouts
      set failures = 0, locked_until = null, updated_at = now()
      where user_id = uid;
    insert into public.parent_pin_windows (user_id, open_until)
    values (uid, now() + interval '5 minutes')
    on conflict (user_id) do update set open_until = excluded.open_until;
    return query select 'ok'::text, 0, null::timestamptz;
    return;
  end if;

  tries := tries + 1;
  if tries >= 5 then
    update public.parent_pin_lockouts
      set failures = 0, locked_until = now() + interval '15 minutes', updated_at = now()
      where user_id = uid
      returning * into rec;
    return query select 'locked'::text, 0, rec.locked_until;
    return;
  end if;
  update public.parent_pin_lockouts
    set failures = tries, locked_until = null, updated_at = now()
    where user_id = uid;
  return query select 'wrong'::text, tries, null::timestamptz;
end;
$$;

revoke all on function public.verify_parent_pin(text) from public, anon;
grant execute on function public.verify_parent_pin(text) to authenticated;
