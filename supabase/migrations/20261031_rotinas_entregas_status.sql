-- Passo 7: garantir colunas de status e conferência na tabela entregas

ALTER TABLE entregas
  ALTER COLUMN status SET DEFAULT 'pendente';

-- Índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_entregas_status ON entregas(status);
CREATE INDEX IF NOT EXISTS idx_entregas_created_at ON entregas(created_at DESC);

-- Índice para tarefas por prazo (usado no statsRotinasMes)
CREATE INDEX IF NOT EXISTS idx_tarefas_prazo ON tarefas(prazo);
CREATE INDEX IF NOT EXISTS idx_tarefas_setor ON tarefas(setor);

-- Índice para rotinas ativas
CREATE INDEX IF NOT EXISTS idx_rotinas_status ON rotinas(status);
