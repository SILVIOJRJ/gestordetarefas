-- Renomeia setor 'RH' para 'Pessoal' em todas as tabelas
UPDATE public.tarefas          SET setor = 'Pessoal' WHERE setor = 'RH';
UPDATE public.rotinas          SET setor = 'Pessoal' WHERE setor = 'RH';
UPDATE public.perfis_usuarios  SET setor = 'Pessoal' WHERE setor = 'RH';
UPDATE public.funcionarios     SET setor = 'Pessoal' WHERE setor = 'RH';
