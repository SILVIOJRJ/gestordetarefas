import { supabase } from '@/lib/supabase'

export type AlerteBadge = 'ok' | 'proximo' | 'excedido'

export interface LimiteItem {
  label: string
  atual: number
  limite: number
  badge: AlerteBadge
}

export interface ResumoContratual {
  clienteId: string
  nomeCliente: string
  contrato: {
    titulo: string
    valorMensal: number | null
    inicio: string
    status: string
  } | null
  limites: LimiteItem[]
  servicosExtras: string[]
}

function calcBadge(atual: number, limite: number): AlerteBadge {
  if (limite <= 0) return 'ok'
  const pct = atual / limite
  if (pct >= 1) return 'excedido'
  if (pct >= 0.8) return 'proximo'
  return 'ok'
}

export const BADGE_LABEL: Record<AlerteBadge, string> = {
  ok:       '🟢 Dentro do Limite',
  proximo:  '🟡 Próximo do Limite',
  excedido: '🔴 Excedente Atingido — Cobrar Adicional',
}

export async function obterResumoContratualCliente(clienteId: string): Promise<ResumoContratual> {
  const [clienteRes, contratoRes, obrigacoesRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('clientes') as any).select('nome').eq('id', clienteId).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('contratos') as any)
      .select('titulo, valor_mensal, inicio, status, descricao')
      .eq('cliente_id', clienteId)
      .eq('status', 'ativo')
      .order('inicio', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Conta obrigações do mês corrente como proxy de NF-e
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('obrigacoes_clientes') as any)
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .ilike('competencia', `%/${new Date().getFullYear()}`),
  ])

  const nomeCliente = clienteRes.data?.nome ?? 'Cliente'
  const contrato = contratoRes.data ?? null

  // Limites baseados no contrato (descricao JSON ou defaults)
  let limiteNfe = 50
  let limiteFaturamento = 100000
  const extras: string[] = []

  if (contrato?.descricao) {
    try {
      const parsed = JSON.parse(contrato.descricao)
      if (parsed.limite_nfe) limiteNfe = parsed.limite_nfe
      if (parsed.limite_faturamento) limiteFaturamento = parsed.limite_faturamento
      if (Array.isArray(parsed.extras)) extras.push(...parsed.extras)
    } catch { /* descricao não é JSON — usa defaults */ }
  }

  const nfeAtual = obrigacoesRes.count ?? 0

  const limites: LimiteItem[] = [
    {
      label: 'NF-e emitidas no mês',
      atual: nfeAtual,
      limite: limiteNfe,
      badge: calcBadge(nfeAtual, limiteNfe),
    },
  ]

  if (contrato?.valor_mensal) {
    limites.push({
      label: 'Teto de faturamento mensal tributável',
      atual: 0,
      limite: limiteFaturamento,
      badge: 'ok',
    })
  }

  return {
    clienteId,
    nomeCliente,
    contrato: contrato
      ? { titulo: contrato.titulo, valorMensal: contrato.valor_mensal, inicio: contrato.inicio, status: contrato.status }
      : null,
    limites,
    servicosExtras: extras.length ? extras : ['Taxa de recálculo de guia em atraso', 'Admissões extras'],
  }
}
