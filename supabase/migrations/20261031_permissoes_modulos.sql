-- Camada Admin: permissões modulares e rastreamento de último acesso

ALTER TABLE perfis_usuarios
  ADD COLUMN IF NOT EXISTS permissoes_modulos JSONB DEFAULT '{
    "modulo_pessoal":    true,
    "modulo_fiscal":     true,
    "modulo_contabil":   true,
    "modulo_societario": true,
    "modulo_financeiro": false,
    "acoes_financeiras": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;

COMMENT ON COLUMN perfis_usuarios.permissoes_modulos IS 'Permissões granulares por módulo do sistema';
COMMENT ON COLUMN perfis_usuarios.ultimo_acesso      IS 'Timestamp do último login registrado';

CREATE INDEX IF NOT EXISTS idx_perfis_permissoes ON perfis_usuarios USING gin(permissoes_modulos);
