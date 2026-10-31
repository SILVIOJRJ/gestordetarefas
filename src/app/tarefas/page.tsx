'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import TaskDetailModal from '@/components/tasks/TaskDetailModal'
import { supabase } from '@/lib/supabase'
import { listarTarefas, criarTarefa } from '@/services/tasks'
import { obterResumoContratualCliente, BADGE_LABEL } from '@/services/contracts'
import type { TarefaComCliente } from '@/services/tasks'
import type { ResumoContratual } from '@/services/contracts'
import type { Setor, StatusTarefa, Prioridade } from '@/types/database.types'
import {
  Plus, Search, LayoutList, LayoutGrid, Loader2,
  AlertTriangle, X, ChevronRight, User, Clock,
} from 'lucide-react'

const SETORES: Setor[] = ['Legalização', 'Fiscal', 'RH', 'Office Boy', 'Gerencial', 'Administrativo']
const STATUS_LIST: StatusTarefa[] = ['Pendente', 'Em andamento', 'Aguardando', 'Concluída', 'Cancelada']
const PRIORIDADES: Prioridade[] = ['Baixa', 'Média', 'Alta', 'Urgente']

const STATUS_COLOR: Record<StatusTarefa, string> = {
  'Pendente':     'bg-warning-100 text-warning-600',
  'Em andamento': 'bg-blue-100 text-blue-700',
  'Aguardando':   'bg-brand-100 text-brand-600',
  'Concluída':    'bg-accent-100 text-accent-700',
  'Cancelada':    'bg-danger-100 text-danger-600',
}

const PRIO_COLOR: Record<Prioridade, string> = {
  'Baixa':   'text-brand-400',
  'Média':   'text-blue-500',
  'Alta':    'text-warning-600',
  'Urgente': 'text-danger-600',
}

const KANBAN_COLS: StatusTarefa[] = ['Pendente', 'Em andamento', 'Aguardando', 'Concluída']

export default function TarefasPage() {
  const [tarefas, setTarefas]           = useState<TarefaComCliente[]>([])
  const [loading, setLoading]           = useState(true)
  const [erro, setErro]                 = useState<string | null>(null)
  const [view, setView]                 = useState<'lista' | 'kanban'>('lista')
  const [busca, setBusca]               = useState('')
  const [filtroSetor, setFiltroSetor]   = useState<Setor | ''>('')
  const [filtroStatus, setFiltroStatus] = useState<StatusTarefa | ''>('')
  const [clientes, setClientes]         = useState<Array<{ id: string; nome: string }>>([])
  const [showAdd, setShowAdd]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [tarefaSel, setTarefaSel]       = useState<TarefaComCliente | null>(null)
  const [resumo, setResumo]             = useState<ResumoContratual | null>(null)
  const [autorNome, setAutorNome]       = useState('Usuário')

  // Form nova tarefa
  const [form, setForm] = useState({
    titulo: '', setor: '' as Setor | '', responsavel: '',
    prioridade: 'Média' as Prioridade, prazo: '', descricao: '', cliente_id: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setAutorNome(data.user.email)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from('clientes') as any).select('id, nome').order('nome').then(({ data }: { data: Array<{ id: string; nome: string }> | null }) => {
      setClientes(data ?? [])
    })
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await listarTarefas({
        setor: filtroSetor || undefined,
        status: filtroStatus || undefined,
        busca: busca || undefined,
      })
      setTarefas(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar tarefas.')
    } finally {
      setLoading(false)
    }
  }, [filtroSetor, filtroStatus, busca])

  useEffect(() => { carregar() }, [carregar])

  async function handleCriar() {
    if (!form.titulo.trim()) { setErro('Título obrigatório.'); return }
    setSaving(true)
    setErro(null)
    try {
      await criarTarefa({
        titulo:       form.titulo.trim(),
        setor:        (form.setor || null) as Setor | null,
        responsavel:  form.responsavel || null,
        prioridade:   form.prioridade,
        prazo:        form.prazo || null,
        descricao:    form.descricao || null,
        cliente_id:   form.cliente_id || null,
      }, autorNome)
      setForm({ titulo: '', setor: '', responsavel: '', prioridade: 'Média', prazo: '', descricao: '', cliente_id: '' })
      setShowAdd(false)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar.')
    } finally {
      setSaving(false)
    }
  }

  async function abrirTarefa(t: TarefaComCliente) {
    setTarefaSel(t)
    if (t.cliente_id) {
      const r = await obterResumoContratualCliente(t.cliente_id).catch(() => null)
      setResumo(r)
    } else {
      setResumo(null)
    }
  }

  const tarefasFiltradas = tarefas

  return (
    <Shell>
      <div className="space-y-5">

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-brand-900">Tarefas</h1>
            <p className="text-xs text-brand-500 mt-0.5">{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''} encontrada{tarefas.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView(view === 'lista' ? 'kanban' : 'lista')}
              className="btn-secondary"
            >
              {view === 'lista' ? <LayoutGrid size={15} /> : <LayoutList size={15} />}
              {view === 'lista' ? 'Kanban' : 'Lista'}
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={15} /> Nova Tarefa
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input className="input pl-9" placeholder="Buscar tarefa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className="input w-36" value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value as Setor | '')}>
            <option value="">Todos os setores</option>
            {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-36" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusTarefa | '')}>
            <option value="">Todos os status</option>
            {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2 text-sm text-danger-600 bg-danger-100 px-3 py-2 rounded-lg">
            <AlertTriangle size={14} /> {erro}
            <button onClick={() => setErro(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Form nova tarefa */}
        {showAdd && (
          <div className="card border-2 border-brand-300 space-y-3">
            <h2 className="font-semibold text-brand-900">Nova Tarefa</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="input-label">Título *</label>
                <input className="input" placeholder="Descreva a tarefa..." value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Empresa</label>
                <select className="input" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">Sem empresa</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Setor</label>
                <select className="input" value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value as Setor | '' })}>
                  <option value="">Selecione...</option>
                  {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Responsável</label>
                <input className="input" placeholder="Nome do responsável" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Prioridade</label>
                <select className="input" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value as Prioridade })}>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Prazo</label>
                <input type="date" className="input" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Descrição</label>
                <textarea className="input resize-none" rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCriar} disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar Tarefa
              </button>
              <button onClick={() => { setShowAdd(false); setErro(null) }} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-300" /></div>
        ) : view === 'lista' ? (
          <ListView tarefas={tarefasFiltradas} onSelect={abrirTarefa} />
        ) : (
          <KanbanView tarefas={tarefasFiltradas} onSelect={abrirTarefa} />
        )}
      </div>

      {/* Modal detalhe */}
      {tarefaSel && (
        <TaskDetailModal
          tarefa={tarefaSel}
          onClose={() => { setTarefaSel(null); setResumo(null) }}
          onUpdate={carregar}
        />
      )}

      {/* Card resumo contratual */}
      {tarefaSel && resumo && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-72 card shadow-card-hover border border-brand-200 space-y-2">
          <p className="text-xs font-bold text-brand-900">Contrato — {resumo.nomeCliente}</p>
          {resumo.contrato ? (
            <p className="text-xs text-brand-600">{resumo.contrato.titulo}</p>
          ) : (
            <p className="text-xs text-brand-400">Sem contrato ativo</p>
          )}
          {resumo.limites.map((l) => (
            <div key={l.label} className="text-xs">
              <p className="text-brand-600">{l.label}: <span className="font-medium">{l.atual}/{l.limite}</span></p>
              <p className="text-[11px]">{BADGE_LABEL[l.badge]}</p>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}

// ── Visualização Lista ────────────────────────────────────────

function ListView({ tarefas, onSelect }: { tarefas: TarefaComCliente[]; onSelect: (t: TarefaComCliente) => void }) {
  if (tarefas.length === 0) return (
    <div className="text-center py-16 text-brand-400">
      <LayoutList size={32} className="mx-auto mb-3 opacity-40" />
      <p className="text-sm">Nenhuma tarefa encontrada.</p>
    </div>
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-200">
      <table className="w-full text-sm">
        <thead className="bg-brand-50 text-xs text-brand-500 uppercase">
          <tr>
            <th className="text-left px-4 py-3">Tarefa</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Empresa</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">Setor</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Prazo</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-100">
          {tarefas.map((t) => (
            <tr key={t.id} className="hover:bg-brand-50 cursor-pointer" onClick={() => onSelect(t)}>
              <td className="px-4 py-3">
                <p className="font-medium text-brand-900 line-clamp-1">{t.titulo}</p>
                <p className={`text-xs ${PRIO_COLOR[t.prioridade]}`}>{t.prioridade}</p>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-brand-600 text-xs">{t.clientes?.nome ?? '—'}</td>
              <td className="px-4 py-3 hidden md:table-cell text-brand-600 text-xs">{t.setor ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[t.status]}`}>{t.status}</span>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-brand-500 text-xs">
                {t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : '—'}
              </td>
              <td className="px-4 py-3">
                <ChevronRight size={15} className="text-brand-400" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Visualização Kanban ───────────────────────────────────────

function KanbanView({ tarefas, onSelect }: { tarefas: TarefaComCliente[]; onSelect: (t: TarefaComCliente) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {KANBAN_COLS.map((col) => {
        const items = tarefas.filter((t) => t.status === col)
        return (
          <div key={col} className="flex-shrink-0 w-64 sm:w-72">
            <div className={`flex items-center justify-between mb-2 px-1`}>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[col]}`}>{col}</span>
              <span className="text-xs text-brand-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 && (
                <div className="text-center py-8 text-brand-300 text-xs border-2 border-dashed border-brand-200 rounded-xl">
                  Vazio
                </div>
              )}
              {items.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="card cursor-pointer hover:shadow-card-hover transition-shadow space-y-2"
                >
                  <p className="text-sm font-semibold text-brand-900 line-clamp-2">{t.titulo}</p>
                  {t.clientes?.nome && (
                    <p className="text-xs text-brand-500 truncate">{t.clientes.nome}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${PRIO_COLOR[t.prioridade]}`}>{t.prioridade}</span>
                    <div className="flex gap-2 text-brand-400 text-xs">
                      {t.responsavel && <span className="flex items-center gap-0.5"><User size={10} />{t.responsavel.split(' ')[0]}</span>}
                      {t.prazo && <span className="flex items-center gap-0.5"><Clock size={10} />{new Date(t.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
