-- Adiciona a função increment_credits se não existir
CREATE OR REPLACE FUNCTION public.increment_credits(row_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET credits = COALESCE(credits, 0) + amount
  WHERE id = row_id;
END;
$$;

-- Garante permissões de execução para usuários autenticados e service_role
GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, integer) TO service_role;

-- Garante que o service_role possa deletar licenças
GRANT DELETE ON public.licenses TO service_role;
GRANT DELETE ON public.profiles TO service_role;
GRANT DELETE ON public.user_roles TO service_role;

-- Recarrega o schema do PostgREST
NOTIFY pgrst, 'reload schema';
