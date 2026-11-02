CREATE TABLE IF NOT EXISTS inss_pf (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  nit             TEXT,
  cod_gps         TEXT,
  aliquota        NUMERIC(5,2),                        -- percentual ex: 11.00
  categoria       TEXT NOT NULL DEFAULT 'Facultativo', -- Facultativo | Contribuinte Individual
  salario         NUMERIC(14,2),
  valor_gps       NUMERIC(14,2),
  competencia     TEXT,                                -- MM/YYYY
  vencimento      DATE,
  envio           TEXT,                                -- canal/responsável pelo envio
  status          TEXT NOT NULL DEFAULT 'Pendente',    -- Pago | Pendente
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inss_pf_status_idx ON inss_pf(status);
