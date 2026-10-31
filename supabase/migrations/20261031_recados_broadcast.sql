-- Camada Admin: recados de leitura obrigatória

CREATE TABLE IF NOT EXISTS recados (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           TEXT NOT NULL,
  corpo            TEXT NOT NULL,
  destinatario_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL = global
  criado_por       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em        TIMESTAMPTZ                                          -- NULL = sem expiração
);

CREATE INDEX IF NOT EXISTS idx_recados_destinatario ON recados(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_recados_criado_em    ON recados(criado_em DESC);

-- Políticas RLS
ALTER TABLE recados ENABLE ROW LEVEL SECURITY;

-- Admin pode fazer tudo
CREATE POLICY recados_admin ON recados
  USING (
    EXISTS (
      SELECT 1 FROM perfis_usuarios
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Usuários podem ler recados globais ou direcionados a eles
CREATE POLICY recados_leitura ON recados FOR SELECT
  USING (
    destinatario_id IS NULL
    OR destinatario_id = auth.uid()
  );
