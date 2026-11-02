-- Coluna para pasta do arquivo digital no dossiê do cliente
ALTER TABLE anexos
  ADD COLUMN IF NOT EXISTS categoria_pasta TEXT;
-- Valores: SOCIETARIO | CONTABIL | PESSOAL | FINANCEIRO
