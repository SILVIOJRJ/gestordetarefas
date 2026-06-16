-- Suporte a múltiplos setores por funcionário
-- Execute no Supabase > SQL Editor > New Query

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS setores_ids text[];
