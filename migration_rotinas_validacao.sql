-- Adiciona coluna de última validação nas rotinas
-- Execute no Supabase > SQL Editor > New Query

ALTER TABLE rotinas ADD COLUMN IF NOT EXISTS ultima_validacao date;
