ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_upload BOOLEAN DEFAULT true;
NOTIFY pgrst, 'reload schema';