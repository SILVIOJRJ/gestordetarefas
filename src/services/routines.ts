import { supabase } from '@/lib/supabase'
import type { Rotina, FrequenciaRotina, RegimeTributario, Setor } from '@/types/database.types'

export type { Rotina }

// ─── Obrigações fiscais fixas por regime e mês ─────────────────

interface ObrigacaoFiscal {
  titulo: string
  setor: Setor
  dia_vencimento: number
  regimes: RegimeTributario[]
  descricao?: string
}

const OBRIGACOES_MENSAIS: ObrigacaoFiscal[] = [
  { titulo: 'DAS — Simples Nacional', setor: 'Fiscal', dia_vencimento: 20, regimes: ['Simples Nacional', 'MEI'], descricao: 'Guia mensal do Simples Nacional' },
  { titulo: 'DARF IRPJ/CSLL Estimativa', setor: 'Fiscal', dia_vencimento: 30, regimes: ['Lucro Real'], descricao: 'Estimativa mensal Lucro Real' },
  { titulo: 'DARF PIS/COFINS', setor: 'Fiscal', dia_vencimento: 25, regimes: ['Lucro Presumido', 'Lucro Real'], descricao: 'PIS e COFINS mensais' },
  { titulo: 'GPS — Contribuição Previdenciária', setor: 'Pessoal', dia_vencimento: 20, regimes: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'], descricao: 'INSS empresa e empregados' },
  { titulo: 'FGTS Mensal', setor: 'Pessoal', dia_vencimento: 7, regimes: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'], descricao: 'Recolhimento FGTS' },
  { titulo: 'DARF IRRF', setor: 'Fiscal', dia_vencimento: 20, regimes: ['Lucro Presumido', 'Lucro Real'], descricao: 'IR Retido na Fonte' },
  { titulo: 'DARF ISS', setor: 'Fiscal', dia_vencimento: 10, regimes: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'], descricao: 'Imposto Sobre Serviços municipal' },
]

const OBRIGACOES_TRIMESTRAIS: ObrigacaoFiscal[] = [
  { titulo: 'DARF IRPJ Trimestral', setor: 'Fiscal', dia_vencimento: 30, regimes: ['Lucro Presumido'], descricao: 'IRPJ apuração trimestral' },
  { titulo: 'DARF CSLL Trimestral', setor: 'Fiscal', dia_vencimento: 30, regimes: ['Lucro Presumido'], descricao: 'CSLL apuração trimestral' },
]

const OBRIGACOES_ANUAIS: ObrigacaoFiscal[] = [
  { titulo: 'DIRF — Declaração IR Retido Fonte', setor: 'Fiscal', dia_vencimento: 28, regimes: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'] },
  { titulo: 'RAIS / eSocial Anual', setor: 'Pessoal', dia_vencimento: 31, regimes: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'] },
  { titulo: 'DASN — Declaração Anual Simples', setor: 'Fiscal', dia_vencimento: 31, regimes: ['Simples Nacional', 'MEI'] },
  { titulo: 'ECF — Escrituração Contábil Fiscal', setor: 'Fiscal', dia_vencimento: 31, regimes: ['Lucro Presumido', 'Lucro Real'] },
  { titulo: 'ECD — Escrituração Contábil Digital', setor: 'Fiscal', dia_vencimento: 31, regimes: ['Lucro Real'] },
]

// ─── Helpers de frequência ─────────────────────────────────────

function isTrimestreAtivo(mes: number): boolean {
  return [3, 6, 9, 12].includes(mes)
}

function isAnualAtivo(mes: number): boolean {
  return mes === 3
}

function diaDaSemanaNoMes(ano: number, mes: number, diaSemana: number): number[] {
  const dias: number[] = []
  const d = new Date(ano, mes - 1, 1)
  while (d.getMonth() === mes - 1) {
    if (d.getDay() === diaSemana) dias.push(d.getDate())
    d.setDate(d.getDate() + 1)
  }
  return dias
}

export interface VencimentoCalendario {
  dia: number
  titulo: string
  setor: Setor
  regimes: RegimeTributario[]
  tipo: 'mensal' | 'trimestral' | 'anual' | 'rotina'
  rotinaId?: string
}

// ─── Consultas Supabase ────────────────────────────────────────

export async function listarRotinas(): Promise<Rotina[]> {
  const { data, error } = await (supabase.from('rotinas') as any)
    .select('*')
    .order('setor', { ascending: true })
    .order('titulo', { ascending: true })
  if (error) throw error
  return (data ?? []) as Rotina[]
}

export async function listarRotinasAtivas(): Promise<Rotina[]> {
  const { data, error } = await (supabase.from('rotinas') as any)
    .select('*')
    .eq('status', 'ativa')
    .order('setor')
  if (error) throw error
  return (data ?? []) as Rotina[]
}

export async function criarRotina(payload: Omit<Rotina, 'id' | 'created_at' | 'updated_at'>): Promise<Rotina> {
  const { data, error } = await (supabase.from('rotinas') as any)
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as Rotina
}

export async function atualizarStatusRotina(id: string, status: Rotina['status']): Promise<void> {
  const { error } = await (supabase.from('rotinas') as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ─── Geração de tarefas em lote ───────────────────────────────

export interface TarefaGerada {
  titulo: string
  setor: Setor
  prazo: string
  descricao: string
  prioridade: 'Média' | 'Alta'
  status: 'Pendente'
  cliente_id: string | null
  rotina_origem?: string
}

export async function gerarTarefasDaRotinaDoMes(mes: number, ano: number): Promise<{ geradas: number; erros: number }> {
  const rotinas = await listarRotinasAtivas()
  const clientes: Array<{ id: string; regime: RegimeTributario | null }> = await (async () => {
    const { data } = await (supabase.from('clientes') as any).select('id,regime').eq('ativo', true).catch(() => ({ data: [] }))
    return (data ?? []) as Array<{ id: string; regime: RegimeTributario | null }>
  })()

  const tarefas: TarefaGerada[] = []
  const dataBase = new Date(ano, mes - 1, 1)

  // Obrigações fiscais fixas — para cada cliente conforme regime
  const obrigacoesMes: ObrigacaoFiscal[] = [
    ...OBRIGACOES_MENSAIS,
    ...(isTrimestreAtivo(mes) ? OBRIGACOES_TRIMESTRAIS : []),
    ...(isAnualAtivo(mes) ? OBRIGACOES_ANUAIS : []),
  ]

  for (const cliente of clientes) {
    if (!cliente.regime) continue
    for (const ob of obrigacoesMes) {
      if (!ob.regimes.includes(cliente.regime)) continue
      const dia = Math.min(ob.dia_vencimento, new Date(ano, mes, 0).getDate())
      const prazo = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      tarefas.push({
        titulo: ob.titulo,
        setor: ob.setor,
        prazo,
        descricao: ob.descricao ?? ob.titulo,
        prioridade: ob.dia_vencimento <= 10 ? 'Alta' : 'Média',
        status: 'Pendente',
        cliente_id: cliente.id,
      })
    }
  }

  // Rotinas cadastradas no sistema
  for (const rotina of rotinas) {
    if (!rotina.setor) continue
    const dias: number[] = []

    if (rotina.frequencia === 'mensal' && rotina.dia_mes) {
      dias.push(Math.min(rotina.dia_mes, new Date(ano, mes, 0).getDate()))
    } else if (rotina.frequencia === 'semanal' && rotina.dia_semana !== null) {
      dias.push(...diaDaSemanaNoMes(ano, mes, rotina.dia_semana))
    } else if (rotina.frequencia === 'anual' && rotina.dia_ano) {
      const [m, d] = rotina.dia_ano.split('-').map(Number)
      if (m === mes) dias.push(d!)
    } else if (rotina.frequencia === 'data_fixa' && rotina.data_fixa) {
      const df = new Date(rotina.data_fixa)
      if (df.getFullYear() === ano && df.getMonth() + 1 === mes) dias.push(df.getDate())
    } else if (rotina.frequencia === 'diaria') {
      const total = new Date(ano, mes, 0).getDate()
      for (let i = 1; i <= total; i++) dias.push(i)
    }

    for (const dia of dias) {
      const prazo = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      tarefas.push({
        titulo: rotina.titulo,
        setor: rotina.setor as Setor,
        prazo,
        descricao: rotina.descricao ?? rotina.titulo,
        prioridade: rotina.prioridade === 'Urgente' ? 'Alta' : (rotina.prioridade as 'Média' | 'Alta'),
        status: 'Pendente',
        cliente_id: null,
        rotina_origem: rotina.id,
      })
    }
  }

  if (tarefas.length === 0) return { geradas: 0, erros: 0 }

  // Insere em lotes de 50
  let geradas = 0
  let erros = 0
  for (let i = 0; i < tarefas.length; i += 50) {
    const lote = tarefas.slice(i, i + 50)
    const { error } = await (supabase.from('tarefas') as any).insert(lote)
    if (error) erros += lote.length
    else geradas += lote.length
  }

  return { geradas, erros }
}

// ─── Calendário de vencimentos ────────────────────────────────

export function gerarCalendarioDoMes(mes: number, ano: number, rotinas: Rotina[]): VencimentoCalendario[] {
  const cal: VencimentoCalendario[] = []

  // Obrigações fixas
  const obrigacoes = [
    ...OBRIGACOES_MENSAIS,
    ...(isTrimestreAtivo(mes) ? OBRIGACOES_TRIMESTRAIS : []),
    ...(isAnualAtivo(mes) ? OBRIGACOES_ANUAIS : []),
  ]
  for (const ob of obrigacoes) {
    cal.push({
      dia: Math.min(ob.dia_vencimento, new Date(ano, mes, 0).getDate()),
      titulo: ob.titulo,
      setor: ob.setor,
      regimes: ob.regimes,
      tipo: isAnualAtivo(mes) && OBRIGACOES_ANUAIS.includes(ob) ? 'anual'
        : isTrimestreAtivo(mes) && OBRIGACOES_TRIMESTRAIS.includes(ob) ? 'trimestral'
        : 'mensal',
    })
  }

  // Rotinas do sistema
  for (const rotina of rotinas) {
    if (!rotina.setor) continue
    let dias: number[] = []
    if (rotina.frequencia === 'mensal' && rotina.dia_mes)
      dias = [Math.min(rotina.dia_mes, new Date(ano, mes, 0).getDate())]
    else if (rotina.frequencia === 'semanal' && rotina.dia_semana !== null)
      dias = diaDaSemanaNoMes(ano, mes, rotina.dia_semana)
    else if (rotina.frequencia === 'anual' && rotina.dia_ano) {
      const [m, d] = rotina.dia_ano.split('-').map(Number)
      if (m === mes) dias = [d!]
    }
    for (const dia of dias) {
      cal.push({ dia, titulo: rotina.titulo, setor: rotina.setor as Setor, regimes: [], tipo: 'rotina', rotinaId: rotina.id })
    }
  }

  return cal.sort((a, b) => a.dia - b.dia)
}

// ─── Stats do mês ─────────────────────────────────────────────

export interface StatsMes {
  total: number
  concluidas: number
  pendentes: number
  pct: number
}

export async function statsRotinasMes(mes: number, ano: number): Promise<StatsMes> {
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`
  const { data } = await (supabase.from('tarefas') as any)
    .select('status')
    .gte('prazo', `${mesStr}-01`)
    .lte('prazo', `${mesStr}-31`)
    .in('setor', ['Fiscal', 'Pessoal', 'Administrativo'])
  const rows = (data ?? []) as Array<{ status: string }>
  const total = rows.length
  const concluidas = rows.filter(r => r.status === 'Concluída').length
  return { total, concluidas, pendentes: total - concluidas, pct: total ? Math.round((concluidas / total) * 100) : 0 }
}

export { FrequenciaRotina }
