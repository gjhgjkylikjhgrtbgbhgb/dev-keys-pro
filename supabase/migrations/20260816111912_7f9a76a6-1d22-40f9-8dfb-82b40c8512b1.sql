-- Garante que o service_role e usuários autenticados possam ver os nomes de todos os perfis para a listagem
GRANT SELECT ON public.profiles TO authenticated;

-- Garante que a role service_role possa fazer tudo em user_roles
GRANT ALL ON public.user_roles TO service_role;

-- Garante que a role service_role possa fazer tudo em licenses
GRANT ALL ON public.licenses TO service_role;

-- Garante que a role service_role possa fazer tudo em profiles
GRANT ALL ON public.profiles TO service_role;

NOTIFY pgrst, 'reload schema';