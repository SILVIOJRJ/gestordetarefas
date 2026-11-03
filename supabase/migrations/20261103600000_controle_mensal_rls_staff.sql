-- Permite que funcionários autenticados gravem no Controle Mensal
-- Antes apenas admin podia; INSERT/UPDATE bloqueados para staff

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'controle_mensal_obrigacoes' AND policyname = 'controle_staff_write'
  ) THEN
    CREATE POLICY "controle_staff_write" ON controle_mensal_obrigacoes
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
