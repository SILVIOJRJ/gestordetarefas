-- Adiciona campo de status de onboarding em clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS status_onboarding TEXT DEFAULT NULL;

-- Índice para filtrar clientes em processo de onboarding
CREATE INDEX IF NOT EXISTS clientes_status_onboarding_idx ON clientes(status_onboarding);
