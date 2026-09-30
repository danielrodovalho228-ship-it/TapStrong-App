-- Phase 26 ("Month closed"): one row per closed block and profile: the small
-- summary (counts, sets per muscle, strength, records, highlights), the
-- choice for the next month and the exercise swaps (from → to, reason).
-- No body measurements or photos here (they stay in checkins / on the
-- phone), and a minor's summary never carries weights or records (the app
-- builds it that way). Same access as the other progress tables: the
-- profile's owner or guardian (can_access_profile).

create table public.month_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  block_no smallint not null check (block_no between 0 and 1000),
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on and ends_on <= starts_on + 42),
  summary jsonb not null check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) < 16384),
  choice text check (choice in ('continue', 'repeat', 'body', 'auto')),
  changes jsonb not null default '[]' check (jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) <= 40),
  focus jsonb not null default '[]' check (jsonb_typeof(focus) = 'array' and jsonb_array_length(focus) <= 2),
  undo_until timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, starts_on)
);

create index month_reviews_profile_idx on public.month_reviews (profile_id, starts_on desc);

alter table public.month_reviews enable row level security;

create policy month_reviews_all on public.month_reviews
for all to authenticated
using (public.can_access_profile(profile_id))
with check (public.can_access_profile(profile_id));

revoke all on public.month_reviews from anon;
