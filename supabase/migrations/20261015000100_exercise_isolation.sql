-- QA round 3 (P2): single-joint moves tagged with a push/pull pattern (flys,
-- face pulls, pullovers) are dosed 10–15, never heavy. The flag travels with
-- the exercise so released exercises keep it.
alter table public.exercises add column isolation boolean not null default false;
