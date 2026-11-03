-- Função RPC para buscar cliente por CNPJ ignorando pontuação
CREATE OR REPLACE FUNCTION public.buscar_cliente_por_cnpj(cnpj_busca text)
RETURNS TABLE(id uuid, nome text, telefone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, nome, telefone
  FROM public.clientes
  WHERE regexp_replace(cnpj_cpf, '[^0-9]', '', 'g') = regexp_replace(cnpj_busca, '[^0-9]', '', 'g')
     OR nome ILIKE '%' || cnpj_busca || '%'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_cliente_por_cnpj(text) TO authenticated;
