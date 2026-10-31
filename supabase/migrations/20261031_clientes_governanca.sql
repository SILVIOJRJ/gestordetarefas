-- Passo 9: campos de governança no perfil do cliente

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS vinculo_atendimento TEXT
    CHECK (vinculo_atendimento IN ('Exclusivo Denazaré', 'Exclusivo Silvio', 'Carteira Conjunta')),
  ADD COLUMN IF NOT EXISTS contatos_chave      JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_costumes     TEXT;

COMMENT ON COLUMN clientes.vinculo_atendimento IS 'Responsável principal pelo atendimento do cliente';
COMMENT ON COLUMN clientes.contatos_chave      IS 'Array JSON com {nome, cargo, whatsapp, email_guias}';
COMMENT ON COLUMN clientes.manual_costumes     IS 'Manual de costumes e particularidades em Markdown';

CREATE INDEX IF NOT EXISTS idx_clientes_vinculo ON clientes(vinculo_atendimento);
