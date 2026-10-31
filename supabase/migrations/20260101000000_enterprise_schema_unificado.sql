-- ============================================================
-- Migration: Enterprise Schema Unificado
-- Consolida gestordetarefas + microsasesc
-- Multi-Tenant RBAC com RLS estrito
-- ============================================================

-- ─── Extensões ───────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE role_usuario AS ENUM ('admin', 'gestor_cliente', 'colaborador_cliente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE prioridade_enum AS ENUM ('Baixa', 'Média', 'Alta', 'Urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_tarefa_enum AS ENUM (
    'Pendente', 'Em andamento', 'Aguardando', 'Concluída', 'Cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_processo_enum AS ENUM (
    'Pendente', 'Em andamento', 'Aguardando', 'Concluído', 'Cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_rotina_enum AS ENUM ('ativa', 'pausada', 'encerrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE frequencia_rotina_enum AS ENUM (
    'diaria', 'semanal', 'quinzenal', 'mensal', 'anual', 'data_fixa'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_evento_tarefa_enum AS ENUM (
    'progresso', 'protocolo', 'situacao', 'conclusao', 'abertura'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE referencia_tipo_anexo_enum AS ENUM (
    'tarefa', 'processo', 'obrigacao', 'cliente', 'rotina', 'ordem_servico', 'contrato'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE regime_tributario_enum AS ENUM (
    'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE setor_enum AS ENUM (
    'Legalização', 'Fiscal', 'RH', 'Office Boy', 'Gerencial', 'Administrativo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Função utilitária: trigger updated_at ───────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Tabela: perfis_usuarios ─────────────────────────────────
-- Estende auth.users com role e vínculos de tenant

CREATE TABLE IF NOT EXISTS perfis_usuarios (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  nome            text NOT NULL,
  role            role_usuario NOT NULL DEFAULT 'colaborador_cliente',
  cliente_id      uuid,               -- FK → clientes (adicionada abaixo)
  funcionario_id  uuid,               -- FK → funcionarios (adicionada abaixo)
  cpf             text,               -- usado por colaborador_cliente
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perfis_cliente_id ON perfis_usuarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_perfis_role ON perfis_usuarios(role);

-- ─── Tabela: clientes ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  cnpj            text,
  regime          regime_tributario_enum,
  email           text,
  telefone        text,
  responsavel     text,
  responsavel_id  uuid,               -- FK → funcionarios
  criado_por      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON clientes(cnpj);

-- ─── Tabela: funcionarios ────────────────────────────────────

CREATE TABLE IF NOT EXISTS funcionarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  email           text NOT NULL UNIQUE,
  setor           setor_enum,
  setores_ids     text[],
  cargo           text,
  cpf             text,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- FKs cruzadas após criação das duas tabelas
ALTER TABLE perfis_usuarios
  ADD CONSTRAINT fk_perfis_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_perfis_funcionario
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL;

ALTER TABLE clientes
  ADD CONSTRAINT fk_clientes_responsavel
    FOREIGN KEY (responsavel_id) REFERENCES funcionarios(id) ON DELETE SET NULL;

-- ─── Tabela: tarefas ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tarefas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  setor           setor_enum,
  responsavel     text,
  prioridade      prioridade_enum NOT NULL DEFAULT 'Média',
  prazo           date,
  status          status_tarefa_enum NOT NULL DEFAULT 'Pendente',
  descricao       text,
  cliente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_setor ON tarefas(setor);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_cliente ON tarefas(cliente_id);

-- ─── Tabela: task_eventos ────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_eventos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id       uuid NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  tipo            tipo_evento_tarefa_enum NOT NULL DEFAULT 'progresso',
  titulo          text,
  protocolo       text,
  situacao        text,
  descricao       text,
  autor           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_eventos_tarefa ON task_eventos(tarefa_id);

-- ─── Tabela: processos_legalizacao ───────────────────────────

CREATE TABLE IF NOT EXISTS processos_legalizacao (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          uuid REFERENCES clientes(id) ON DELETE SET NULL,
  tipo                text,
  descricao           text,
  status              status_processo_enum NOT NULL DEFAULT 'Pendente',
  prazo               date,
  responsavel         text,
  protocolo           text,
  lembrar_antes_dias  int NOT NULL DEFAULT 30,
  retorno_confirmado  boolean NOT NULL DEFAULT false,
  obs                 text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processos_cliente ON processos_legalizacao(cliente_id);

-- ─── Tabela: obrigacoes_clientes ─────────────────────────────

CREATE TABLE IF NOT EXISTS obrigacoes_clientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  descricao       text NOT NULL,
  competencia     text,
  vencimento      date,
  valor           numeric(12,2),
  valor_consignado numeric(12,2),
  status          text NOT NULL DEFAULT 'Pendente',
  responsavel     text,
  obs             text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obrigacoes_cliente ON obrigacoes_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_obrigacoes_competencia ON obrigacoes_clientes(competencia);

-- ─── Tabela: rotinas ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rotinas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo               text NOT NULL,
  descricao            text,
  frequencia           frequencia_rotina_enum NOT NULL DEFAULT 'mensal',
  dia_semana           int,
  dia_mes              int,
  dia_ano              text,
  data_fixa            date,
  lembrar_antes_dias   int NOT NULL DEFAULT 3,
  prioridade           prioridade_enum NOT NULL DEFAULT 'Média',
  setor                setor_enum,
  responsavel          text,
  status               status_rotina_enum NOT NULL DEFAULT 'ativa',
  obs                  text,
  criado_por           text,
  setores_visibilidade text[],
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabela: parcelamentos ───────────────────────────────────

CREATE TABLE IF NOT EXISTS parcelamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa         text NOT NULL,
  codigo          text,
  tipo            text,
  orgao           text,
  modalidade      text,
  instancia       text,
  parcela         text,
  total_parcelas  text,
  valor           text,
  vencimento      date,
  login_acesso    text,
  senha           text,
  status          text NOT NULL DEFAULT 'Não iniciada',
  competencia     text,
  obs             text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabela: parcelas_historico ──────────────────────────────

CREATE TABLE IF NOT EXISTS parcelas_historico (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelamento_id   uuid NOT NULL REFERENCES parcelamentos(id) ON DELETE CASCADE,
  numero_parcela    int NOT NULL,
  vencimento        date,
  pago              boolean NOT NULL DEFAULT false,
  enviado_cliente   boolean NOT NULL DEFAULT false,
  data_envio        date,
  confirmado_por    text,
  observacao        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parcelamento_id, numero_parcela)
);

-- ─── Tabela: gerencial_mensal ────────────────────────────────

CREATE TABLE IF NOT EXISTS gerencial_mensal (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  competencia       text NOT NULL,
  folha_pagamento   numeric(12,2),
  pis_cofins        numeric(12,2),
  receita_servicos  numeric(12,2),
  receita_vendas    numeric(12,2),
  despesas_total    numeric(12,2),
  caixa_atual       numeric(12,2),
  obs               text,
  atualizado_por    text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, competencia)
);

-- ─── Tabela: cm_obs ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cm_obs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  competencia     text NOT NULL,
  obs             text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, competencia)
);

-- ─── Tabela: inss_pf ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inss_pf (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  nit             text,
  codigo          text,
  categoria       text,
  aliquota        text,
  salario         text,
  valor           text,
  competencia     text,
  vencimento      date,
  envio           text,
  status          text NOT NULL DEFAULT 'Pendente',
  obs             text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabela: entregas ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entregas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  descricao       text,
  status          text NOT NULL DEFAULT 'Pendente',
  responsavel     text,
  conferido_por   text,
  conferido_em    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabela: ordens_servico (microsasesc) ────────────────────

CREATE TABLE IF NOT EXISTS ordens_servico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  numero          text,
  descricao       text NOT NULL,
  status          text NOT NULL DEFAULT 'Aberta',
  responsavel_id  uuid REFERENCES funcionarios(id) ON DELETE SET NULL,
  valor           numeric(12,2),
  data_abertura   date NOT NULL DEFAULT current_date,
  data_conclusao  date,
  obs             text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_cliente ON ordens_servico(cliente_id);

-- ─── Tabela: contratos (microsasesc) ─────────────────────────

CREATE TABLE IF NOT EXISTS contratos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  descricao       text,
  valor_mensal    numeric(12,2),
  inicio          date NOT NULL,
  termino         date,
  renovacao_auto  boolean NOT NULL DEFAULT true,
  status          text NOT NULL DEFAULT 'Ativo',
  criado_por      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabela: cofre_credenciais ───────────────────────────────
-- Senhas criptografadas E2EE — o servidor armazena apenas o blob cifrado

CREATE TABLE IF NOT EXISTS cofre_credenciais (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  payload_enc     text NOT NULL, -- JSON cifrado AES-GCM no cliente (E2EE)
  criado_por      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cofre_cliente ON cofre_credenciais(cliente_id);

-- ─── Tabela: anexos ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS anexos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia_tipo referencia_tipo_anexo_enum NOT NULL,
  referencia_id   uuid NOT NULL,
  nome_original   text,
  nome_arquivo    text,
  url             text,
  tamanho         bigint,
  tipo_mime       text,
  criado_por      text,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anexos_ref ON anexos(referencia_tipo, referencia_id);

-- ─── Tabela: acessos_log (Append-Only) ──────────────────────

CREATE TABLE IF NOT EXISTS acessos_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_nome  text,
  funcionario_email text,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  setor             text,
  ip                text,
  acessado_em       timestamptz NOT NULL DEFAULT now()
  -- Sem updated_at: imutável por design
);

CREATE INDEX IF NOT EXISTS idx_acessos_log_user ON acessos_log(user_id);
CREATE INDEX IF NOT EXISTS idx_acessos_log_data ON acessos_log(acessado_em DESC);

-- ─── Triggers updated_at ─────────────────────────────────────

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'perfis_usuarios','clientes','funcionarios','tarefas',
    'processos_legalizacao','obrigacoes_clientes','rotinas',
    'parcelamentos','inss_pf','entregas','ordens_servico',
    'contratos','cofre_credenciais'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at_%1$s ON %1$s;
      CREATE TRIGGER trg_updated_at_%1$s
        BEFORE UPDATE ON %1$s
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    ', t);
  END LOOP;
END $$;

-- ─── RLS: Habilitar em 100% das tabelas ──────────────────────

ALTER TABLE perfis_usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_eventos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos_legalizacao  ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrigacoes_clientes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotinas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelamentos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_historico     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gerencial_mensal       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_obs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE inss_pf                ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofre_credenciais      ENABLE ROW LEVEL SECURITY;
ALTER TABLE anexos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE acessos_log            ENABLE ROW LEVEL SECURITY;

-- ─── Função auxiliar: retorna o role do usuário atual ────────

CREATE OR REPLACE FUNCTION auth_role()
RETURNS role_usuario
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM perfis_usuarios WHERE id = auth.uid()
$$;

-- Retorna o cliente_id do usuário atual (para gestor/colaborador)
CREATE OR REPLACE FUNCTION auth_cliente_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT cliente_id FROM perfis_usuarios WHERE id = auth.uid()
$$;

-- ─── Policies: perfis_usuarios ───────────────────────────────

DROP POLICY IF EXISTS "perfis_admin_all"    ON perfis_usuarios;
DROP POLICY IF EXISTS "perfis_self_select"  ON perfis_usuarios;
DROP POLICY IF EXISTS "perfis_self_update"  ON perfis_usuarios;

-- Admin vê e edita tudo
CREATE POLICY "perfis_admin_all" ON perfis_usuarios
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

-- Usuário vê e atualiza seu próprio perfil
CREATE POLICY "perfis_self_select" ON perfis_usuarios
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "perfis_self_update" ON perfis_usuarios
  FOR UPDATE TO authenticated
  USING     (id = auth.uid())
  WITH CHECK(id = auth.uid());

-- ─── Policies: clientes ──────────────────────────────────────

DROP POLICY IF EXISTS "clientes_admin_all"   ON clientes;
DROP POLICY IF EXISTS "clientes_gestor_self" ON clientes;

CREATE POLICY "clientes_admin_all" ON clientes
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

-- Gestor vê apenas sua própria empresa
CREATE POLICY "clientes_gestor_self" ON clientes
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND id = auth_cliente_id()
  );

-- ─── Policies: funcionarios ──────────────────────────────────

DROP POLICY IF EXISTS "func_admin_all"    ON funcionarios;
DROP POLICY IF EXISTS "func_self_select"  ON funcionarios;

CREATE POLICY "func_admin_all" ON funcionarios
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "func_self_select" ON funcionarios
  FOR SELECT TO authenticated
  USING (
    id = (SELECT funcionario_id FROM perfis_usuarios WHERE id = auth.uid())
  );

-- ─── Policies: tarefas ───────────────────────────────────────

DROP POLICY IF EXISTS "tarefas_admin_all"    ON tarefas;
DROP POLICY IF EXISTS "tarefas_gestor_read"  ON tarefas;

CREATE POLICY "tarefas_admin_all" ON tarefas
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "tarefas_gestor_read" ON tarefas
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND cliente_id = auth_cliente_id()
  );

-- ─── Policies: task_eventos ──────────────────────────────────

DROP POLICY IF EXISTS "task_ev_admin_all"   ON task_eventos;
DROP POLICY IF EXISTS "task_ev_gestor_read" ON task_eventos;

CREATE POLICY "task_ev_admin_all" ON task_eventos
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "task_ev_gestor_read" ON task_eventos
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND EXISTS (
      SELECT 1 FROM tarefas t
      WHERE t.id = tarefa_id AND t.cliente_id = auth_cliente_id()
    )
  );

-- ─── Policies: processos_legalizacao ─────────────────────────

DROP POLICY IF EXISTS "proc_admin_all"   ON processos_legalizacao;
DROP POLICY IF EXISTS "proc_gestor_read" ON processos_legalizacao;

CREATE POLICY "proc_admin_all" ON processos_legalizacao
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "proc_gestor_read" ON processos_legalizacao
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND cliente_id = auth_cliente_id()
  );

-- ─── Policies: obrigacoes_clientes ───────────────────────────

DROP POLICY IF EXISTS "obrig_admin_all"   ON obrigacoes_clientes;
DROP POLICY IF EXISTS "obrig_gestor_read" ON obrigacoes_clientes;

CREATE POLICY "obrig_admin_all" ON obrigacoes_clientes
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "obrig_gestor_read" ON obrigacoes_clientes
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND cliente_id = auth_cliente_id()
  );

-- ─── Policies: gerencial_mensal ──────────────────────────────

DROP POLICY IF EXISTS "gerencial_admin_all"   ON gerencial_mensal;
DROP POLICY IF EXISTS "gerencial_gestor_read" ON gerencial_mensal;

CREATE POLICY "gerencial_admin_all" ON gerencial_mensal
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "gerencial_gestor_read" ON gerencial_mensal
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND cliente_id = auth_cliente_id()
  );

-- ─── Policies: cm_obs ────────────────────────────────────────

DROP POLICY IF EXISTS "cmobs_admin_all"   ON cm_obs;
DROP POLICY IF EXISTS "cmobs_gestor_read" ON cm_obs;

CREATE POLICY "cmobs_admin_all" ON cm_obs
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "cmobs_gestor_read" ON cm_obs
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND cliente_id = auth_cliente_id()
  );

-- ─── Policies: rotinas ───────────────────────────────────────

DROP POLICY IF EXISTS "rotinas_admin_all"  ON rotinas;
DROP POLICY IF EXISTS "rotinas_staff_read" ON rotinas;

CREATE POLICY "rotinas_admin_all" ON rotinas
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

-- Funcionários autenticados leem rotinas do seu setor
CREATE POLICY "rotinas_staff_read" ON rotinas
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin'); -- somente admin por ora; expandir conforme RBAC

-- ─── Policies: parcelamentos + parcelas_historico ────────────

DROP POLICY IF EXISTS "parcel_admin_all"  ON parcelamentos;
DROP POLICY IF EXISTS "parcel_hist_admin" ON parcelas_historico;

CREATE POLICY "parcel_admin_all" ON parcelamentos
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "parcel_hist_admin" ON parcelas_historico
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

-- ─── Policies: inss_pf ───────────────────────────────────────

DROP POLICY IF EXISTS "inss_admin_all" ON inss_pf;

CREATE POLICY "inss_admin_all" ON inss_pf
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

-- ─── Policies: entregas ──────────────────────────────────────

DROP POLICY IF EXISTS "entregas_admin_all" ON entregas;

CREATE POLICY "entregas_admin_all" ON entregas
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

-- ─── Policies: ordens_servico ────────────────────────────────

DROP POLICY IF EXISTS "os_admin_all"   ON ordens_servico;
DROP POLICY IF EXISTS "os_gestor_read" ON ordens_servico;

CREATE POLICY "os_admin_all" ON ordens_servico
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "os_gestor_read" ON ordens_servico
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND cliente_id = auth_cliente_id()
  );

-- ─── Policies: contratos ─────────────────────────────────────

DROP POLICY IF EXISTS "contratos_admin_all"   ON contratos;
DROP POLICY IF EXISTS "contratos_gestor_read" ON contratos;

CREATE POLICY "contratos_admin_all" ON contratos
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "contratos_gestor_read" ON contratos
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND cliente_id = auth_cliente_id()
  );

-- ─── Policies: cofre_credenciais ─────────────────────────────
-- Apenas admin e gestor da respectiva empresa

DROP POLICY IF EXISTS "cofre_admin_all"   ON cofre_credenciais;
DROP POLICY IF EXISTS "cofre_gestor_self" ON cofre_credenciais;

CREATE POLICY "cofre_admin_all" ON cofre_credenciais
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

CREATE POLICY "cofre_gestor_self" ON cofre_credenciais
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND cliente_id = auth_cliente_id()
  );

-- ─── Policies: anexos ────────────────────────────────────────

DROP POLICY IF EXISTS "anexos_admin_all"   ON anexos;
DROP POLICY IF EXISTS "anexos_gestor_read" ON anexos;
DROP POLICY IF EXISTS "anexos_colab_read"  ON anexos;

CREATE POLICY "anexos_admin_all" ON anexos
  FOR ALL TO authenticated
  USING     (auth_role() = 'admin')
  WITH CHECK(auth_role() = 'admin');

-- Gestor lê anexos vinculados à sua empresa (via obrigação, tarefa ou processo)
CREATE POLICY "anexos_gestor_read" ON anexos
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'gestor_cliente'
    AND (
      (referencia_tipo = 'cliente'   AND referencia_id = auth_cliente_id())
      OR (referencia_tipo = 'tarefa' AND EXISTS (
            SELECT 1 FROM tarefas WHERE id = referencia_id AND cliente_id = auth_cliente_id()))
      OR (referencia_tipo = 'processo' AND EXISTS (
            SELECT 1 FROM processos_legalizacao WHERE id = referencia_id AND cliente_id = auth_cliente_id()))
      OR (referencia_tipo = 'obrigacao' AND EXISTS (
            SELECT 1 FROM obrigacoes_clientes WHERE id = referencia_id AND cliente_id = auth_cliente_id()))
    )
  );

-- ─── Policies: acessos_log (Append-Only) ─────────────────────
-- INSERT: qualquer autenticado pode registrar seu próprio acesso
-- SELECT: somente admin
-- UPDATE/DELETE: bloqueados (sem policy = negado por padrão)

DROP POLICY IF EXISTS "acessos_log_insert" ON acessos_log;
DROP POLICY IF EXISTS "acessos_log_select" ON acessos_log;

CREATE POLICY "acessos_log_insert" ON acessos_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "acessos_log_select" ON acessos_log
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

-- UPDATE e DELETE não têm policy → negados para todos (Append-Only garantido)

-- ─── Fim da migration ────────────────────────────────────────
