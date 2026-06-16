-- Tabela de eventos/progresso de tarefas
-- Execute no Supabase > SQL Editor > New Query

CREATE TABLE IF NOT EXISTS task_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id     uuid NOT NULL,
  tipo          text DEFAULT 'progresso', -- progresso | protocolo | situacao | conclusao | abertura
  titulo        text,
  protocolo     text,       -- número de protocolo, PRP, NIRE, código do processo
  situacao      text,       -- ex: "Aguardando JUCEMG", "Protocolo recebido"
  descricao     text,
  autor         text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE task_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_eventos_select" ON task_eventos;
DROP POLICY IF EXISTS "task_eventos_insert" ON task_eventos;
DROP POLICY IF EXISTS "task_eventos_update" ON task_eventos;
DROP POLICY IF EXISTS "task_eventos_delete" ON task_eventos;

CREATE POLICY "task_eventos_select" ON task_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_eventos_insert" ON task_eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "task_eventos_update" ON task_eventos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "task_eventos_delete" ON task_eventos FOR DELETE TO authenticated USING (true);
