-- Adiciona colunas faltantes na tabela gerencial_mensal
-- Execute no Supabase > SQL Editor > New Query

ALTER TABLE gerencial_mensal
  ADD COLUMN IF NOT EXISTS folha_pagamento numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pis_cofins      numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS receita_servicos numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS receita_vendas  numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS despesas_total  numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS caixa_atual     numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS atualizado_por  text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz   DEFAULT now(),
  ADD COLUMN IF NOT EXISTS obs             text          DEFAULT NULL;

-- Garante constraint única para o upsert funcionar
ALTER TABLE gerencial_mensal
  DROP CONSTRAINT IF EXISTS gerencial_mensal_cliente_comp_unique;

ALTER TABLE gerencial_mensal
  ADD CONSTRAINT gerencial_mensal_cliente_comp_unique
  UNIQUE (cliente_id, competencia);
