CREATE TABLE public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    uses_remaining INT NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexar a chave para buscas rápidas
CREATE INDEX idx_licenses_key ON public.licenses(key);

-- Habilitar RLS
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, UPDATE ON public.licenses TO anon;
GRANT ALL ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;

-- Políticas de RLS

-- 1. Público (API de ativação) pode ler licenças ativas
CREATE POLICY "Public can read active licenses for activation"
ON public.licenses
FOR SELECT
TO anon
USING (status = 'active' AND uses_remaining > 0);

-- 2. Público (API de ativação) pode atualizar o contador de usos
CREATE POLICY "Public can update uses_remaining"
ON public.licenses
FOR UPDATE
TO anon
USING (status = 'active' AND uses_remaining > 0)
WITH CHECK (status IN ('active', 'exhausted') AND uses_remaining >= 0);

-- 3. Admins têm controle total
CREATE POLICY "Admins have full control"
ON public.licenses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
