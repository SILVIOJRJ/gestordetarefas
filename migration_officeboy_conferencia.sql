-- Adiciona colunas de conferência ao fluxo do Office Boy
-- Execute no Supabase > SQL Editor > New Query

ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS conferido_por text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS conferido_em  timestamptz DEFAULT NULL;

-- Atualiza status antigo: entregas "Pendente" existentes ficam em "Pendente" (Guias Recebidas)
-- Nenhuma ação necessária para status existentes — o novo fluxo é aditivo
