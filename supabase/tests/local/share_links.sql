-- Phase 28 (D): share links. Only the owner (or guardian) sees and deletes
-- them; minors never get one; nobody but the server changes the open count;
-- no sensitive field names get in; the public lookup (service role only)
-- counts the open, returns only the card, and stops at the IP's daily limit;
-- deleting the profile deletes its links.
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000028a1', false), -- owner O
  ('00000000-0000-0000-0000-0000000028a2', false), -- stranger S
  ('00000000-0000-0000-0000-0000000028a3', false); -- a teen T with a login
insert into public.profiles (id, user_id, birth_month, birth_year, body_band, mode) values
  ('00000000-0000-0000-0000-0000000028b1', '00000000-0000-0000-0000-0000000028a1', 4, 1985, 'adult', 'adult'),
  ('00000000-0000-0000-0000-0000000028b2', '00000000-0000-0000-0000-0000000028a2', 4, 1990, 'adult', 'adult'),
  ('00000000-0000-0000-0000-0000000028b3', '00000000-0000-0000-0000-0000000028a3', 4, 2011, 'teen', 'teen');
insert into public.referral_codes (user_id, code) values ('00000000-0000-0000-0000-0000000028a1', 'OWNER28');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$
declare
  n integer;
  r record;
  card jsonb := '{"template":"muscle","muscle":"glutes","lit":{"glutes":"main"}}';
  ip text := repeat('a', 64);
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000028a1');
  insert into public.share_links (profile_id, code, template, data)
  values ('00000000-0000-0000-0000-0000000028b1', 'abcd2345', 'muscle', card);
  select count(*) into n from public.share_links;
  if n <> 1 then raise exception 'owner cannot see their link'; end if;

  -- Not onto someone else's profile.
  begin
    insert into public.share_links (profile_id, code, template, data)
    values ('00000000-0000-0000-0000-0000000028b2', 'abcd2346', 'muscle', card);
    raise exception 'owner made a link for another profile';
  exception when insufficient_privilege then null;
  end;
  -- The open count is the server's.
  begin
    update public.share_links set opens = 999;
    raise exception 'owner changed the open count';
  exception when insufficient_privilege then null;
  end;
  -- Bad codes, templates and sensitive fields are refused.
  begin
    insert into public.share_links (profile_id, code, template, data)
    values ('00000000-0000-0000-0000-0000000028b1', 'ABCD-123', 'muscle', card);
    raise exception 'bad code stored';
  exception when check_violation then null;
  end;
  begin
    insert into public.share_links (profile_id, code, template, data)
    values ('00000000-0000-0000-0000-0000000028b1', 'abcd2347', 'body_photo', card);
    raise exception 'unknown template stored';
  exception when check_violation then null;
  end;
  begin
    insert into public.share_links (profile_id, code, template, data)
    values ('00000000-0000-0000-0000-0000000028b1', 'abcd2348', 'workout',
            '{"template":"workout","weightKg":82}');
    raise exception 'body weight stored in a card';
  exception when check_violation then null;
  end;
  begin
    insert into public.share_links (profile_id, code, template, data)
    values ('00000000-0000-0000-0000-0000000028b1', 'abcd2349', 'achievement',
            '{"template":"achievement","params":{"painArea":"knee"}}');
    raise exception 'a pain area stored in a card';
  exception when check_violation then null;
  end;

  -- A teen never gets a link, even for their own profile.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000028a3');
  begin
    insert into public.share_links (profile_id, code, template, data)
    values ('00000000-0000-0000-0000-0000000028b3', 'teen2345', 'muscle', card);
    raise exception 'a minor got a public link';
  exception when insufficient_privilege then null;
  end;

  -- A stranger sees nothing and deletes nothing, and cannot run the lookup.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000028a2');
  select count(*) into n from public.share_links;
  if n <> 0 then raise exception 'a stranger read a share link'; end if;
  delete from public.share_links;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'a stranger deleted a share link'; end if;
  begin
    perform public.share_link_open('abcd2345', ip, 100);
    raise exception 'a signed-in user ran the public lookup';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
  begin
    perform 1 from public.share_links;
    raise exception 'anon read share links';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.share_link_open('abcd2345', ip, 100);
    raise exception 'anon ran the lookup directly';
  exception when insufficient_privilege then null;
  end;

  -- The server's lookup (the Edge Function runs it as the service role).
  execute 'reset role';
  select * into r from public.share_link_open('abcd2345', ip, 3);
  if r.status <> 'ok' or r.template <> 'muscle' or r.data <> card or r.invite_code <> 'OWNER28' then
    raise exception 'lookup returned %', row_to_json(r);
  end if;
  select * into r from public.share_link_open('zzzz2345', ip, 3);
  if r.status <> 'not_found' or r.data is not null then raise exception 'unknown code found'; end if;
  select * into r from public.share_link_open('abcd2345', ip, 3);
  select * into r from public.share_link_open('abcd2345', ip, 3);
  if r.status <> 'limit' or r.data is not null then raise exception 'IP limit not applied'; end if;
  select opens into n from public.share_links where code = 'abcd2345';
  if n <> 2 then raise exception 'opens counted % times, expected 2', n; end if;
  -- Another IP still gets through.
  select * into r from public.share_link_open('abcd2345', repeat('b', 64), 3);
  if r.status <> 'ok' then raise exception 'another IP was limited'; end if;

  -- The owner deletes their own link; deleting the profile deletes the rest.
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000028a1');
  insert into public.share_links (profile_id, code, template, data)
  values ('00000000-0000-0000-0000-0000000028b1', 'efgh2345', 'muscle', card);
  delete from public.share_links where code = 'abcd2345';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'owner could not delete their link'; end if;
  execute 'reset role';
  delete from auth.users where id = '00000000-0000-0000-0000-0000000028a1';
  select count(*) into n from public.share_links;
  if n <> 0 then raise exception 'links survived the account deletion'; end if;

  raise notice 'share_links: all assertions passed';
end $$;
