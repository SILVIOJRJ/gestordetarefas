-- Notificações por usuário
CREATE TABLE IF NOT EXISTS notificacoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensagem   text NOT NULL,
  lido       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON notificacoes(user_id, created_at DESC);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Cada usuário só vê suas próprias notificações
CREATE POLICY "notificacoes_own" ON notificacoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin pode inserir para qualquer usuário
CREATE POLICY "notificacoes_admin_insert" ON notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM perfis_usuarios WHERE id = auth.uid()) = 'admin'
    OR user_id = auth.uid()
  );
