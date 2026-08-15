
-- Fix inventory function security
alter function public.increment_inventory(uuid, int) set search_path = public;
revoke execute on function public.increment_inventory(uuid, int) from public, anon, authenticated;
grant execute on function public.increment_inventory(uuid, int) to service_role;
grant execute on function public.increment_inventory(uuid, int) to authenticated;
