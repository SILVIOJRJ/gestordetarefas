-- Colunas adicionais para ClienteForm reconstruído

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS whatsapp            TEXT,
  ADD COLUMN IF NOT EXISTS observacoes         TEXT,
  ADD COLUMN IF NOT EXISTS setores_contratados TEXT[] DEFAULT '{}';
