ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS support_whatsapp text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits integer DEFAULT 0;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;
