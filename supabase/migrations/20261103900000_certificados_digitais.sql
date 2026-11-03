-- Tabela dedicada para certificados digitais e-CNPJ / e-CPF
CREATE TABLE IF NOT EXISTS public.certificados_digitais (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome_manual   text,                          -- caso não haja cliente cadastrado
  tipo          text NOT NULL DEFAULT 'e-CNPJ', -- e-CNPJ | e-CPF | e-CPF PJ | NF-e | outros
  vencimento    date NOT NULL,
  senha         text,                          -- armazenada em texto; usar cofre E2EE futuramente
  responsavel   text,
  status        text NOT NULL DEFAULT 'Ativo', -- Ativo | Vencido | Renovando | Cancelado
  observacoes   text,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS cert_cliente_idx    ON public.certificados_digitais(cliente_id);
CREATE INDEX IF NOT EXISTS cert_vencimento_idx ON public.certificados_digitais(vencimento);
CREATE INDEX IF NOT EXISTS cert_status_idx     ON public.certificados_digitais(status);

-- RLS
ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;

-- Autenticados podem ver e editar (refinamento por role pode ser adicionado depois)
CREATE POLICY cert_auth_all ON public.certificados_digitais
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
