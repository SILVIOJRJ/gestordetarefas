-- Permite uploads sem cliente vinculado (referencia_id pode ser null quando referencia_tipo='geral')
ALTER TABLE public.anexos ALTER COLUMN referencia_id DROP NOT NULL;
