-- Supabase grants EXECUTE on new functions to anon by default. These two
-- security definer helpers are for signed-in users only (Supabase security
-- advisor, Sep 27 2026). Both already returned false without a session.

revoke execute on function public.can_access_profile(uuid) from anon;
revoke execute on function public.consume_coach_call(integer) from anon;
