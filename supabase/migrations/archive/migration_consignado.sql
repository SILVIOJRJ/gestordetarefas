-- Adiciona campo de empréstimo consignado às obrigações de clientes
-- Execute no Supabase > SQL Editor > New Query

ALTER TABLE obrigacoes_clientes
  ADD COLUMN IF NOT EXISTS valor_consignado numeric(12,2) DEFAULT NULL;

COMMENT ON COLUMN obrigacoes_clientes.valor_consignado IS
  'Desconto de empréstimo consignado (somado ao FGTS no Controle Gerencial)';
