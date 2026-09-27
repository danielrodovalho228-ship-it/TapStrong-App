-- Phase 10 — rotator cuff muscle (Daniel, Sep 2026): the shoulder recovery
-- plan strengthens it (SPEC §8 "Movement that hurts"). It has no body-map
-- hotspot: it sits under the deltoid, so it is never tapped on the map.

insert into public.muscles (key, region, views, label_i18n_key, parent_key, anatomy_i18n_key, movement_group)
select v.column1, v.column2::public.body_region, v.column3::public.body_view[], v.column4,
       v.column5::text, 'muscleAnatomy.' || v.column1, 'pull'::public.movement_group
from (values
  ('rotatorCuff', 'upper', '{}', 'muscles.rotatorCuff', null)
) as v;

-- Same statement shape as the other migrations (checked by the app's muscle test).
update public.muscles set movement_group = 'pull'
  where key in ('rotatorCuff');
