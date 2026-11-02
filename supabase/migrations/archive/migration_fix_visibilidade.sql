-- Corrige tarefas que estão aparecendo para setores errados
-- Execute no Supabase > SQL Editor > New Query

-- 1. Tarefas de LEGALIZAÇÃO: limpa visibilidade para ficar apenas no setor nativo
UPDATE tarefas
SET setores_visibilidade = '["Legalização"]'
WHERE setor ILIKE '%legal%'
  AND (
    setores_visibilidade IS NULL
    OR setores_visibilidade = '[]'::jsonb
    OR setores_visibilidade::text ILIKE '%DP%'
    OR setores_visibilidade::text ILIKE '%Fiscal%'
    OR setores_visibilidade::text ILIKE '%Contábil%'
  );

-- 2. Tarefas de DP: garante que só aparecem para DP
UPDATE tarefas
SET setores_visibilidade = '["DP"]'
WHERE setor = 'DP'
  AND (
    setores_visibilidade IS NULL
    OR setores_visibilidade = '[]'::jsonb
  );

-- 3. Tarefas de Fiscal: garante que só aparecem para Fiscal
UPDATE tarefas
SET setores_visibilidade = '["Fiscal"]'
WHERE setor = 'Fiscal'
  AND (
    setores_visibilidade IS NULL
    OR setores_visibilidade = '[]'::jsonb
  );

-- 4. Tarefas de Contábil: garante que só aparecem para Contábil
UPDATE tarefas
SET setores_visibilidade = '["Contábil"]'
WHERE setor ILIKE 'cont%'
  AND (
    setores_visibilidade IS NULL
    OR setores_visibilidade = '[]'::jsonb
  );

-- Verificação: mostra o resultado
SELECT titulo, setor, setores_visibilidade FROM tarefas ORDER BY setor, titulo;
