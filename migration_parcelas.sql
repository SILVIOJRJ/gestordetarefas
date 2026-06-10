-- Execute no Supabase SQL Editor
-- Tabela para rastreamento de parcelas mensais individuais

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

-- Colunas adicionais em processos_legalizacao (se não existirem)
ALTER TABLE processos_legalizacao
  ADD COLUMN IF NOT EXISTS lembrar_antes_dias INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS retorno_confirmado BOOLEAN DEFAULT false;

-- RLS permissiva (ajuste conforme política de segurança)
ALTER TABLE parcelas_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON parcelas_historico FOR ALL USING (true);
