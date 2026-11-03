-- Permite que cada usuário atualize seu próprio perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'perfis_usuarios'
      AND policyname = 'perfis_self_update'
  ) THEN
    CREATE POLICY "perfis_self_update" ON perfis_usuarios
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Garante que RLS está ativado na tabela
ALTER TABLE perfis_usuarios ENABLE ROW LEVEL SECURITY;
