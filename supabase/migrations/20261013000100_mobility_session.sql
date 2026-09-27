-- QA round 2, decision 1: the short mobility session (~10 min) is its own
-- session kind. It counts as an active day for the streak and never counts
-- toward the free plan's 3 workouts a week.
alter type public.session_kind add value if not exists 'mobility';
