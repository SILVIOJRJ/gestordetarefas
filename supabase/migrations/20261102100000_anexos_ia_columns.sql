-- Colunas de rastreio de processamento IA nos anexos

ALTER TABLE anexos
  ADD COLUMN IF NOT EXISTS competencia     TEXT,
  ADD COLUMN IF NOT EXISTS tipo_documento  TEXT,
  ADD COLUMN IF NOT EXISTS status_ia       TEXT DEFAULT 'Processado com IA',
  ADD COLUMN IF NOT EXISTS alocado         BOOLEAN DEFAULT false;
