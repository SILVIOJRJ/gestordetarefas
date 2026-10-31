import { supabase } from '@/lib/supabase'
import type {
  ProcessoLegalizacao,
  StatusProcesso,
  EtapaProcesso,
  TipoAtoProcesso,
  Exigencia,
} from '@/types/database.types'
import { v4 as uuid } from 'uuid'

// ─── Helpers ──────────────────────────────────────────────────

export type ProcessoComCliente = ProcessoLegalizacao & {
  clientes?: { nome: string; cnpj?: string } | null
}

export interface NovoProcessoPayload {
  cliente_id: string
  tipo_ato: TipoAtoProcesso
  descricao: string
  prazo: string | null
  responsavel: string
  responsaveis_conjuntos: string[]
  obs: string | null
}

// ─── Listagem ─────────────────────────────────────────────────

export async function listarProcessos(): Promise<ProcessoComCliente[]> {
  const { data, error } = await (supabase.from('processos_legalizacao') as any)
    .select('*, clientes(nome, cnpj)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizar)
}

// ─── Criação ──────────────────────────────────────────────────

export async function criarProcesso(payload: NovoProcessoPayload): Promise<ProcessoLegalizacao> {
  const row = {
    cliente_id:            payload.cliente_id,
    tipo_ato:              payload.tipo_ato,
    tipo:                  payload.tipo_ato,
    descricao:             payload.descricao,
    status:                'Pendente' as StatusProcesso,
    prazo:                 payload.prazo,
    responsavel:           payload.responsavel || null,
    responsaveis_conjuntos: payload.responsaveis_conjuntos,
    etapa_atual:           'Viabilidade' as EtapaProcesso,
    exigencias:            [] as Exigencia[],
    protocolo_viabilidade: null,
    protocolo_dbe_redesim: null,
    protocolo_junta:       null,
    inscricao_municipal:   null,
    inscricao_estadual:    null,
    protocolo_vigilancia:  null,
    protocolo_bombeiros:   null,
    protocolo_meio_ambiente: null,
    obs:                   payload.obs || null,
    lembrar_antes_dias:    3,
    retorno_confirmado:    false,
  }
  const { data, error } = await (supabase.from('processos_legalizacao') as any)
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return normalizar(data)
}

// ─── Atualização de campos ─────────────────────────────────────

export async function atualizarProcesso(
  id: string,
  updates: Partial<ProcessoLegalizacao>,
): Promise<void> {
  const { error } = await (supabase.from('processos_legalizacao') as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function avancarEtapa(id: string, etapa: EtapaProcesso): Promise<void> {
  const status: StatusProcesso = etapa === 'Concluído' ? 'Concluído' : 'Em andamento'
  await atualizarProcesso(id, { etapa_atual: etapa, status })
}

// ─── Exigências ───────────────────────────────────────────────

export async function adicionarExigencia(
  processo: ProcessoLegalizacao,
  exigencia: Omit<Exigencia, 'id' | 'sanado' | 'sanado_em'>,
): Promise<Exigencia[]> {
  const nova: Exigencia = {
    id:          uuid(),
    descricao:   exigencia.descricao,
    data_limite: exigencia.data_limite,
    responsavel: exigencia.responsavel,
    sanado:      false,
    sanado_em:   null,
  }
  const lista = [...(processo.exigencias ?? []), nova]
  await atualizarProcesso(processo.id, { exigencias: lista })
  return lista
}

export async function sanarExigencia(
  processo: ProcessoLegalizacao,
  exigenciaId: string,
): Promise<Exigencia[]> {
  const lista = (processo.exigencias ?? []).map(e =>
    e.id === exigenciaId
      ? { ...e, sanado: true, sanado_em: new Date().toISOString() }
      : e,
  )
  await atualizarProcesso(processo.id, { exigencias: lista })
  return lista
}

export async function removerExigencia(
  processo: ProcessoLegalizacao,
  exigenciaId: string,
): Promise<Exigencia[]> {
  const lista = (processo.exigencias ?? []).filter(e => e.id !== exigenciaId)
  await atualizarProcesso(processo.id, { exigencias: lista })
  return lista
}

// ─── Normalização ─────────────────────────────────────────────

function normalizar(row: Record<string, unknown>): ProcessoComCliente {
  return {
    ...row,
    exigencias:            Array.isArray(row.exigencias) ? row.exigencias as Exigencia[] : [],
    responsaveis_conjuntos: Array.isArray(row.responsaveis_conjuntos) ? row.responsaveis_conjuntos as string[] : [],
    etapa_atual:           (row.etapa_atual as EtapaProcesso) ?? 'Viabilidade',
    tipo_ato:              (row.tipo_ato as TipoAtoProcesso) ?? 'Abertura',
    status:                (row.status as StatusProcesso) ?? 'Pendente',
  } as ProcessoComCliente
}
