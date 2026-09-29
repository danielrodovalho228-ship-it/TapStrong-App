-- Security round 1, S2-04: fresh anonymous accounts could each spend the
-- per-user coach limit (~900 model calls an hour per IP). Besides the
-- per-user limit, the coach function now spends a per-IP (hashed, never the
-- raw address) and a global daily budget. Only the function (service role)
-- can spend it: a client calling this directly could burn everyone's budget.

create table public.coach_budget (
  scope text not null check (scope = 'global' or scope ~ '^ip:[0-9a-f]{64}$'),
  day date not null default (now() at time zone 'utc')::date,
  calls integer not null default 0 check (calls >= 0),
  primary key (scope, day)
);

alter table public.coach_budget enable row level security;
revoke all on public.coach_budget from anon, authenticated;

-- 'ok' | 'ip_limit' | 'global_limit'. A refused call is not counted.
create function public.consume_coach_budget(ip_hash text, ip_limit integer, global_limit integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  ip_scope text := 'ip:' || lower(ip_hash);
  used integer;
begin
  if ip_hash is null or lower(ip_hash) !~ '^[0-9a-f]{64}$' then
    raise exception 'bad ip hash' using errcode = '22023';
  end if;
  select b.calls into used from public.coach_budget b where b.scope = 'global' and b.day = today for update;
  if coalesce(used, 0) >= global_limit then
    return 'global_limit';
  end if;
  select b.calls into used from public.coach_budget b where b.scope = ip_scope and b.day = today for update;
  if coalesce(used, 0) >= ip_limit then
    return 'ip_limit';
  end if;
  insert into public.coach_budget as b (scope, day, calls) values ('global', today, 1), (ip_scope, today, 1)
  on conflict (scope, day) do update set calls = b.calls + 1;
  return 'ok';
end;
$$;

revoke all on function public.consume_coach_budget(text, integer, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.consume_coach_budget(text, integer, integer) to service_role;
  end if;
end $$;
