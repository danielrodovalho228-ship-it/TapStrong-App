-- Phase 2 — body map and goals (SPEC §5, §9 /goals).
-- 1. Anatomical name per muscle, shown under the muscle name on the Goals
--    sheet (mockup 09). Text is reviewed with the exercise mappings.
-- 2. Session quantities chosen on the Goals sheet.

alter table public.muscles add column anatomy_i18n_key text;
update public.muscles set anatomy_i18n_key = 'muscleAnatomy.' || key;
alter table public.muscles alter column anatomy_i18n_key set not null;

alter table public.preferences
  add column exercises_per_session smallint not null default 5
    check (exercises_per_session between 2 and 10),
  add column sets_per_exercise smallint not null default 3
    check (sets_per_exercise between 1 and 6);
