-- QA round 3 (P2): the parent PIN lockout is mirrored on the server, so
-- clearing or editing the phone's storage doesn't reset the 5-try limit
-- while the phone is online. Only the account's own row, only through these
-- functions; the PIN itself never leaves the phone.

create table public.parent_pin_lockouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  failures smallint not null default 0 check (failures between 0 and 5),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.parent_pin_lockouts enable row level security;
-- No policies: clients use the functions below.
revoke all on public.parent_pin_lockouts from anon, authenticated;

-- A wrong PIN: count it; the 5th locks for 15 minutes. Returns the lock end, if any.
create function public.parent_pin_failed() returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rec public.parent_pin_lockouts;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.parent_pin_lockouts as l (user_id, failures)
  values (uid, 1)
  on conflict (user_id) do update
    set failures = case
          when l.locked_until is not null and l.locked_until > now() then l.failures
          when l.locked_until is not null then 1
          else l.failures + 1
        end,
        locked_until = case
          when l.locked_until is not null and l.locked_until <= now() then null
          else l.locked_until
        end,
        updated_at = now()
  returning * into rec;
  if rec.failures >= 5 then
    update public.parent_pin_lockouts
      set failures = 0, locked_until = now() + interval '15 minutes', updated_at = now()
      where user_id = uid
      returning * into rec;
  end if;
  return case when rec.locked_until > now() then rec.locked_until end;
end;
$$;

-- The right PIN, or a new PIN after the email reset: clear the count.
create function public.parent_pin_passed() returns void
language sql
security definer
set search_path = ''
as $$
  update public.parent_pin_lockouts
    set failures = 0, locked_until = null, updated_at = now()
    where user_id = (select auth.uid());
$$;

-- When the lock ends, or null when not locked.
create function public.parent_pin_locked_until() returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select l.locked_until from public.parent_pin_lockouts l
  where l.user_id = (select auth.uid()) and l.locked_until > now();
$$;

revoke all on function public.parent_pin_failed() from public, anon;
revoke all on function public.parent_pin_passed() from public, anon;
revoke all on function public.parent_pin_locked_until() from public, anon;
grant execute on function public.parent_pin_failed() to authenticated;
grant execute on function public.parent_pin_passed() to authenticated;
grant execute on function public.parent_pin_locked_until() to authenticated;
