
create or replace function public.increment_inventory(row_id uuid, amount int)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set license_inventory = license_inventory + amount
  where id = row_id;
end;
$$;

GRANT EXECUTE ON FUNCTION public.increment_inventory(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_inventory(uuid, int) TO service_role;
