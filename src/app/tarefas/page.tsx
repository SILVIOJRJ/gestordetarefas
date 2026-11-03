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
import { calendarioCompleto } from '@/services/smartCalendar'
import type { EventoCalendario } from '@/services/smartCalendar'
import {
  Plus, Search, LayoutList, LayoutGrid, Loader2,
  AlertTriangle, X, ChevronRight, User, Clock,
  CheckSquare, Square, Users, Tag, ChevronDown, Calendar,
} from 'lucide-react'

const SETORES: Setor[] = ['Legalização', 'Fiscal', 'Pessoal', 'Office Boy', 'Gerencial', 'Administrativo']
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

// ─── Componente ───────────────────────────────────────────────

export default function TarefasPage() {
  const [tarefas, setTarefas]           = useState<TarefaComCliente[]>([])
  const [loading, setLoading]           = useState(true)
  const [erro, setErro]                 = useState<string | null>(null)
  const [view, setView]                 = useState<'lista' | 'kanban' | 'calendario'>('lista')
  const [calMes, setCalMes]             = useState(() => new Date().getMonth())
  const [calAno, setCalAno]             = useState(() => new Date().getFullYear())
  const [calEventos, setCalEventos]     = useState<EventoCalendario[]>([])
  const [busca, setBusca]               = useState('')
  const [filtroSetor, setFiltroSetor]   = useState<Setor | ''>('')
  const [filtroStatus, setFiltroStatus] = useState<StatusTarefa | ''>('')
  const [clientes, setClientes]         = useState<Array<{ id: string; nome: string }>>([])
  const [showAdd, setShowAdd]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [tarefaSel, setTarefaSel]       = useState<TarefaComCliente | null>(null)
  const [resumo, setResumo]             = useState<ResumoContratual | null>(null)
  const [autorNome, setAutorNome]       = useState('Usuário')
  const [isAdmin, setIsAdmin]           = useState(false)

  // Seleção em lote
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [showLoteMenu, setShowLoteMenu] = useState(false)
  const [loteResp, setLoteResp]         = useState('')
  const [lotePrio, setLotePrio]         = useState<Prioridade | ''>('')
  const [salvandoLote, setSalvandoLote] = useState(false)
  const [msgLote, setMsgLote]           = useState<string | null>(null)

  // Form nova tarefa
  const [form, setForm] = useState({
    titulo: '', setor: '' as Setor | '', responsavel: '',
    prioridade: 'Média' as Prioridade, prazo: '', descricao: '', cliente_id: '',
  })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setAutorNome(user.email)
      if (user) {
        const { data: p } = await (supabase.from('perfis_usuarios') as any)
          .select('role').eq('id', user.id).single()
        if (p?.role === 'admin') setIsAdmin(true)
      }
    }
    init()
    ;(supabase.from('clientes') as any).select('id, nome').order('nome').then(({ data }: { data: Array<{ id: string; nome: string }> | null }) => {
      setClientes(data ?? [])
    })
  }, [])

  useEffect(() => {
    const base = calendarioCompleto(calAno, calMes + 1)
    const tarefaEvts: EventoCalendario[] = tarefas
      .filter(t => {
        if (!t.prazo) return false
        const d = new Date(t.prazo + 'T00:00:00')
        return d.getMonth() === calMes && d.getFullYear() === calAno
      })
      .map(t => ({
        data: t.prazo!,
        titulo: t.titulo,
        tipo: 'tarefa' as const,
        setor: t.setor ?? undefined,
        urgente: t.prioridade === 'Urgente',
      }))
    const merged = [...base, ...tarefaEvts].sort((a, b) => a.data.localeCompare(b.data))
    setCalEventos(merged)
  }, [calMes, calAno, tarefas])

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
      setSelecionadas(new Set()) // limpa seleção ao recarregar
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
        titulo:      form.titulo.trim(),
        setor:       (form.setor || null) as Setor | null,
        responsavel: form.responsavel || null,
        prioridade:  form.prioridade,
        prazo:       form.prazo || null,
        descricao:   form.descricao || null,
        cliente_id:  form.cliente_id || null,
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

  function toggleSel(id: string) {
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (selecionadas.size === tarefas.length) {
      setSelecionadas(new Set())
    } else {
      setSelecionadas(new Set(tarefas.map(t => t.id)))
    }
  }

  async function aplicarLote() {
    if (!selecionadas.size) return
    if (!loteResp && !lotePrio) { setMsgLote('Escolha responsável ou prioridade para alterar.'); return }
    setSalvandoLote(true)
    setMsgLote(null)
    try {
      const updates: Record<string, string> = {}
      if (loteResp.trim())  updates.responsavel = loteResp.trim()
      if (lotePrio)         updates.prioridade  = lotePrio

      const ids = Array.from(selecionadas)
      const { error } = await (supabase.from('tarefas') as any)
        .update(updates)
        .in('id', ids)

      if (error) throw error
      setMsgLote(`${ids.length} tarefa${ids.length !== 1 ? 's' : ''} atualizada${ids.length !== 1 ? 's' : ''}.`)
      setSelecionadas(new Set())
      setLoteResp('')
      setLotePrio('')
      setShowLoteMenu(false)
      await carregar()
    } catch (e) {
      setMsgLote(e instanceof Error ? e.message : 'Erro ao atualizar.')
    } finally {
      setSalvandoLote(false)
    }
  }

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
            <div className="flex rounded-lg border border-brand-200 overflow-hidden">
              <button
                onClick={() => setView('lista')}
                className={`px-3 py-2 text-xs flex items-center gap-1.5 transition ${view === 'lista' ? 'bg-brand-700 text-white' : 'text-brand-500 hover:bg-brand-50'}`}
              >
                <LayoutList size={14} /> Lista
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-2 text-xs flex items-center gap-1.5 transition ${view === 'kanban' ? 'bg-brand-700 text-white' : 'text-brand-500 hover:bg-brand-50'}`}
              >
                <LayoutGrid size={14} /> Kanban
              </button>
              <button
                onClick={() => setView('calendario')}
                className={`px-3 py-2 text-xs flex items-center gap-1.5 transition ${view === 'calendario' ? 'bg-brand-700 text-white' : 'text-brand-500 hover:bg-brand-50'}`}
              >
                <Calendar size={14} /> Calendário
              </button>
            </div>
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

        {/* Barra de ações em lote (admin, somente na view lista) */}
        {isAdmin && view === 'lista' && (
          <div className="flex items-center gap-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-2.5">
            <button
              onClick={toggleTodos}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-900 font-medium transition"
            >
              {selecionadas.size === tarefas.length && tarefas.length > 0
                ? <CheckSquare size={14} className="text-accent-600" />
                : <Square size={14} />
              }
              {selecionadas.size > 0 ? `${selecionadas.size} selecionada${selecionadas.size !== 1 ? 's' : ''}` : 'Selecionar todas'}
            </button>

            {selecionadas.size > 0 && (
              <>
                <span className="text-brand-300">|</span>
                <div className="relative">
                  <button
                    onClick={() => setShowLoteMenu(v => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900 bg-white border border-brand-200 px-3 py-1.5 rounded-lg transition"
                  >
                    <Users size={13} /> Alterar em lote <ChevronDown size={12} />
                  </button>

                  {showLoteMenu && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-brand-200 rounded-xl shadow-lg p-4 space-y-3 w-72">
                      <p className="text-xs font-semibold text-brand-700">
                        Alterar {selecionadas.size} tarefa{selecionadas.size !== 1 ? 's' : ''}
                      </p>
                      <div>
                        <label className="text-xs text-brand-500 block mb-1 flex items-center gap-1">
                          <Users size={11} /> Novo responsável
                        </label>
                        <input
                          className="input text-sm"
                          placeholder="Nome do responsável"
                          value={loteResp}
                          onChange={e => setLoteResp(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-brand-500 block mb-1 flex items-center gap-1">
                          <Tag size={11} /> Nova prioridade
                        </label>
                        <select
                          className="input text-sm"
                          value={lotePrio}
                          onChange={e => setLotePrio(e.target.value as Prioridade | '')}
                        >
                          <option value="">Manter atual</option>
                          {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      {msgLote && (
                        <p className={`text-xs ${msgLote.includes('Erro') || msgLote.includes('Escolha') ? 'text-danger-600' : 'text-accent-700'}`}>
                          {msgLote}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={aplicarLote}
                          disabled={salvandoLote}
                          className="btn-primary flex-1 text-xs py-1.5"
                        >
                          {salvandoLote ? <Loader2 size={13} className="animate-spin" /> : null}
                          Aplicar
                        </button>
                        <button
                          onClick={() => { setShowLoteMenu(false); setMsgLote(null) }}
                          className="btn-secondary text-xs py-1.5"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Feedback lote fora do menu */}
        {msgLote && !showLoteMenu && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${msgLote.includes('Erro') || msgLote.includes('Escolha') ? 'text-danger-600 bg-danger-100' : 'text-accent-700 bg-accent-100'}`}>
            {msgLote}
            <button onClick={() => setMsgLote(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

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
          <ListView
            tarefas={tarefas}
            onSelect={abrirTarefa}
            isAdmin={isAdmin}
            selecionadas={selecionadas}
            onToggleSel={toggleSel}
          />
        ) : view === 'kanban' ? (
          <KanbanView tarefas={tarefas} onSelect={abrirTarefa} />
        ) : (
          <CalendarView
            mes={calMes}
            ano={calAno}
            eventos={calEventos}
            onPrevMes={() => {
              if (calMes === 0) { setCalMes(11); setCalAno(a => a - 1) }
              else setCalMes(m => m - 1)
            }}
            onNextMes={() => {
              if (calMes === 11) { setCalMes(0); setCalAno(a => a + 1) }
              else setCalMes(m => m + 1)
            }}
          />
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

interface ListViewProps {
  tarefas: TarefaComCliente[]
  onSelect: (t: TarefaComCliente) => void
  isAdmin: boolean
  selecionadas: Set<string>
  onToggleSel: (id: string) => void
}

function ListView({ tarefas, onSelect, isAdmin, selecionadas, onToggleSel }: ListViewProps) {
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
            {isAdmin && <th className="px-3 py-3 w-8" />}
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
            <tr
              key={t.id}
              className={`hover:bg-brand-50 cursor-pointer ${selecionadas.has(t.id) ? 'bg-accent-50' : ''}`}
            >
              {isAdmin && (
                <td
                  className="px-3 py-3"
                  onClick={(e) => { e.stopPropagation(); onToggleSel(t.id) }}
                >
                  {selecionadas.has(t.id)
                    ? <CheckSquare size={15} className="text-accent-600" />
                    : <Square size={15} className="text-brand-300" />
                  }
                </td>
              )}
              <td className="px-4 py-3" onClick={() => onSelect(t)}>
                <p className="font-medium text-brand-900 line-clamp-1">{t.titulo}</p>
                <p className={`text-xs ${PRIO_COLOR[t.prioridade]}`}>{t.prioridade}</p>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-brand-600 text-xs" onClick={() => onSelect(t)}>{t.clientes?.nome ?? '—'}</td>
              <td className="px-4 py-3 hidden md:table-cell text-brand-600 text-xs" onClick={() => onSelect(t)}>{t.setor ?? '—'}</td>
              <td className="px-4 py-3" onClick={() => onSelect(t)}>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[t.status]}`}>{t.status}</span>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-brand-500 text-xs" onClick={() => onSelect(t)}>
                {t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : '—'}
              </td>
              <td className="px-4 py-3" onClick={() => onSelect(t)}>
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
            <div className="flex items-center justify-between mb-2 px-1">
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

// ── Visualização Calendário ───────────────────────────────────

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const TIPO_COR: Record<EventoCalendario['tipo'], string> = {
  tarefa:            'bg-blue-500',
  obrigacao:         'bg-amber-500',
  prazo_tributario:  'bg-orange-500',
  reforma:           'bg-purple-500',
  feriado_nacional:  'bg-red-500',
  feriado_municipal: 'bg-pink-500',
}

const TIPO_LABEL: Record<EventoCalendario['tipo'], string> = {
  tarefa:            'Tarefa',
  obrigacao:         'Obrigação',
  prazo_tributario:  'Prazo Tributário',
  reforma:           'Reforma Tributária',
  feriado_nacional:  'Feriado Nacional',
  feriado_municipal: 'Feriado Municipal',
}

interface CalendarViewProps {
  mes: number
  ano: number
  eventos: EventoCalendario[]
  onPrevMes: () => void
  onNextMes: () => void
}

function CalendarView({ mes, ano, eventos, onPrevMes, onNextMes }: CalendarViewProps) {
  const hoje = new Date().toISOString().split('T')[0]
  const primeiroDia = new Date(ano, mes, 1)
  const ultimoDia = new Date(ano, mes + 1, 0).getDate()
  const iniciaSemana = primeiroDia.getDay() // 0=Dom

  const eventosPorDia = new Map<number, EventoCalendario[]>()
  eventos.forEach(ev => {
    const d = new Date(ev.data + 'T00:00:00')
    if (d.getMonth() === mes && d.getFullYear() === ano) {
      const dia = d.getDate()
      const lista = eventosPorDia.get(dia) ?? []
      lista.push(ev)
      eventosPorDia.set(dia, lista)
    }
  })

  const cells: Array<number | null> = [
    ...Array(iniciaSemana).fill(null),
    ...Array.from({ length: ultimoDia }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-4">
      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button onClick={onPrevMes} className="btn-secondary px-3 py-1.5 text-xs">← Anterior</button>
        <h2 className="text-base font-bold text-brand-800">{MESES_PT[mes]} {ano}</h2>
        <button onClick={onNextMes} className="btn-secondary px-3 py-1.5 text-xs">Próximo →</button>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-brand-200 overflow-hidden">
        {/* Cabeçalho dias da semana */}
        <div className="grid grid-cols-7 bg-brand-50">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-brand-500 py-2">{d}</div>
          ))}
        </div>

        {/* Células */}
        <div className="grid grid-cols-7 divide-x divide-y divide-brand-100">
          {cells.map((dia, i) => {
            const dataStr = dia ? `${ano}-${String(mes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}` : ''
            const isHoje = dataStr === hoje
            const evsDia = dia ? (eventosPorDia.get(dia) ?? []) : []
            const urgente = evsDia.some(e => e.urgente)

            return (
              <div
                key={i}
                className={`min-h-[72px] p-1.5 relative group ${dia ? 'bg-white hover:bg-brand-50' : 'bg-brand-50/40'}`}
              >
                {dia && (
                  <>
                    <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      isHoje ? 'bg-blue-600 text-white' : urgente ? 'text-red-600 font-bold' : 'text-brand-600'
                    }`}>
                      {dia}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {evsDia.slice(0, 4).map((ev, j) => (
                        <div
                          key={j}
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${TIPO_COR[ev.tipo]}`}
                          title={`${ev.titulo}${ev.setor ? ` (${ev.setor})` : ''}${ev.municipio ? ` — ${ev.municipio}` : ''}`}
                        />
                      ))}
                      {evsDia.length > 4 && (
                        <span className="text-[9px] text-brand-400">+{evsDia.length - 4}</span>
                      )}
                    </div>
                    {/* Tooltip ao hover */}
                    {evsDia.length > 0 && (
                      <div className="absolute left-0 top-full z-50 hidden group-hover:block bg-white border border-brand-200 rounded-xl shadow-lg p-2 w-56 space-y-1">
                        {evsDia.map((ev, j) => (
                          <div key={j} className="flex items-start gap-1.5">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${TIPO_COR[ev.tipo]}`} />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-brand-800 leading-tight">{ev.titulo}</p>
                              {ev.setor && <p className="text-[10px] text-brand-400">{ev.setor}</p>}
                              {ev.municipio && <p className="text-[10px] text-brand-400">{ev.municipio}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(TIPO_COR) as [EventoCalendario['tipo'], string][]).map(([tipo, cor]) => (
          <div key={tipo} className="flex items-center gap-1.5 text-xs text-brand-600">
            <div className={`w-2.5 h-2.5 rounded-full ${cor}`} />
            {TIPO_LABEL[tipo]}
          </div>
        ))}
      </div>

      {/* Lista compacta de eventos do mês */}
      {eventos.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-brand-700">Eventos de {MESES_PT[mes]}</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {eventos.map((ev, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${TIPO_COR[ev.tipo]}`} />
                <span className="text-brand-400 flex-shrink-0 w-12">
                  {new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className={`font-medium ${ev.urgente ? 'text-red-700' : 'text-brand-700'}`}>{ev.titulo}</span>
                {ev.setor && <span className="text-brand-400 ml-auto flex-shrink-0">({ev.setor})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
