-- Phase 28 (D): the links of shared cards. Each card shared by an adult or a
-- 60+ profile gets a short code (tapstrong.app/c/<code>); the public page
-- draws the card from its safe data: muscle keys, counts, an exercise id,
-- a template. Never weight, measurements, photos, place, exact time, pain,
-- restrictions or a name (the app builds it that way and a check refuses
-- those keys here too). Minors never get links. Only the owner (or the
-- guardian) sees and deletes their links; deleting the profile or the
-- account deletes them. The open count is never shown to anyone.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[a-hjkmnp-z2-9]{8}$'),
  template text not null check (template in (
    'workout', 'sticker', 'muscle', 'exercise', 'achievement', 'week', 'month', 'fun'
  )),
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and octet_length(data::text) <= 4096
    -- Defence in depth: no sensitive field names anywhere in the card.
    and data::text !~* '"[^"]*(weight|height|measure|bmi|whtr|photo|image|location|place|gps|pain|restriction|condition|name|email|birth)[^"]*"\s*:'
  ),
  opens integer not null default 0 check (opens >= 0),
  created_at timestamptz not null default now()
);

create index share_links_profile_idx on public.share_links (profile_id, created_at desc);

alter table public.share_links enable row level security;

create policy share_links_select on public.share_links
for select to authenticated
using (public.can_access_profile(profile_id));

-- Adults and 60+ only: the server's own age mode (tied to the birth date).
create policy share_links_insert on public.share_links
for insert to authenticated
with check (
  public.can_access_profile(profile_id)
  and exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.mode in ('adult', 'senior')
  )
);

create policy share_links_delete on public.share_links
for delete to authenticated
using (public.can_access_profile(profile_id));

-- No updates from the app (the open count belongs to the server).
revoke all on public.share_links from anon, authenticated;
grant select, insert, delete on public.share_links to authenticated;

-- A day's worth of new links per profile is plenty; more is abuse.
create function public.guard_share_links_rate() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.share_links s
      where s.profile_id = new.profile_id and s.created_at > now() - interval '1 day') >= 100 then
    raise exception 'too many share links today' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger share_links_rate before insert on public.share_links
for each row execute function public.guard_share_links_rate();

revoke all on function public.guard_share_links_rate() from public, anon, authenticated;

-- Opens per hashed IP (never the raw address) per day, for the public page.
create table public.share_open_budget (
  scope text not null check (scope ~ '^ip:[0-9a-f]{64}$'),
  day date not null default (now() at time zone 'utc')::date,
  opens integer not null default 0 check (opens >= 0),
  primary key (scope, day)
);

alter table public.share_open_budget enable row level security;
revoke all on public.share_open_budget from anon, authenticated;

-- The public page's lookup, called only by the share-link Edge Function
-- (service role): spends the IP's daily budget, counts the open, and
-- returns the card's template and data plus the owner's invite code (if
-- they have one). Unknown code, or over budget: nothing.
create function public.share_link_open(link_code text, ip_hash text, ip_limit integer)
returns table (template text, data jsonb, invite_code text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  ip_scope text := 'ip:' || lower(ip_hash);
  used integer;
  link public.share_links%rowtype;
begin
  if ip_hash is null or lower(ip_hash) !~ '^[0-9a-f]{64}$' then
    raise exception 'bad ip hash' using errcode = '22023';
  end if;
  select b.opens into used from public.share_open_budget b
  where b.scope = ip_scope and b.day = today for update;
  if coalesce(used, 0) >= ip_limit then
    return query select null::text, null::jsonb, null::text, 'limit'::text;
    return;
  end if;
  insert into public.share_open_budget as b (scope, day, opens) values (ip_scope, today, 1)
  on conflict (scope, day) do update set opens = b.opens + 1;

  if link_code is null or link_code !~ '^[a-hjkmnp-z2-9]{8}$' then
    return query select null::text, null::jsonb, null::text, 'not_found'::text;
    return;
  end if;
  update public.share_links s set opens = s.opens + 1
  where s.code = link_code
  returning s.* into link;
  if link.id is null then
    return query select null::text, null::jsonb, null::text, 'not_found'::text;
    return;
  end if;
  return query
    select link.template, link.data,
      (select rc.code from public.profiles p
         join public.referral_codes rc on rc.user_id = coalesce(p.user_id, p.guardian_id)
       where p.id = link.profile_id and p.mode in ('adult', 'senior')),
      'ok'::text;
end;
$$;

revoke all on function public.share_link_open(text, text, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.share_link_open(text, text, integer) to service_role;
  end if;
end $$;
