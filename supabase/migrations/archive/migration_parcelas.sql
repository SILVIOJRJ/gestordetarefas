-- Execute no Supabase SQL Editor
-- =====================================================
-- 1. Tabela para rastreamento de parcelas mensais individuais
-- =====================================================
CREATE TABLE IF NOT EXISTS parcelas_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parcelamento_id UUID NOT NULL REFERENCES parcelamentos(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  vencimento DATE,
  pago BOOLEAN DEFAULT false,
  enviado_cliente BOOLEAN DEFAULT false,
  data_envio DATE,
  confirmado_por TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parcelamento_id, numero_parcela)
);
ALTER TABLE parcelas_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all parcelas_historico" ON parcelas_historico FOR ALL USING (true);

-- =====================================================
-- 2. Tabela para observacoes por linha no Controle Mensal
-- =====================================================
CREATE TABLE IF NOT EXISTS cm_obs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL,
  competencia TEXT NOT NULL,
  obs TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, competencia)
);
ALTER TABLE cm_obs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all cm_obs" ON cm_obs FOR ALL USING (true);

-- =====================================================
-- 3. Colunas adicionais em processos_legalizacao
-- =====================================================
ALTER TABLE processos_legalizacao
  ADD COLUMN IF NOT EXISTS lembrar_antes_dias INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS retorno_confirmado BOOLEAN DEFAULT false;

-- =====================================================
-- 4. Colunas adicionais em clientes
-- =====================================================
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS responsavel_id UUID,
  ADD COLUMN IF NOT EXISTS criado_por TEXT;

-- =====================================================
-- 5. Converter coluna valor para NUMERIC em obrigacoes_clientes
-- Se ja for NUMERIC este comando nao faz nada de errado.
-- =====================================================
ALTER TABLE obrigacoes_clientes
  ALTER COLUMN valor TYPE NUMERIC
  USING CASE
    WHEN valor IS NULL OR valor = '' THEN NULL
    WHEN valor ~ '^[0-9]+,[0-9]+$' THEN replace(valor, ',', '.')::numeric
    WHEN valor ~ '^[0-9.]+,[0-9]+$' THEN replace(replace(valor, '.', ''), ',', '.')::numeric
    ELSE valor::numeric
  END;
