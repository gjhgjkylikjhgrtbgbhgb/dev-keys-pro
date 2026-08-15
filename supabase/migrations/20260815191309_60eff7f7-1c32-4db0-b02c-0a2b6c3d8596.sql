GRANT INSERT ON public.licenses TO authenticated;
GRANT INSERT ON public.licenses TO anon;

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insert para todos" ON public.licenses;
CREATE POLICY "Permitir insert para todos" ON public.licenses FOR INSERT TO public WITH CHECK (true);
