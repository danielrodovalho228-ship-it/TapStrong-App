-- Tests for referral codes, referrals and badges (Phase 5).
\set ON_ERROR_STOP on

insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000e1', false), -- inviter
  ('00000000-0000-0000-0000-0000000000e2', false), -- friend
  ('00000000-0000-0000-0000-0000000000e3', true);  -- anonymous

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

do $$
declare code text; again text;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
  code := public.my_referral_code();
  assert code ~ '^[A-Z2-9]{7}$', 'code has 7 unambiguous characters';
  again := public.my_referral_code();
  assert again = code, 'the same code comes back';
  assert public.redeem_referral(code) = false, 'own code is ignored';

  begin
    insert into public.referral_codes (user_id, code) values ('00000000-0000-0000-0000-0000000000e1', 'ABCDEFG');
    raise exception 'client wrote a referral code directly';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
  assert public.redeem_referral(lower(code)) = true, 'friend redeems (case-insensitive)';
  assert public.redeem_referral(code) = false, 'only once';
  assert public.redeem_referral('ZZZZZZZ') = false, 'unknown code ignored';
  assert (select count(*) from public.referrals) = 1, 'friend sees own referral';
  assert (select count(*) from public.referral_codes) = 0, 'friend cannot read the inviter code row';

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
  -- Security round 1: counts only, never who joined (no invited_user_id).
  assert (select count(*) from public.referrals) = 0, 'inviter reads invited_user_id';
  assert (select invited from public.my_referral_stats()) = 1, 'inviter sees the count';

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
  begin
    perform public.my_referral_code();
    raise exception 'anonymous user got a referral code';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

-- Badges follow the profile rules.
do $$ begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
  insert into public.profiles (id, user_id, birth_month, birth_year, sex, body_band, mode)
  values ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', 2, 1980, 'f', 'mid', 'adult');
  insert into public.badges (profile_id, key) values ('10000000-0000-0000-0000-0000000000e1', 'first_workout');
  begin
    insert into public.badges (profile_id, key) values ('10000000-0000-0000-0000-0000000000e1', 'made_up');
    raise exception 'unknown badge accepted';
  exception when check_violation then null;
  end;

  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
  assert (select count(*) from public.badges) = 0, 'stranger sees no badges';
  execute 'reset role';
end $$;

\echo 'account_growth: all assertions passed'
