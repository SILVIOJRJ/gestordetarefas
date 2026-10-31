-- Extensão da tabela processos_legalizacao com campos detalhados de protocolos,
-- exigências, responsáveis conjuntos e tipo de ato societário.

-- Tipo de ato
ALTER TABLE processos_legalizacao
  ADD COLUMN IF NOT EXISTS tipo_ato TEXT
    CHECK (tipo_ato IN ('Abertura','Alteração Contratual','Consolidação','Baixa','Licenciamento Isolado','Outro'))
    DEFAULT 'Abertura';

-- Protocolos por órgão
ALTER TABLE processos_legalizacao
  ADD COLUMN IF NOT EXISTS protocolo_viabilidade      TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_dbe_redesim      TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_junta            TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal        TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual         TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_vigilancia       TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_bombeiros        TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_meio_ambiente    TEXT;

-- Exigências: [{ id, descricao, data_limite, responsavel, sanado, sanado_em }]
ALTER TABLE processos_legalizacao
  ADD COLUMN IF NOT EXISTS exigencias JSONB DEFAULT '[]'::jsonb;

-- Responsáveis conjuntos (nomes ou emails)
ALTER TABLE processos_legalizacao
  ADD COLUMN IF NOT EXISTS responsaveis_conjuntos TEXT[] DEFAULT '{}';

-- Etapa atual como coluna (migrar de obs)
ALTER TABLE processos_legalizacao
  ADD COLUMN IF NOT EXISTS etapa_atual TEXT DEFAULT 'Viabilidade';

-- GIN index em exigencias para buscas futuras
CREATE INDEX IF NOT EXISTS idx_processos_exigencias ON processos_legalizacao USING gin(exigencias);

-- ─── Responsáveis conjuntos em tarefas ────────────────────────
ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS responsaveis_conjuntos TEXT[] DEFAULT '{}';
