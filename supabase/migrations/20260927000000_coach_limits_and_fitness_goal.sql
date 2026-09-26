-- Phase 1 follow-ups approved by Daniel (Sep 27, 2026):
-- 1. "fitness" main goal ("More fitness / energy"), offered to under-18s in
--    place of "lose_weight" (SPEC §2.3: no body-fat language for minors).
-- 2. Per-user daily limit on coach (Claude) calls. Users get an anonymous
--    Supabase session before calling the coach; the Edge Function spends one
--    call through consume_coach_call().

alter type public.main_goal add value if not exists 'fitness';

create table public.coach_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  calls integer not null default 0 check (calls >= 0),
  primary key (user_id, day)
);

-- No policies: rows are only touched through consume_coach_call().
alter table public.coach_usage enable row level security;

create function public.consume_coach_call(daily_limit integer default 30) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  used integer;
begin
  if uid is null or daily_limit < 1 then
    return false;
  end if;

  insert into public.coach_usage as u (user_id, day, calls)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set calls = u.calls + 1
  returning u.calls into used;

  return used <= daily_limit;
end;
$$;

revoke all on function public.consume_coach_call(integer) from public;
grant execute on function public.consume_coach_call(integer) to authenticated;
