-- Phase 32: the exercise-media bucket is public to read and closed to write.
\set ON_ERROR_STOP on
\o /dev/null

do $$ begin
  assert (select public from storage.buckets where id = 'exercise-media'), 'bucket is public (read by URL)';
  assert (select file_size_limit from storage.buckets where id = 'exercise-media') = 2097152,
    'clips stay small (2 MB)';
  assert (select allowed_mime_types from storage.buckets where id = 'exercise-media')
    = array['video/mp4', 'image/webp'], 'only clips and posters';
  -- No policy lets anon or authenticated write anything to it.
  assert not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (roles && array['anon', 'authenticated', 'public']::name[])
  ), 'no write policy on storage.objects';
end $$;

-- Role switch: anon and a signed-in user cannot upload or replace a clip.
create or replace function pg_temp.denied(r text) returns void language plpgsql as $$
begin
  execute format('set local role %I', r);
  begin
    insert into storage.objects (bucket_id, name) values ('exercise-media', 'evil.f.mp4');
    raise exception '% could upload to exercise-media', r;
  exception when insufficient_privilege then null;
  end;
  begin
    update storage.objects set name = 'x' where bucket_id = 'exercise-media';
    if found then raise exception '% could rename a clip', r; end if;
  end;
  reset role;
end $$;

begin;
select pg_temp.denied('anon');
select pg_temp.denied('authenticated');
rollback;
