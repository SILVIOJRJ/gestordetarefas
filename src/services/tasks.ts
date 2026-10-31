import { supabase } from '@/lib/supabase'
import type { Tarefa, StatusTarefa, Prioridade, Setor, TipoEventoTarefa } from '@/types/database.types'

export type { Tarefa }

export interface TarefaComCliente extends Tarefa {
  clientes?: { nome: string } | null
}

export interface FiltrosTarefa {
  setor?: Setor
  status?: StatusTarefa
  prioridade?: Prioridade
  responsavel?: string
  clienteId?: string
  busca?: string
}

export async function listarTarefas(filtros: FiltrosTarefa = {}): Promise<TarefaComCliente[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from('tarefas') as any)
    .select('*, clientes(nome)')
    .order('prazo', { ascending: true, nullsFirst: false })

  if (filtros.setor)      q = q.eq('setor', filtros.setor)
  if (filtros.status)     q = q.eq('status', filtros.status)
  if (filtros.prioridade) q = q.eq('prioridade', filtros.prioridade)
  if (filtros.responsavel) q = q.ilike('responsavel', `%${filtros.responsavel}%`)
  if (filtros.clienteId)  q = q.eq('cliente_id', filtros.clienteId)
  if (filtros.busca)      q = q.ilike('titulo', `%${filtros.busca}%`)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TarefaComCliente[]
}

export async function criarTarefa(payload: {
  titulo: string
  setor: Setor | null
  responsavel: string | null
  prioridade: Prioridade
  prazo: string | null
  descricao: string | null
  cliente_id: string | null
}, autorNome: string): Promise<Tarefa> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tarefas') as any)
    .insert({ ...payload, status: 'Pendente' })
    .select()
    .single()
  if (error) throw new Error(error.message)

  await registrarEvento(data.id, 'abertura', 'Tarefa criada', null, null, payload.descricao, autorNome)
  return data as Tarefa
}

export async function atualizarStatus(
  tarefaId: string,
  novoStatus: StatusTarefa,
  autorNome: string,
  obs?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('tarefas') as any)
    .update({ status: novoStatus })
    .eq('id', tarefaId)
  if (error) throw new Error(error.message)

  await registrarEvento(tarefaId, 'situacao', `Status: ${novoStatus}`, null, novoStatus, obs ?? null, autorNome)
}

export async function registrarEvento(
  tarefaId: string,
  tipo: TipoEventoTarefa,
  titulo: string | null,
  protocolo: string | null,
  situacao: string | null,
  descricao: string | null,
  autor: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('task_eventos') as any).insert({
    tarefa_id: tarefaId,
    tipo,
    titulo,
    protocolo,
    situacao,
    descricao,
    autor,
  })
}

export async function listarEventos(tarefaId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('task_eventos') as any)
    .select('*')
    .eq('tarefa_id', tarefaId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function excluirTarefa(tarefaId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('tarefas') as any).delete().eq('id', tarefaId)
}
