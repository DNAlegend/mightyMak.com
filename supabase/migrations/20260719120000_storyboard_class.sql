-- The Storyboard studio saves finished boards as composite assets with
-- class 'storyboard' — but the assets_class_check constraint (last widened for
-- 'product') doesn't allow it, so every cloud insert of a storyboard silently
-- failed and boards vanished on the next hydrate. Widen the check.

alter table public.assets drop constraint if exists assets_class_check;
alter table public.assets
  add constraint assets_class_check
  check (class in ('character', 'dress', 'scene', 'dance', 'audio', 'product', 'storyboard'));
