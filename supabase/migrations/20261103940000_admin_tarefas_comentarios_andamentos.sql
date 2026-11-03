-- ── Adiciona colunas de delegação na tabela tarefas ─────────────
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS atribuido_para  uuid REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atribuido_por   uuid REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atribuido_em    timestamptz,
  ADD COLUMN IF NOT EXISTS privado         boolean DEFAULT false;

-- ── Comentários em tarefas ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tarefa_comentarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id   uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id    uuid REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
  autor_nome  text NOT NULL,
  corpo       text NOT NULL,
  criado_em   timestamptz DEFAULT now()
);
ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY tc_auth ON public.tarefa_comentarios
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── Andamentos / atualizações de progresso ────────────────────
CREATE TABLE IF NOT EXISTS public.tarefa_andamentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id    uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id     uuid REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
  autor_nome   text NOT NULL,
  descricao    text NOT NULL,
  status_novo  text,        -- status para o qual moveu a tarefa (opcional)
  percentual   int,         -- 0-100 (opcional)
  criado_em    timestamptz DEFAULT now()
);
ALTER TABLE public.tarefa_andamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY ta_auth ON public.tarefa_andamentos
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── Compromissos de agenda do admin ──────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_compromissos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  descricao   text,
  data_inicio timestamptz NOT NULL,
  data_fim    timestamptz,
  dia_todo    boolean DEFAULT false,
  tipo        text DEFAULT 'compromisso', -- compromisso | reuniao | prazo | lembrete
  cor         text DEFAULT '#6366f1',
  criado_por  uuid REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
  criado_em   timestamptz DEFAULT now()
);
ALTER TABLE public.admin_compromissos ENABLE ROW LEVEL SECURITY;
CREATE POLICY ac_admin ON public.admin_compromissos
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
