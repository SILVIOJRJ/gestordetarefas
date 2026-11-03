'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import type { Tarefa, TarefaComentario, TarefaAndamento, PerfilUsuario } from '@/types/database.types'
import {
  Plus, Search, Filter, Calendar, ChevronDown, ChevronRight,
  MessageSquare, Activity, Paperclip, User, Clock, AlertCircle,
  CheckCircle2, Circle, ArrowRight, X, Send, BarChart3,
  ListTodo, Kanban, RefreshCw, Flag, Users,
} from 'lucide-react'

// ─── Tipos locais ────────────────────────────────────────────
interface TarefaComExtras extends Tarefa {
  cliente_nome?: string | null
  atribuido_nome?: string | null
  _comentarios?: TarefaComentario[]
  _andamentos?: TarefaAndamento[]
  _expandido?: boolean
}

interface NovasTarefa {
  titulo: string
  descricao: string
  setor: string
  prioridade: string
  prazo: string
  cliente_id: string
  atribuido_para: string
  privado: boolean
}

const PRIO_COR: Record<string, string> = {
  'Urgente':   'bg-rose-100 text-rose-700 border-rose-200',
  'Alta':      'bg-orange-100 text-orange-700 border-orange-200',
  'Média':     'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Baixa':     'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const STATUS_COR: Record<string, string> = {
  'Pendente':     'bg-slate-100 text-slate-600',
  'Em andamento': 'bg-blue-100 text-blue-700',
  'Aguardando':   'bg-amber-100 text-amber-700',
  'Concluída':    'bg-emerald-100 text-emerald-700',
  'Cancelada':    'bg-rose-100 text-rose-500',
}

const STATUS_ICONE: Record<string, React.ElementType> = {
  'Pendente':     Circle,
  'Em andamento': ArrowRight,
  'Aguardando':   Clock,
  'Concluída':    CheckCircle2,
  'Cancelada':    X,
}

const STATUS_LIST = ['Pendente', 'Em andamento', 'Aguardando', 'Concluída', 'Cancelada']
const PRIO_LIST   = ['Urgente', 'Alta', 'Média', 'Baixa']
const SETORES     = ['Legalização', 'Fiscal', 'Pessoal', 'Office Boy', 'Gerencial', 'Administrativo']

// ─── Componente TarefaCard ───────────────────────────────────
function TarefaCard({
  t,
  equipe,
  meuNome,
  onAtualizar,
}: {
  t: TarefaComExtras
  equipe: Pick<PerfilUsuario, 'id' | 'nome'>[]
  meuNome: string
  onAtualizar: () => void
}) {
  const [expandido, setExpandido]       = useState(false)
  const [comentarios, setComentarios]   = useState<TarefaComentario[]>([])
  const [andamentos, setAndamentos]     = useState<TarefaAndamento[]>([])
  const [novoComentario, setNovo]       = useState('')
  const [novoAndamento, setAndamento]   = useState('')
  const [novoStatus, setNovoStatus]     = useState('')
  const [salvando, setSalvando]         = useState(false)
  const [aba, setAba]                   = useState<'atividade' | 'comentarios'>('atividade')

  const diasParaPrazo = t.prazo
    ? Math.ceil((new Date(t.prazo).getTime() - Date.now()) / 86400000)
    : null

  const corPrazo = diasParaPrazo == null ? '' :
    diasParaPrazo < 0   ? 'text-rose-600 font-semibold' :
    diasParaPrazo <= 2  ? 'text-orange-600 font-semibold' :
    diasParaPrazo <= 7  ? 'text-amber-600' : 'text-brand-400'

  async function carregar() {
    const [{ data: c }, { data: a }] = await Promise.all([
      (supabase.from('tarefa_comentarios') as any)
        .select('*').eq('tarefa_id', t.id).order('criado_em'),
      (supabase.from('tarefa_andamentos') as any)
        .select('*').eq('tarefa_id', t.id).order('criado_em'),
    ])
    setComentarios(c ?? [])
    setAndamentos(a ?? [])
  }

  async function toggleExpandir() {
    if (!expandido) await carregar()
    setExpandido(v => !v)
  }

  async function enviarComentario() {
    if (!novoComentario.trim()) return
    setSalvando(true)
    await (supabase.from('tarefa_comentarios') as any).insert({
      tarefa_id: t.id, autor_nome: meuNome, corpo: novoComentario.trim(),
    })
    setNovo('')
    await carregar()
    setSalvando(false)
  }

  async function enviarAndamento() {
    if (!novoAndamento.trim()) return
    setSalvando(true)
    const payload: Record<string, unknown> = {
      tarefa_id: t.id, autor_nome: meuNome, descricao: novoAndamento.trim(),
    }
    if (novoStatus) payload.status_novo = novoStatus
    await (supabase.from('tarefa_andamentos') as any).insert(payload)
    if (novoStatus) {
      await (supabase.from('tarefas') as any).update({ status: novoStatus }).eq('id', t.id)
    }
    setAndamento('')
    setNovoStatus('')
    await carregar()
    onAtualizar()
    setSalvando(false)
  }

  const Icone = STATUS_ICONE[t.status] ?? Circle

  return (
    <div className={`bg-white rounded-2xl border ${t.prioridade === 'Urgente' ? 'border-rose-200' : 'border-brand-100'} shadow-sm transition-all`}>
      {/* Header do card */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={toggleExpandir}
      >
        <div className="mt-0.5">
          <Icone size={16} className={t.status === 'Concluída' ? 'text-emerald-500' : t.status === 'Em andamento' ? 'text-blue-500' : 'text-brand-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-medium text-brand-900 ${t.status === 'Concluída' ? 'line-through text-brand-400' : ''}`}>
              {t.titulo}
            </p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${PRIO_COR[t.prioridade] ?? ''}`}>
              {t.prioridade}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COR[t.status] ?? ''}`}>
              {t.status}
            </span>
            {t.cliente_nome && (
              <span className="text-[11px] text-brand-500">{t.cliente_nome}</span>
            )}
            {t.atribuido_nome && (
              <span className="text-[11px] text-accent-600 flex items-center gap-1">
                <User size={10} /> {t.atribuido_nome}
              </span>
            )}
            {t.prazo && (
              <span className={`text-[11px] flex items-center gap-1 ${corPrazo}`}>
                <Clock size={10} />
                {diasParaPrazo! < 0 ? `${Math.abs(diasParaPrazo!)}d atrasado` :
                 diasParaPrazo === 0 ? 'Hoje' :
                 diasParaPrazo === 1 ? 'Amanhã' :
                 `${diasParaPrazo}d`}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={14} className={`text-brand-300 transition-transform mt-1 shrink-0 ${expandido ? 'rotate-90' : ''}`} />
      </div>

      {/* Corpo expandido */}
      {expandido && (
        <div className="border-t border-brand-50 px-4 pb-4 space-y-3">
          {t.descricao && (
            <p className="text-xs text-brand-600 pt-3 leading-relaxed">{t.descricao}</p>
          )}

          {/* Abas */}
          <div className="flex gap-1 border-b border-brand-100 pb-0">
            {(['atividade', 'comentarios'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAba(a)}
                className={`text-xs px-3 py-1.5 rounded-t-lg font-medium transition ${aba === a ? 'bg-accent-50 text-accent-700 border-b-2 border-accent-500' : 'text-brand-400 hover:text-brand-600'}`}
              >
                {a === 'atividade' ? (
                  <span className="flex items-center gap-1"><Activity size={11} />Andamentos {andamentos.length > 0 && `(${andamentos.length})`}</span>
                ) : (
                  <span className="flex items-center gap-1"><MessageSquare size={11} />Comentários {comentarios.length > 0 && `(${comentarios.length})`}</span>
                )}
              </button>
            ))}
          </div>

          {/* Aba: andamentos */}
          {aba === 'atividade' && (
            <div className="space-y-2 pt-1">
              {andamentos.length === 0 && (
                <p className="text-xs text-brand-300 text-center py-2">Nenhum andamento ainda.</p>
              )}
              {andamentos.map(a => (
                <div key={a.id} className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-400 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-brand-700">{a.autor_nome}</span>
                      {a.status_novo && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COR[a.status_novo] ?? 'bg-brand-100'}`}>→ {a.status_novo}</span>
                      )}
                      <span className="text-[10px] text-brand-300">{new Date(a.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-brand-600 mt-0.5">{a.descricao}</p>
                  </div>
                </div>
              ))}
              {/* Input novo andamento */}
              <div className="bg-brand-50 rounded-xl p-3 space-y-2">
                <textarea
                  rows={2}
                  value={novoAndamento}
                  onChange={e => setAndamento(e.target.value)}
                  placeholder="Descreva o andamento..."
                  className="w-full text-xs bg-white border border-brand-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent-400"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={novoStatus}
                    onChange={e => setNovoStatus(e.target.value)}
                    className="text-xs border border-brand-200 rounded-lg px-2 py-1.5 bg-white flex-1 focus:outline-none"
                  >
                    <option value="">Manter status atual</option>
                    {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={enviarAndamento}
                    disabled={salvando || !novoAndamento.trim()}
                    className="flex items-center gap-1 text-xs bg-accent-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-accent-700 transition"
                  >
                    <Send size={11} /> Registrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Aba: comentários */}
          {aba === 'comentarios' && (
            <div className="space-y-2 pt-1">
              {comentarios.length === 0 && (
                <p className="text-xs text-brand-300 text-center py-2">Nenhum comentário ainda.</p>
              )}
              {comentarios.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {c.autor_nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-brand-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-brand-700">{c.autor_nome}</span>
                      <span className="text-[10px] text-brand-300">{new Date(c.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-brand-700 mt-0.5">{c.corpo}</p>
                  </div>
                </div>
              ))}
              {/* Input novo comentário */}
              <div className="flex gap-2 pt-1">
                <div className="w-6 h-6 rounded-full bg-brand-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {meuNome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    value={novoComentario}
                    onChange={e => setNovo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarComentario()}
                    placeholder="Adicionar comentário..."
                    className="flex-1 text-xs border border-brand-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-400"
                  />
                  <button
                    onClick={enviarComentario}
                    disabled={salvando || !novoComentario.trim()}
                    className="p-2 bg-accent-600 text-white rounded-xl disabled:opacity-50 hover:bg-accent-700 transition"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function AdminTarefasPage() {
  const router = useRouter()
  const [loading, setLoading]         = useState(true)
  const [meuId, setMeuId]             = useState('')
  const [meuNome, setMeuNome]         = useState('')
  const [tarefas, setTarefas]         = useState<TarefaComExtras[]>([])
  const [equipe, setEquipe]           = useState<Pick<PerfilUsuario, 'id' | 'nome'>[]>([])
  const [clientes, setClientes]       = useState<{ id: string; nome: string }[]>([])
  const [busca, setBusca]             = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroAtribuido, setFiltroAtribuido]   = useState('')
  const [vista, setVista]             = useState<'lista' | 'kanban'>('lista')
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando]       = useState(false)
  const [nova, setNova]               = useState<NovasTarefa>({
    titulo: '', descricao: '', setor: '', prioridade: 'Média',
    prazo: '', cliente_id: '', atribuido_para: '', privado: false,
  })

  // ── Verificar permissão admin ───────────────────────────────
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await (supabase.from('perfis_usuarios') as any)
        .select('role, nome').eq('id', user.id).single()
      if (p?.role !== 'admin') { router.push('/dashboard'); return }
      setMeuId(user.id)
      setMeuNome(p.nome ?? user.email ?? 'Admin')
      await Promise.all([carregarTarefas(), carregarEquipe(), carregarClientes()])
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carregarTarefas = useCallback(async () => {
    const { data } = await (supabase.from('tarefas') as any)
      .select(`
        *,
        clientes:cliente_id ( nome ),
        atribuido:atribuido_para ( nome )
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    setTarefas((data ?? []).map((t: any) => ({
      ...t,
      cliente_nome:   t.clientes?.nome ?? null,
      atribuido_nome: t.atribuido?.nome ?? null,
    })))
  }, [])

  async function carregarEquipe() {
    const { data } = await (supabase.from('perfis_usuarios') as any)
      .select('id, nome').order('nome')
    setEquipe(data ?? [])
  }

  async function carregarClientes() {
    const { data } = await (supabase.from('clientes') as any)
      .select('id, nome').order('nome')
    setClientes(data ?? [])
  }

  async function criarTarefa() {
    if (!nova.titulo.trim()) return
    setSalvando(true)
    const payload: Record<string, unknown> = {
      titulo:      nova.titulo.trim(),
      descricao:   nova.descricao.trim() || null,
      setor:       nova.setor || null,
      prioridade:  nova.prioridade,
      prazo:       nova.prazo || null,
      cliente_id:  nova.cliente_id || null,
      status:      'Pendente',
      privado:     nova.privado,
    }
    if (nova.atribuido_para) {
      payload.atribuido_para = nova.atribuido_para
      payload.atribuido_por  = meuId
      payload.atribuido_em   = new Date().toISOString()
    }
    await (supabase.from('tarefas') as any).insert(payload)
    await carregarTarefas()
    setModalAberto(false)
    setNova({ titulo: '', descricao: '', setor: '', prioridade: 'Média', prazo: '', cliente_id: '', atribuido_para: '', privado: false })
    setSalvando(false)
  }

  // ── Métricas ────────────────────────────────────────────────
  const total      = tarefas.length
  const pendentes  = tarefas.filter(t => t.status === 'Pendente').length
  const andamento  = tarefas.filter(t => t.status === 'Em andamento').length
  const concluidas = tarefas.filter(t => t.status === 'Concluída').length
  const atrasadas  = tarefas.filter(t => t.prazo && new Date(t.prazo) < new Date() && t.status !== 'Concluída').length

  // ── Filtros ─────────────────────────────────────────────────
  const tarefasFiltradas = tarefas.filter(t => {
    if (busca && !t.titulo.toLowerCase().includes(busca.toLowerCase()) &&
        !(t.cliente_nome ?? '').toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroStatus     && t.status    !== filtroStatus)     return false
    if (filtroPrioridade && t.prioridade !== filtroPrioridade) return false
    if (filtroAtribuido  && t.atribuido_para !== filtroAtribuido) return false
    return true
  })

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw size={22} className="animate-spin text-brand-400" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-900 flex items-center gap-2">
              <ListTodo size={22} className="text-accent-600" />
              Central de Tarefas
            </h1>
            <p className="text-xs text-brand-400 mt-0.5">Gerencie, delegue e acompanhe tudo em um só lugar.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/admin/tarefas/calendario')}
              className="flex items-center gap-2 text-sm border border-brand-200 text-brand-600 px-3 py-2 rounded-xl hover:bg-brand-50 transition"
            >
              <Calendar size={15} /> Calendário
            </button>
            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 text-sm bg-accent-600 text-white px-4 py-2 rounded-xl hover:bg-accent-700 transition font-medium"
            >
              <Plus size={15} /> Nova Tarefa
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { l: 'Total',       v: total,      cor: 'text-brand-700',   bg: 'bg-brand-50',   icone: ListTodo },
            { l: 'Pendentes',   v: pendentes,  cor: 'text-amber-700',   bg: 'bg-amber-50',   icone: Circle },
            { l: 'Andamento',   v: andamento,  cor: 'text-blue-700',    bg: 'bg-blue-50',    icone: ArrowRight },
            { l: 'Concluídas',  v: concluidas, cor: 'text-emerald-700', bg: 'bg-emerald-50', icone: CheckCircle2 },
            { l: 'Atrasadas',   v: atrasadas,  cor: 'text-rose-700',    bg: 'bg-rose-50',    icone: AlertCircle },
          ].map(({ l, v, cor, bg, icone: Ic }) => (
            <div key={l} className={`${bg} rounded-2xl p-4 flex items-center gap-3`}>
              <Ic size={18} className={cor} />
              <div>
                <p className={`text-xl font-bold ${cor}`}>{v}</p>
                <p className="text-xs text-brand-500">{l}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Barra de filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar tarefa ou cliente..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-brand-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-300"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="text-sm border border-brand-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">Todos status</option>
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filtroPrioridade}
            onChange={e => setFiltroPrioridade(e.target.value)}
            className="text-sm border border-brand-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">Todas prioridades</option>
            {PRIO_LIST.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filtroAtribuido}
            onChange={e => setFiltroAtribuido(e.target.value)}
            className="text-sm border border-brand-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">Toda a equipe</option>
            {equipe.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <div className="flex border border-brand-200 rounded-xl overflow-hidden">
            <button onClick={() => setVista('lista')} className={`px-3 py-2 text-sm transition ${vista === 'lista' ? 'bg-accent-600 text-white' : 'text-brand-500 hover:bg-brand-50'}`}>
              <ListTodo size={14} />
            </button>
            <button onClick={() => setVista('kanban')} className={`px-3 py-2 text-sm transition ${vista === 'kanban' ? 'bg-accent-600 text-white' : 'text-brand-500 hover:bg-brand-50'}`}>
              <Kanban size={14} />
            </button>
          </div>
          <button onClick={carregarTarefas} className="p-2 border border-brand-200 rounded-xl text-brand-400 hover:bg-brand-50 transition">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* ── Vista: Lista ───────────────────────────────────── */}
        {vista === 'lista' && (
          <div className="space-y-2">
            {tarefasFiltradas.length === 0 && (
              <div className="text-center py-12 text-brand-300">
                <ListTodo size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma tarefa encontrada.</p>
              </div>
            )}
            {tarefasFiltradas.map(t => (
              <TarefaCard
                key={t.id}
                t={t}
                equipe={equipe}
                meuNome={meuNome}
                onAtualizar={carregarTarefas}
              />
            ))}
          </div>
        )}

        {/* ── Vista: Kanban ──────────────────────────────────── */}
        {vista === 'kanban' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
            {['Pendente', 'Em andamento', 'Aguardando', 'Concluída'].map(status => {
              const col = tarefasFiltradas.filter(t => t.status === status)
              return (
                <div key={status} className="bg-brand-50 rounded-2xl p-3 min-w-[220px]">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${STATUS_COR[status]}`}>{status}</span>
                    <span className="text-xs text-brand-400 font-medium">{col.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.map(t => (
                      <div key={t.id} className="bg-white rounded-xl p-3 shadow-sm border border-brand-100">
                        <p className="text-xs font-medium text-brand-900 leading-snug">{t.titulo}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIO_COR[t.prioridade] ?? ''}`}>{t.prioridade}</span>
                          {t.atribuido_nome && (
                            <span className="text-[10px] text-accent-600 flex items-center gap-0.5"><User size={9} />{t.atribuido_nome}</span>
                          )}
                          {t.prazo && (
                            <span className={`text-[10px] ${new Date(t.prazo) < new Date() ? 'text-rose-600 font-semibold' : 'text-brand-400'}`}>
                              {new Date(t.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {col.length === 0 && (
                      <p className="text-[11px] text-brand-300 text-center py-4">Vazio</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal Nova Tarefa ──────────────────────────────────── */}
      {modalAberto && (
        <>
          <div className="fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm" onClick={() => setModalAberto(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-brand-100">
                <h2 className="font-semibold text-brand-900 flex items-center gap-2"><Plus size={16} className="text-accent-600" />Nova Tarefa</h2>
                <button onClick={() => setModalAberto(false)} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-400"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="input-label">Título *</label>
                  <input
                    value={nova.titulo}
                    onChange={e => setNova(p => ({ ...p, titulo: e.target.value }))}
                    placeholder="O que precisa ser feito?"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="input-label">Descrição</label>
                  <textarea
                    rows={3}
                    value={nova.descricao}
                    onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))}
                    placeholder="Detalhes, instruções, contexto..."
                    className="input w-full resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Setor</label>
                    <select value={nova.setor} onChange={e => setNova(p => ({ ...p, setor: e.target.value }))} className="input w-full">
                      <option value="">— Geral —</option>
                      {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Prioridade</label>
                    <select value={nova.prioridade} onChange={e => setNova(p => ({ ...p, prioridade: e.target.value }))} className="input w-full">
                      {PRIO_LIST.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Prazo</label>
                    <input type="date" value={nova.prazo} onChange={e => setNova(p => ({ ...p, prazo: e.target.value }))} className="input w-full" />
                  </div>
                  <div>
                    <label className="input-label">Atribuir para</label>
                    <select value={nova.atribuido_para} onChange={e => setNova(p => ({ ...p, atribuido_para: e.target.value }))} className="input w-full">
                      <option value="">— Sem atribuição —</option>
                      {equipe.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="input-label">Cliente (opcional)</label>
                  <select value={nova.cliente_id} onChange={e => setNova(p => ({ ...p, cliente_id: e.target.value }))} className="input w-full">
                    <option value="">— Sem cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={nova.privado} onChange={e => setNova(p => ({ ...p, privado: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-brand-700">Tarefa privada (visível apenas para admin)</span>
                </label>
              </div>
              <div className="p-5 border-t border-brand-100 flex justify-end gap-2">
                <button onClick={() => setModalAberto(false)} className="text-sm px-4 py-2 rounded-xl border border-brand-200 text-brand-600 hover:bg-brand-50">Cancelar</button>
                <button
                  onClick={criarTarefa}
                  disabled={salvando || !nova.titulo.trim()}
                  className="text-sm px-5 py-2 rounded-xl bg-accent-600 text-white hover:bg-accent-700 disabled:opacity-50 font-medium"
                >
                  {salvando ? 'Salvando...' : 'Criar Tarefa'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
