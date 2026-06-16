-- Painel Administrativo: log de acessos por funcionário
-- Execute no Supabase > SQL Editor > New Query

CREATE TABLE IF NOT EXISTS acessos_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_nome  text,
  funcionario_email text,
  setor             text,
  acessado_em       timestamptz DEFAULT now()
);

ALTER TABLE acessos_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acessos_log_insert" ON acessos_log;
DROP POLICY IF EXISTS "acessos_log_select" ON acessos_log;

-- Qualquer autenticado pode inserir seu próprio acesso
CREATE POLICY "acessos_log_insert" ON acessos_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Somente leitura para autenticados (o painel filtra por admin no JS)
CREATE POLICY "acessos_log_select" ON acessos_log
  FOR SELECT TO authenticated USING (true);
