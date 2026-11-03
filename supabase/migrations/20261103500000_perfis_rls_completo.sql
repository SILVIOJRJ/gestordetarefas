-- Garante políticas RLS completas para perfis_usuarios
-- SELECT: cada usuário lê seu próprio perfil
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'perfis_usuarios' AND policyname = 'perfis_self_select'
  ) THEN
    CREATE POLICY "perfis_self_select" ON perfis_usuarios
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

-- INSERT: usuário pode criar seu próprio perfil
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'perfis_usuarios' AND policyname = 'perfis_self_insert'
  ) THEN
    CREATE POLICY "perfis_self_insert" ON perfis_usuarios
      FOR INSERT TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- UPDATE: usuário pode atualizar seu próprio perfil
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'perfis_usuarios' AND policyname = 'perfis_self_update'
  ) THEN
    CREATE POLICY "perfis_self_update" ON perfis_usuarios
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Admin vê todos os perfis
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'perfis_usuarios' AND policyname = 'perfis_admin_all'
  ) THEN
    CREATE POLICY "perfis_admin_all" ON perfis_usuarios
      FOR ALL TO authenticated
      USING (
        (SELECT role FROM perfis_usuarios WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

ALTER TABLE perfis_usuarios ENABLE ROW LEVEL SECURITY;
