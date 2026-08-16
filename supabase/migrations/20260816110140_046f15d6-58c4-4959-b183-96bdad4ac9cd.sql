
-- migration to ensure profiles table has all necessary columns and sync schema cache
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS support_whatsapp text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

-- Ensure grants are correct
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
