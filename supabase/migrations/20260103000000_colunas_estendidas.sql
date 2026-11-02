-- ============================================================
-- Migration: Colunas Estendidas e Tabelas Faltantes
-- Consolida tudo que os migration_*.sql da raiz adicionavam
-- Idempotente: usa IF NOT EXISTS em todos os ALTER/CREATE
-- ============================================================

-- ─── 1. clientes — campos estendidos ─────────────────────────

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS ie                  TEXT,
  ADD COLUMN IF NOT EXISTS im                  TEXT,
  ADD COLUMN IF NOT EXISTS cnae                TEXT,
  ADD COLUMN IF NOT EXISTS limite_nfe          INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS limite_faturamento  NUMERIC(15,2) DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS taxa_recalculo      NUMERIC(10,2) DEFAULT 150,
  ADD COLUMN IF NOT EXISTS vinculo_atendimento TEXT,
  ADD COLUMN IF NOT EXISTS contatos_chave      JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_costumes     TEXT;

-- CHECK constraint idempotente para vinculo_atendimento
DO $$ BEGIN
  ALTER TABLE clientes ADD CONSTRAINT clientes_vinculo_check
    CHECK (vinculo_atendimento IN ('Exclusivo Denazaré', 'Exclusivo Silvio', 'Carteira Conjunta'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_cnae     ON clientes(cnae);
CREATE INDEX IF NOT EXISTS idx_clientes_vinculo  ON clientes(vinculo_atendimento);

-- ─── 2. tarefas — colunas adicionais ─────────────────────────

ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS setores_visibilidade   JSONB   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS responsaveis_conjuntos TEXT[]  DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tarefas_prazo  ON tarefas(prazo);
CREATE INDEX IF NOT EXISTS idx_tarefas_setor  ON tarefas(setor);

-- ─── 3. rotinas — coluna de validação ────────────────────────

ALTER TABLE rotinas
  ADD COLUMN IF NOT EXISTS ultima_validacao DATE;

CREATE INDEX IF NOT EXISTS idx_rotinas_status ON rotinas(status);

-- ─── 4. funcionarios — múltiplos setores ─────────────────────

ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS setores_ids TEXT[];

-- ─── 5. entregas — conferência e índices ─────────────────────

ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS conferido_por TEXT,
  ADD COLUMN IF NOT EXISTS conferido_em  TIMESTAMPTZ;

ALTER TABLE entregas ALTER COLUMN status SET DEFAULT 'pendente';

CREATE INDEX IF NOT EXISTS idx_entregas_status     ON entregas(status);
CREATE INDEX IF NOT EXISTS idx_entregas_created_at ON entregas(created_at DESC);

-- ─── 6. obrigacoes_clientes — consignado ─────────────────────

ALTER TABLE obrigacoes_clientes
  ADD COLUMN IF NOT EXISTS valor_consignado NUMERIC(12,2);

-- ─── 7. contratos — campos SCP e estendidos ──────────────────

ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS modalidade           TEXT    DEFAULT 'Prestação de Serviços Contábeis',
  ADD COLUMN IF NOT EXISTS dia_vencimento       INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS servicos_inclusos    TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS servicos_extras      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS renovacao_auto       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS indice_reajuste      TEXT    DEFAULT 'IPCA',
  ADD COLUMN IF NOT EXISTS percentual_fixo      NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS limite_notas_mensais INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS multa_atraso         NUMERIC(5,2) DEFAULT 2,
  ADD COLUMN IF NOT EXISTS foro_comarca         TEXT    DEFAULT 'Jacarezinho/PR',
  ADD COLUMN IF NOT EXISTS clausulas            JSONB   DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scp_dados            JSONB;

-- ─── 8. lancamentos_financeiros — nova tabela ────────────────

CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID        REFERENCES clientes(id) ON DELETE SET NULL,
  descricao   TEXT        NOT NULL,
  valor       NUMERIC(15,2) NOT NULL,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria   TEXT        NOT NULL DEFAULT 'Outros',
  cliente     TEXT,
  forma       TEXT        DEFAULT 'Transferência',
  data        DATE        NOT NULL DEFAULT CURRENT_DATE,
  competencia TEXT,
  criado_por  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lanc_admin_all"   ON lancamentos_financeiros;
DROP POLICY IF EXISTS "lanc_gestor_read" ON lancamentos_financeiros;

CREATE POLICY "lanc_admin_all" ON lancamentos_financeiros
  USING (
    EXISTS (SELECT 1 FROM perfis_usuarios WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "lanc_gestor_read" ON lancamentos_financeiros
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_lanc_data       ON lancamentos_financeiros(data DESC);
CREATE INDEX IF NOT EXISTS idx_lanc_tipo       ON lancamentos_financeiros(tipo);
CREATE INDEX IF NOT EXISTS idx_lanc_cliente_id ON lancamentos_financeiros(cliente_id);

-- ─── 9. perfis_usuarios — permissoes_modulos + ultimo_acesso ─

ALTER TABLE perfis_usuarios
  ADD COLUMN IF NOT EXISTS permissoes_modulos JSONB DEFAULT '{
    "modulo_pessoal":    true,
    "modulo_fiscal":     true,
    "modulo_contabil":   true,
    "modulo_societario": true,
    "modulo_financeiro": false,
    "acoes_financeiras": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_perfis_permissoes ON perfis_usuarios USING gin(permissoes_modulos);

-- ─── 10. recados — tabela de broadcasts ──────────────────────

CREATE TABLE IF NOT EXISTS recados (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           TEXT        NOT NULL,
  corpo            TEXT        NOT NULL,
  destinatario_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em        TIMESTAMPTZ
);

ALTER TABLE recados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recados_admin_all" ON recados;
DROP POLICY IF EXISTS "recados_leitura"   ON recados;

CREATE POLICY "recados_admin_all" ON recados
  USING (
    EXISTS (SELECT 1 FROM perfis_usuarios WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "recados_leitura" ON recados FOR SELECT
  USING (destinatario_id IS NULL OR destinatario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_recados_destinatario ON recados(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_recados_criado_em    ON recados(criado_em DESC);

-- ─── 11. gerencial_mensal — colunas extra + constraint ───────

ALTER TABLE gerencial_mensal
  ADD COLUMN IF NOT EXISTS folha_pagamento  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pis_cofins       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS receita_servicos NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS receita_vendas   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS despesas_total   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS caixa_atual      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS atualizado_por   TEXT,
  ADD COLUMN IF NOT EXISTS obs              TEXT;

DO $$ BEGIN
  ALTER TABLE gerencial_mensal
    ADD CONSTRAINT gerencial_mensal_cliente_comp_unique
    UNIQUE (cliente_id, competencia);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 12. processos_legalizacao — extra ───────────────────────

ALTER TABLE processos_legalizacao
  ADD COLUMN IF NOT EXISTS lembrar_antes_dias   INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS retorno_confirmado   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS responsaveis_conjuntos TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_processos_exigencias ON processos_legalizacao USING gin(exigencias);
