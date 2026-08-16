create or replace function public.increment_credits(row_id uuid, amount int)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set credits = credits + amount
  where id = row_id;
end;
$$;

GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, int) TO service_role;
