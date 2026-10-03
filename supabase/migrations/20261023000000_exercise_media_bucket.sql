-- TapStrong — Phase 32: released exercise clips in Supabase Storage (Daniel, Oct 3).
--
-- A public, read-only bucket: anyone can read a clip by its URL
-- (<project>/storage/v1/object/public/exercise-media/<slug>.<f|m>.mp4 and
-- posters/<slug>.<f|m>.webp), which is how the app streams and caches them.
-- No insert / update / delete policy exists for anon or authenticated, so with
-- RLS on storage.objects only the service role (scripts/upload-exercise-media.mjs,
-- run from a terminal) can write. Only small MP4 clips and WebP posters fit.
-- Holds no personal data.

do $$
begin
  if to_regclass('storage.buckets') is null then
    return; -- a plain Postgres without Supabase Storage (local tests stub it)
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('exercise-media', 'exercise-media', true, 2 * 1024 * 1024, array['video/mp4', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end $$;
