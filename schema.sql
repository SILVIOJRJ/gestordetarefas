-- =====================================================
-- NASCENTE CONTÁBIL — Schema Supabase
-- Execute este SQL no Supabase > SQL Editor > New Query
-- =====================================================

-- PARCELAMENTOS
CREATE TABLE IF NOT EXISTS parcelamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa text NOT NULL,
  codigo text,
  tipo text,
  orgao text,
  modalidade text,
  instancia text,
  parcela text,
  total_parcelas text,
  valor text,
  vencimento date,
  login_acesso text,
  senha text,
  status text DEFAULT 'Não iniciada',
  competencia text,
  obs text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INSS PF
CREATE TABLE IF NOT EXISTS inss_pf (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  nit text,
  codigo text,
  categoria text,
  aliquota text,
  salario text,
  valor text,
  competencia text,
  vencimento date,
  envio text,
  status text DEFAULT 'Pendente',
  obs text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TAREFAS
CREATE TABLE IF NOT EXISTS tarefas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  setor text,
  responsavel text,
  prioridade text DEFAULT 'Média',
  prazo date,
  status text DEFAULT 'Pendente',
  descricao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Desabilitar RLS para uso interno (todos os usuários logados acessam tudo)
ALTER TABLE parcelamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE inss_pf DISABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas DISABLE ROW LEVEL SECURITY;

-- Ou se preferir manter RLS habilitado, use policies abertas:
-- ALTER TABLE parcelamentos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow_all" ON parcelamentos FOR ALL USING (true) WITH CHECK (true);
-- (repita para inss_pf e tarefas)
