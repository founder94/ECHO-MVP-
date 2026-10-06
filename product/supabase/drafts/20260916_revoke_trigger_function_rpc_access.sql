-- Trigger-only SECURITY DEFINER functions must not be exposed as RPCs.
-- PostgreSQL triggers keep calling these functions after EXECUTE is revoked
-- from browser-facing roles.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.doit_handoffs_owner_check() from public, anon, authenticated;
revoke execute on function public.pa_profiles_role_lock() from public, anon, authenticated;
revoke execute on function public.set_doit_updated_at() from public, anon, authenticated;

