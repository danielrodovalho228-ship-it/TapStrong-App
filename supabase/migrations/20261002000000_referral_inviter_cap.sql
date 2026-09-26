-- Referral reward, revised (Daniel, Sep 2026): the inviter gets 1 free week
-- per friend who completes a first workout, up to 4 weeks a year. The
-- invited person still gets 1 week, once (one referral per user).
alter table public.referrals add column inviter_rewarded_at timestamptz;

update public.referrals set inviter_rewarded_at = rewarded_at where inviter_rewarded;

comment on column public.referrals.inviter_rewarded is
  'The inviter received a week for this friend (cap: 4 in any 365 days, referral-reward function).';
