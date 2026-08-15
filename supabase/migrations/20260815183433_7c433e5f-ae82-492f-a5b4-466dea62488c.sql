
-- Fix for SECURITY DEFINER function executable by public/authenticated users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Also fix any other existing functions that might be triggering this if they are security definer
-- (The linter mentioned 4 warnings, likely 2 from has_role and 2 from others or repeat detection)
