CREATE TABLE IF NOT EXISTS parcelamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID REFERENCES clientes(id) ON DELETE SET NULL,
  codigo           TEXT,
  tipo             TEXT NOT NULL DEFAULT 'Outro',      -- Previdência | Simples Nacional | Outro
  orgao            TEXT,                               -- ESTADO | PGFN | RFB | MUNICÍPIO
  total_parcelas   INT,
  parcela_atual    INT,
  valor            NUMERIC(14,2),
  vencimento       DATE,
  login            TEXT,
  senha            TEXT,
  obs              TEXT,
  status           TEXT NOT NULL DEFAULT 'Em andamento', -- Em andamento | Concluído | Atrasado | Env. Cliente
  enviado_cliente  BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parcelamentos_cliente_id_idx ON parcelamentos(cliente_id);
CREATE INDEX IF NOT EXISTS parcelamentos_status_idx      ON parcelamentos(status);
