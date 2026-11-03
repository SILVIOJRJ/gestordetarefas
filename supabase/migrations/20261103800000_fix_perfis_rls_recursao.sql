-- Corrige recursão infinita nas policies de perfis_usuarios
-- O problema: policy admin fazia SELECT role FROM perfis_usuarios (recursão)
-- Solução: função SECURITY DEFINER que bypassa RLS para checar o role

-- 1. Função auxiliar sem recursão
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.perfis_usuarios WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Remove policies antigas (todas) para recriar sem recursão
DROP POLICY IF EXISTS perfis_self_select   ON public.perfis_usuarios;
DROP POLICY IF EXISTS perfis_self_insert   ON public.perfis_usuarios;
DROP POLICY IF EXISTS perfis_self_update   ON public.perfis_usuarios;
DROP POLICY IF EXISTS perfis_admin_all     ON public.perfis_usuarios;
DROP POLICY IF EXISTS "perfis_self_select" ON public.perfis_usuarios;
DROP POLICY IF EXISTS "perfis_self_insert" ON public.perfis_usuarios;
DROP POLICY IF EXISTS "perfis_self_update" ON public.perfis_usuarios;
DROP POLICY IF EXISTS "perfis_admin_all"   ON public.perfis_usuarios;

-- Remove qualquer outra policy existente que possa causar recursão
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'perfis_usuarios' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.perfis_usuarios', r.policyname);
  END LOOP;
END $$;

-- 3. Recria policies sem recursão
ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;

-- Usuário vê e edita apenas seu próprio perfil
CREATE POLICY perfis_own_select ON public.perfis_usuarios
  FOR SELECT USING (id = auth.uid());

CREATE POLICY perfis_own_insert ON public.perfis_usuarios
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY perfis_own_update ON public.perfis_usuarios
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Admin vê e edita todos — usa a função SECURITY DEFINER para evitar recursão
CREATE POLICY perfis_admin_select ON public.perfis_usuarios
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY perfis_admin_all ON public.perfis_usuarios
  FOR ALL USING (public.get_my_role() = 'admin');
