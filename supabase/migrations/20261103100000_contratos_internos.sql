-- Contratos internos do próprio escritório (não dos clientes)
CREATE TABLE IF NOT EXISTS contratos_internos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text NOT NULL,
  descricao    text,
  valor        numeric(12,2),
  inicio       date,
  termino      date,
  status       text NOT NULL DEFAULT 'Ativo',
  responsavel  text,
  observacoes  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contratos_internos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_internos_admin_all" ON contratos_internos
  FOR ALL TO authenticated
  USING     ((SELECT role FROM perfis_usuarios WHERE id = auth.uid()) = 'admin')
  WITH CHECK((SELECT role FROM perfis_usuarios WHERE id = auth.uid()) = 'admin');
