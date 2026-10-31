-- Bucket privado para documentos de empresas
-- NUNCA definir como public = true — acesso exclusivo via Signed URLs

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-empresa',
  'documentos-empresa',
  false,                          -- bucket PRIVADO
  20971520,                       -- 20 MB por arquivo
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = false,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies de Storage: apenas usuários autenticados

DROP POLICY IF EXISTS "docs_empresa_insert" ON storage.objects;
CREATE POLICY "docs_empresa_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-empresa');

DROP POLICY IF EXISTS "docs_empresa_select" ON storage.objects;
CREATE POLICY "docs_empresa_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-empresa');

DROP POLICY IF EXISTS "docs_empresa_delete" ON storage.objects;
CREATE POLICY "docs_empresa_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-empresa');

-- UPDATE bloqueado: documentos são imutáveis após upload
