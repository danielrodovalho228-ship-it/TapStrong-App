-- Improvements v1, D2: more personal badges (no global leaderboards).
alter table public.badges drop constraint badges_key_check;
alter table public.badges add constraint badges_key_check check (key in (
  'first_workout', 'streak_7', 'streak_30', 'first_pr', 'full_body_week',
  'streak_weeks_4', 'streak_weeks_12', 'streak_weeks_26', 'streak_weeks_52',
  'volume_1', 'volume_2', 'volume_3', 'repair_phase', 'balance_30', 'workouts_100'
));
