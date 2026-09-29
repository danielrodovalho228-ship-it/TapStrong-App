-- Security round 1, S2-07: the Account email code had no verify limit of its
-- own. 5 wrong codes for an email lock verifying it for 15 minutes, counted
-- here per caller session (the email is stored only as a SHA-256 hash).
-- Supabase's own per-IP limits still apply on top.

create table public.account_code_lockouts (
  user_id uuid not null references auth.users (id) on delete cascade,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  failures smallint not null default 0 check (failures between 0 and 5),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, email_hash)
);

alter table public.account_code_lockouts enable row level security;
revoke all on public.account_code_lockouts from anon, authenticated;

create function public.account_email_hash(email text) returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(lower(trim(email)), 'sha256'), 'hex');
$$;

revoke all on function public.account_email_hash(text) from public, anon, authenticated;

-- A wrong code: count it; the 5th locks for 15 minutes. Returns the lock end, if any.
create function public.account_code_failed(email text) returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  h text := public.account_email_hash(email);
  rec public.account_code_lockouts;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.account_code_lockouts as l (user_id, email_hash, failures)
  values (uid, h, 1)
  on conflict (user_id, email_hash) do update
    set failures = case
          when l.locked_until is not null and l.locked_until > now() then l.failures
          when l.locked_until is not null then 1
          else l.failures + 1
        end,
        locked_until = case when l.locked_until is not null and l.locked_until <= now() then null
                            else l.locked_until end,
        updated_at = now()
  returning * into rec;
  if rec.failures >= 5 then
    update public.account_code_lockouts
      set failures = 0, locked_until = now() + interval '15 minutes', updated_at = now()
      where user_id = uid and email_hash = h
      returning * into rec;
  end if;
  return case when rec.locked_until > now() then rec.locked_until end;
end;
$$;

create function public.account_code_locked_until(email text) returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select l.locked_until from public.account_code_lockouts l
  where l.user_id = (select auth.uid())
    and l.email_hash = public.account_email_hash(email)
    and l.locked_until > now();
$$;

revoke all on function public.account_code_failed(text) from public, anon;
revoke all on function public.account_code_locked_until(text) from public, anon;
grant execute on function public.account_code_failed(text) to authenticated;
grant execute on function public.account_code_locked_until(text) to authenticated;
