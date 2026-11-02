-- Corrige permissões da tabela anexos e do bucket Storage
-- Execute no Supabase > SQL Editor > New Query

-- 1. Garante que a tabela anexos existe com as colunas necessárias
CREATE TABLE IF NOT EXISTS anexos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia_tipo text NOT NULL,
  referencia_id   uuid NOT NULL,
  nome_original   text,
  url             text,
  criado_por      text,
  criado_em       timestamptz DEFAULT now()
);

-- 2. Habilita RLS (se não estiver)
ALTER TABLE anexos ENABLE ROW LEVEL SECURITY;

-- 3. Remove policies antigas conflitantes (se existirem)
DROP POLICY IF EXISTS "anexos_select" ON anexos;
DROP POLICY IF EXISTS "anexos_insert" ON anexos;
DROP POLICY IF EXISTS "anexos_delete" ON anexos;
DROP POLICY IF EXISTS "Permitir tudo autenticados" ON anexos;

-- 4. Cria policies permissivas para usuários autenticados
CREATE POLICY "anexos_select" ON anexos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "anexos_insert" ON anexos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "anexos_delete" ON anexos
  FOR DELETE TO authenticated USING (true);

-- 5. Storage: policies para o bucket 'anexos'
-- (Execute também se o upload ao Storage estiver bloqueando)
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos', 'anexos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy de upload no Storage
DROP POLICY IF EXISTS "storage_anexos_insert" ON storage.objects;
CREATE POLICY "storage_anexos_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'anexos');

DROP POLICY IF EXISTS "storage_anexos_select" ON storage.objects;
CREATE POLICY "storage_anexos_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'anexos');

DROP POLICY IF EXISTS "storage_anexos_delete" ON storage.objects;
CREATE POLICY "storage_anexos_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'anexos');
