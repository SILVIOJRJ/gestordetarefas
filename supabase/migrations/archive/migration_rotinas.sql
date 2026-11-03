-- Módulo de Rotinas — pendências recorrentes com alertas automáticos
-- Execute no Supabase > SQL Editor > New Query

CREATE TABLE IF NOT EXISTS rotinas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo             text NOT NULL,
  descricao          text,
  frequencia         text NOT NULL DEFAULT 'mensal',
  dia_semana         int,          -- 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  dia_mes            int,          -- 1-28 (mensal / quinzenal)
  dia_ano            text,         -- 'MM-DD' ex: '03-15' = 15 de março (anual)
  data_fixa          date,         -- data única (frequência = data_fixa)
  lembrar_antes_dias int DEFAULT 3,
  prioridade         text DEFAULT 'Média',
  setor              text,
  responsavel        text,
  status             text DEFAULT 'ativa',  -- ativa | pausada | encerrada
  obs                text,
  criado_por         text,
  setores_visibilidade text[],
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE rotinas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rotinas_select" ON rotinas;
DROP POLICY IF EXISTS "rotinas_insert" ON rotinas;
DROP POLICY IF EXISTS "rotinas_update" ON rotinas;
DROP POLICY IF EXISTS "rotinas_delete" ON rotinas;

CREATE POLICY "rotinas_select" ON rotinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "rotinas_insert" ON rotinas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rotinas_update" ON rotinas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "rotinas_delete" ON rotinas FOR DELETE TO authenticated USING (true);
