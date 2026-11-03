-- Comentários em tarefas (balões de chat)
CREATE TABLE IF NOT EXISTS task_comentarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id  uuid NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  autor      text,
  autor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  texto      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comt_tarefa ON task_comentarios(tarefa_id);

ALTER TABLE task_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comt_authenticated" ON task_comentarios
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Avatar URL no perfil do usuário
ALTER TABLE perfis_usuarios
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS setor      text;
