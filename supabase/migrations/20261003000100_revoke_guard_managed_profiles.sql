-- Trigger functions are never called directly; keep them off the RPC surface
-- (Supabase security advisor 0028/0029).
revoke all on function public.guard_managed_profiles() from public, anon, authenticated;
