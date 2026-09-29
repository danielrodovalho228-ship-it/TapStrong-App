-- Security round 2, P3 (database side).
--
-- 1. Referral fake workout: first_completed_workout trusted the client's
--    started_at / ended_at. Sessions now carry two server times the client
--    can't write: when the session first reached the server (the app sends it
--    when the workout starts) and when it first arrived as done. A workout
--    counts for the referral only with at least 10 real minutes between them.
-- 2. A guardian could delete the profile of a teen who has their own login
--    (profiles_delete allowed guardian_id = uid). Now only the profile's own
--    login deletes it; a guardian deletes only profiles without a login.
-- 3. parent_pin_failed() was still executable by clients (self-lock only);
--    only verify_parent_pin (definer) calls it now.

alter table public.sessions
  add column received_at timestamptz,
  add column done_received_at timestamptz;

create function public.stamp_session_received() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Server times are the server's: a client (any request with a user) can
  -- never set or move them. Server-side code (no user) may backfill.
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null or new.received_at is null then
      new.received_at := now();
    end if;
    if (select auth.uid()) is not null or new.done_received_at is null then
      new.done_received_at := case when new.status = 'done' then now() end;
    end if;
  elsif (select auth.uid()) is not null then
    new.received_at := old.received_at;
    new.done_received_at := coalesce(
      old.done_received_at,
      case when new.status = 'done' then now() end);
  end if;
  return new;
end;
$$;

revoke all on function public.stamp_session_received() from public, anon, authenticated;

create trigger sessions_stamp_received
before insert or update on public.sessions
for each row execute function public.stamp_session_received();

create or replace function public.first_completed_workout(uid uuid) returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(s.done_received_at)
  from public.sessions s
  join public.profiles p on p.id = s.profile_id
  where p.user_id = uid
    and s.status = 'done'
    and s.started_at is not null
    and s.ended_at >= s.started_at + interval '10 minutes'
    -- 10 real minutes on the server between the start and the finish.
    and s.done_received_at >= s.received_at + interval '10 minutes'
    and (select count(*) from public.set_logs l
         join public.session_items i on i.id = l.session_item_id
         where i.session_id = s.id) >= 6;
$$;

revoke all on function public.first_completed_workout(uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.first_completed_workout(uuid) to service_role;
  end if;
end $$;

drop policy profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
for delete to authenticated
using (
  user_id = (select auth.uid())
  or (guardian_id = (select auth.uid()) and user_id is null)
);

revoke execute on function public.parent_pin_failed() from authenticated;
