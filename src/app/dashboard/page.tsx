'use client'

import { useEffect, useState } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  CheckSquare, AlertTriangle, Clock, CheckCircle2, Users, FileText,
  Repeat, Lock, TrendingUp, ArrowRightLeft, BarChart2, Activity,
  MessageSquare, Plus, X, Send, Loader2, Star, Award,
} from 'lucide-react'
import type { Setor, TaskEvento } from '@/types/database.types'
import SmartCalendarWidget from '@/components/dashboard/SmartCalendarWidget'
import type { CalendarEvent } from '@/components/dashboard/SmartCalendarWidget'
import AnalyticsCharts, { montarStatusData, montarRegimeData } from '@/components/dashboard/AnalyticsCharts'

// ─── Tipos ────────────────────────────────────────────────────

interface StatCard {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  bg: string
}

interface QuickLink {
  href: string
  label: string
  desc: string
  icon: React.ElementType
}

interface KpiAdmin {
  totalAtivas: number
  emAtraso: number
  concluidasHoje: number
  urgentes: number
  porSetor: Array<{ setor: string; total: number; atrasadas: number }>
}

interface FeedEvento extends TaskEvento {
  tarefa_titulo?: string
}

interface Recado {
  id: string
  titulo: string
  corpo: string
  criado_em: string
  expira_em: string | null
}

interface DevolutivaSetor {
  setor: string
  total: number
  noPrazo: number
  atrasadas: number
  pct: number
}

interface Devolutiva {
  totalConcluidas: number
  noPrazo: number
  atrasadas: number
  pct: number
  porSetor: DevolutivaSetor[]
  periodo: string // 'DD/MM a DD/MM'
}

// ─── Constantes ───────────────────────────────────────────────

const QUICK_LINKS: QuickLink[] = [
  { href: '/tarefas',   label: 'Tarefas',        desc: 'Criar tarefa em qualquer setor',  icon: CheckSquare },
  { href: '/clientes',  label: 'Clientes',        desc: 'Gerenciar empresas e contratos',  icon: Users },
  { href: '/processos', label: 'Legalização',     desc: 'Processos e prazos',              icon: FileText },
  { href: '/rotinas',   label: 'Rotinas',         desc: 'Pendências recorrentes',          icon: Repeat },
  { href: '/cofre',     label: 'Cofre de Senhas', desc: 'Credenciais criptografadas E2EE', icon: Lock },
]

const SETORES_PROD: Setor[] = ['Legalização', 'Fiscal', 'RH', 'Office Boy', 'Gerencial', 'Administrativo']

// ─── Ranking de Colaboradores ────────────────────────────────

interface RankItem {
  nome: string
  avatar_url: string | null
  concluidas: number
  emDia: number
  atrasadas: number
  score: number
}

const MEDALHA = ['🥇', '🥈', '🥉']
const COR_BARRA = ['bg-yellow-400', 'bg-gray-400', 'bg-amber-600']

function RankingColaboradores() {
  const [ranking, setRanking] = useState<RankItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const inicio = new Date()
      inicio.setDate(1)
      const inicioStr = inicio.toISOString().split('T')[0]

      const { data: tarefas } = await (supabase.from('tarefas') as any)
        .select('responsavel, status, prazo, updated_at')
        .eq('status', 'Concluída')
        .gte('updated_at', inicioStr + 'T00:00:00')

      const { data: perfis } = await (supabase.from('perfis_usuarios') as any)
        .select('nome, avatar_url')
        .eq('ativo', true)
        .neq('role', 'admin')

      const mapa: Record<string, RankItem> = {}
      for (const p of (perfis ?? []) as Array<{ nome: string; avatar_url: string | null }>) {
        if (!p.nome) continue
        mapa[p.nome] = { nome: p.nome, avatar_url: p.avatar_url, concluidas: 0, emDia: 0, atrasadas: 0, score: 0 }
      }

      for (const t of (tarefas ?? []) as Array<{ responsavel: string | null; prazo: string | null; updated_at: string }>) {
        if (!t.responsavel || !mapa[t.responsavel]) continue
        const item = mapa[t.responsavel]
        item.concluidas++
        const prazoOk = !t.prazo || new Date(t.updated_at) <= new Date(t.prazo + 'T23:59:59')
        if (prazoOk) item.emDia++
        else          item.atrasadas++
      }

      const lista = Object.values(mapa)
        .map(r => ({ ...r, score: r.emDia * 3 + r.concluidas - r.atrasadas * 2 }))
        .filter(r => r.concluidas > 0)
        .sort((a, b) => b.score - a.score)

      setRanking(lista)
      setLoading(false)
    })()
  }, [])

  if (loading || ranking.length === 0) return null

  const max = Math.max(...ranking.map(r => r.score), 1)

  return (
    <section>
      <h2 className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">
        🏆 Ranking do Mês
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ranking.map((r, i) => (
          <div key={r.nome} className={`card flex items-center gap-3 ${i === 0 ? 'ring-2 ring-yellow-300' : ''}`}>
            {/* Posição */}
            <div className="text-2xl flex-shrink-0 w-8 text-center">
              {MEDALHA[i] ?? `#${i + 1}`}
            </div>
            {/* Avatar */}
            <div className="flex-shrink-0">
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-sm font-bold text-white">
                  {r.nome.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-800 truncate">{r.nome}</p>
              <div className="flex items-center gap-2 text-xs text-brand-500 mt-0.5">
                <span className="text-accent-700 font-medium">{r.concluidas} concluídas</span>
                {r.atrasadas > 0 && <span className="text-red-500">{r.atrasadas} atrasada{r.atrasadas > 1 ? 's' : ''}</span>}
              </div>
              {/* Barra de progresso */}
              <div className="mt-1.5 h-1.5 bg-brand-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${COR_BARRA[i] ?? 'bg-accent-500'}`}
                  style={{ width: `${Math.max(5, (r.score / max) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Componente principal ─────────────────────────────────────

export default function DashboardPage() {
  const [isAdmin, setIsAdmin]         = useState(false)
  const [kpi, setKpi]                 = useState<KpiAdmin | null>(null)
  const [feed, setFeed]               = useState<FeedEvento[]>([])
  const [loadingKpi, setLoadingKpi]   = useState(false)
  const [calEventos, setCalEventos]   = useState<CalendarEvent[]>([])
  const [statusData, setStatusData]   = useState<ReturnType<typeof montarStatusData>>([])
  const [regimeData, setRegimeData]   = useState<ReturnType<typeof montarRegimeData>>([])
  const mesAtual = new Date().getMonth() + 1
  const anoAtual = new Date().getFullYear()

  // Recados e devolutiva (todos os usuários)
  const [recados, setRecados]             = useState<Recado[]>([])
  const [devolutiva, setDevolutiva]       = useState<Devolutiva | null>(null)
  const [showNovoRecado, setShowNovoRecado] = useState(false)
  const [novoRecado, setNovoRecado]       = useState({ titulo: '', corpo: '' })
  const [salvandoRecado, setSalvandoRecado] = useState(false)
  const [userId, setUserId]               = useState('')

  useEffect(() => {
    async function carregarRecados() {
      const hoje = new Date().toISOString()
      const { data } = await (supabase.from('recados') as any)
        .select('id, titulo, corpo, criado_em, expira_em')
        .or(`expira_em.is.null,expira_em.gt.${hoje}`)
        .order('criado_em', { ascending: false })
        .limit(10)
      setRecados((data ?? []) as Recado[])
    }

    async function carregarDevolutiva() {
      const hoje = new Date()
      const seteDiasAtras = new Date(hoje)
      seteDiasAtras.setDate(hoje.getDate() - 7)
      const inicio = seteDiasAtras.toISOString().split('T')[0]
      const fim    = hoje.toISOString().split('T')[0]

      const { data: concluidas } = await (supabase.from('tarefas') as any)
        .select('id, prazo, setor, updated_at')
        .eq('status', 'Concluída')
        .gte('updated_at', inicio + 'T00:00:00')
        .lte('updated_at', fim + 'T23:59:59')

      const lista = (concluidas ?? []) as Array<{
        id: string; prazo: string | null; setor: string | null; updated_at: string
      }>

      const noPrazo   = lista.filter(t => !t.prazo || t.updated_at.split('T')[0] <= t.prazo).length
      const atrasadas = lista.length - noPrazo

      const porSetor = SETORES_PROD.map(setor => {
        const deste = lista.filter(t => t.setor === setor)
        const setorNoPrazo = deste.filter(t => !t.prazo || t.updated_at.split('T')[0] <= t.prazo).length
        return {
          setor,
          total:    deste.length,
          noPrazo:  setorNoPrazo,
          atrasadas: deste.length - setorNoPrazo,
          pct:      deste.length > 0 ? Math.round((setorNoPrazo / deste.length) * 100) : 100,
        }
      }).filter(s => s.total > 0)

      const fmtData = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      setDevolutiva({
        totalConcluidas: lista.length,
        noPrazo,
        atrasadas,
        pct: lista.length > 0 ? Math.round((noPrazo / lista.length) * 100) : 100,
        porSetor,
        periodo: `${fmtData(seteDiasAtras)} a ${fmtData(hoje)}`,
      })
    }

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: p } = await (supabase.from('perfis_usuarios') as any)
        .select('role')
        .eq('id', user.id)
        .single()

      // Carrega recados e devolutiva para todos
      carregarRecados()
      carregarDevolutiva()

      if (p?.role !== 'admin') return
      setIsAdmin(true)
      setLoadingKpi(true)

      try {
        const hoje = new Date().toISOString().split('T')[0]

        // Tarefas ativas (não concluídas/canceladas)
        const { data: ativas } = await (supabase.from('tarefas') as any)
          .select('id, status, prioridade, prazo, setor, updated_at')
          .not('status', 'in', '("Concluída","Cancelada")')

        const lista = (ativas ?? []) as Array<{
          id: string; status: string; prioridade: string;
          prazo: string | null; setor: string | null; updated_at: string
        }>

        const emAtraso = lista.filter(t => t.prazo && t.prazo < hoje).length
        const urgentes = lista.filter(t => t.prioridade === 'Urgente').length

        // Concluídas hoje
        const { count: concluidasHoje } = await (supabase.from('tarefas') as any)
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Concluída')
          .gte('updated_at', hoje)

        // Por setor
        const porSetor = SETORES_PROD.map(setor => {
          const deste = lista.filter(t => t.setor === setor)
          return {
            setor,
            total: deste.length,
            atrasadas: deste.filter(t => t.prazo && t.prazo < hoje).length,
          }
        }).filter(s => s.total > 0)

        setKpi({
          totalAtivas: lista.length,
          emAtraso,
          concluidasHoje: concluidasHoje ?? 0,
          urgentes,
          porSetor,
        })

        // Dados para gráficos de rosca
        const statusContagens: Record<string, number> = {}
        lista.forEach(t => { statusContagens[t.status] = (statusContagens[t.status] ?? 0) + 1 })
        setStatusData(montarStatusData(statusContagens))

        const { data: clientes } = await (supabase.from('clientes') as any).select('regime')
        const regimeContagens: Record<string, number> = {}
        ;(clientes ?? []).forEach((c: { regime: string | null }) => {
          if (c.regime) regimeContagens[c.regime] = (regimeContagens[c.regime] ?? 0) + 1
        })
        setRegimeData(montarRegimeData(regimeContagens))

        // Eventos de calendário: prazos ativos como "prazo"
        const evts: CalendarEvent[] = lista
          .filter(t => t.prazo)
          .reduce<CalendarEvent[]>((acc, t) => {
            const d = new Date(t.prazo! + 'T00:00:00')
            if (d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual) {
              acc.push({ dia: d.getDate(), titulo: 'Tarefa com prazo', tipo: 'prazo' })
            }
            return acc
          }, [])
        setCalEventos(evts)

        // Feed de transferências (task_eventos tipo situacao/progresso recentes)
        const { data: eventos } = await (supabase.from('task_eventos') as any)
          .select('id, tarefa_id, tipo, titulo, situacao, descricao, autor, created_at')
          .in('tipo', ['situacao', 'progresso', 'conclusao'])
          .order('created_at', { ascending: false })
          .limit(15)

        if (eventos?.length) {
          // Busca títulos das tarefas referenciadas
          const tarefaIds = [...new Set((eventos as TaskEvento[]).map(e => e.tarefa_id))]
          const { data: tarefas } = await (supabase.from('tarefas') as any)
            .select('id, titulo')
            .in('id', tarefaIds)

          const tMap = new Map<string, string>((tarefas ?? []).map((t: { id: string; titulo: string }) => [t.id, t.titulo]))
          setFeed((eventos as TaskEvento[]).map(e => ({ ...e, tarefa_titulo: tMap.get(e.tarefa_id) ?? '—' })))
        }
      } finally {
        setLoadingKpi(false)
      }
    }
    init()
  }, [])

  const STATS_ADMIN: StatCard[] = kpi ? [
    { label: 'Tarefas Ativas',    value: kpi.totalAtivas,    icon: Clock,         color: 'text-blue-600',    bg: 'bg-blue-100' },
    { label: 'Em Atraso',         value: kpi.emAtraso,       icon: AlertTriangle, color: 'text-danger-600',  bg: 'bg-danger-100' },
    { label: 'Concluídas Hoje',   value: kpi.concluidasHoje, icon: CheckCircle2,  color: 'text-accent-700',  bg: 'bg-accent-100' },
    { label: 'Urgentes',          value: kpi.urgentes,       icon: TrendingUp,    color: 'text-warning-600', bg: 'bg-warning-100' },
  ] : [
    { label: 'Tarefas Pendentes', value: '—', icon: Clock,         color: 'text-warning-600',  bg: 'bg-warning-100' },
    { label: 'Em Andamento',      value: '—', icon: TrendingUp,    color: 'text-blue-600',     bg: 'bg-blue-100' },
    { label: 'Concluídas Hoje',   value: '—', icon: CheckCircle2,  color: 'text-accent-700',   bg: 'bg-accent-100' },
    { label: 'Atenção / Urgentes',value: '—', icon: AlertTriangle, color: 'text-danger-600',   bg: 'bg-danger-100' },
  ]

  async function salvarRecado() {
    if (!novoRecado.titulo.trim() || !novoRecado.corpo.trim()) return
    setSalvandoRecado(true)
    try {
      const { error } = await (supabase.from('recados') as any).insert({
        titulo: novoRecado.titulo.trim(),
        corpo:  novoRecado.corpo.trim(),
        criado_por: userId || null,
        destinatario_id: null, // broadcast global
      })
      if (error) throw error
      setNovoRecado({ titulo: '', corpo: '' })
      setShowNovoRecado(false)
      // Recarrega
      const { data } = await (supabase.from('recados') as any)
        .select('id, titulo, corpo, criado_em, expira_em')
        .order('criado_em', { ascending: false }).limit(10)
      setRecados((data ?? []) as Recado[])
    } catch (e) {
      console.error(e)
    } finally {
      setSalvandoRecado(false)
    }
  }

  async function removerRecado(id: string) {
    await (supabase.from('recados') as any).delete().eq('id', id)
    setRecados(prev => prev.filter(r => r.id !== id))
  }

  function tipoLabel(tipo: string) {
    if (tipo === 'situacao')   return { label: 'Atualização',   cls: 'bg-blue-100 text-blue-700' }
    if (tipo === 'progresso')  return { label: 'Progresso',     cls: 'bg-accent-100 text-accent-700' }
    if (tipo === 'conclusao')  return { label: 'Conclusão',     cls: 'bg-emerald-100 text-emerald-700' }
    return { label: tipo, cls: 'bg-brand-100 text-brand-600' }
  }

  return (
    <Shell userInitials="A" userEmail="admin@nascente.com.br">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Cabeçalho */}
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Dashboard</h1>
          <p className="text-brand-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS_ADMIN.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="card flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className={color} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-brand-900">{value}</p>
                <p className="text-xs text-brand-500 leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Painel admin */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Tarefas em atraso por setor */}
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-brand-500" />
                <h2 className="text-sm font-semibold text-brand-700">Produtividade por Setor</h2>
              </div>

              {loadingKpi ? (
                <div className="py-6 text-center text-brand-300 text-xs">Carregando…</div>
              ) : !kpi?.porSetor.length ? (
                <div className="py-6 text-center text-brand-300 text-xs">Sem tarefas ativas.</div>
              ) : (
                <div className="space-y-2">
                  {kpi.porSetor.map(s => {
                    const pct = s.atrasadas > 0 ? Math.round((s.atrasadas / s.total) * 100) : 0
                    return (
                      <div key={s.setor}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-brand-700 font-medium">{s.setor}</span>
                          <span className="text-brand-400">
                            {s.total} tarefa{s.total !== 1 ? 's' : ''}
                            {s.atrasadas > 0 && (
                              <span className="text-danger-600 ml-1">· {s.atrasadas} atrasada{s.atrasadas !== 1 ? 's' : ''}</span>
                            )}
                          </span>
                        </div>
                        <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct > 50 ? 'bg-danger-500' : pct > 20 ? 'bg-warning-500' : 'bg-accent-500'}`}
                            style={{ width: `${100 - pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Feed de transferências/eventos */}
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-brand-500" />
                <h2 className="text-sm font-semibold text-brand-700">Feed de Atualizações</h2>
              </div>

              {loadingKpi ? (
                <div className="py-6 text-center text-brand-300 text-xs">Carregando…</div>
              ) : !feed.length ? (
                <div className="py-6 text-center text-brand-300 text-xs">Nenhuma atualização recente.</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {feed.map(ev => {
                    const { label, cls } = tipoLabel(ev.tipo)
                    return (
                      <div key={ev.id} className="flex gap-2 items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          <Activity size={12} className="text-brand-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-brand-700 line-clamp-1 font-medium">
                            {ev.tarefa_titulo}
                          </p>
                          <p className="text-xs text-brand-400 line-clamp-1">
                            {ev.situacao || ev.descricao || ev.titulo || '—'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
                            {ev.autor && <span className="text-[10px] text-brand-400">{ev.autor}</span>}
                            <span className="text-[10px] text-brand-300 ml-auto">
                              {new Date(ev.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gráficos colorimétricos + Calendário inteligente */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <AnalyticsCharts
                tarefasPorStatus={statusData}
                faturamentoPorRegime={regimeData}
              />
            </div>
            <div>
              <SmartCalendarWidget
                mes={mesAtual}
                ano={anoAtual}
                eventos={calEventos}
              />
            </div>
          </div>
        )}

        {/* ─── Devolutiva Semanal + Quadro de Recados ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Devolutiva Semanal de Desempenho */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-purple-600" />
              <h2 className="text-sm font-semibold text-brand-700">Devolutiva Semanal de Desempenho</h2>
              {devolutiva && (
                <span className="ml-auto text-[10px] text-brand-400">{devolutiva.periodo}</span>
              )}
            </div>

            {!devolutiva ? (
              <div className="py-6 text-center text-brand-300 text-xs">Carregando…</div>
            ) : devolutiva.totalConcluidas === 0 ? (
              <div className="py-4 text-center space-y-1">
                <p className="text-3xl">😴</p>
                <p className="text-sm text-brand-600 font-medium">Nenhuma tarefa concluída esta semana.</p>
                <p className="text-xs text-brand-400">Foco total — vamos fechar essas pendências!</p>
              </div>
            ) : (
              <>
                {/* KPI principal */}
                <div className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-700">{devolutiva.pct}%</p>
                    <p className="text-[10px] text-purple-500 font-medium uppercase tracking-wide">No Prazo</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-xs text-brand-600">
                      <span>✅ {devolutiva.noPrazo} no prazo</span>
                      <span>⚠️ {devolutiva.atrasadas} atrasadas</span>
                    </div>
                    <div className="h-2 bg-brand-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${devolutiva.pct >= 80 ? 'bg-emerald-500' : devolutiva.pct >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`}
                        style={{ width: `${devolutiva.pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-brand-400">
                      {devolutiva.totalConcluidas} tarefas concluídas na semana
                    </p>
                  </div>
                </div>

                {/* Mensagem motivacional */}
                <div className={`text-xs px-3 py-2 rounded-lg border ${
                  devolutiva.pct >= 85
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : devolutiva.pct >= 65
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-warning-50 border-warning-200 text-warning-700'
                }`}>
                  <Star size={11} className="inline mr-1" />
                  {devolutiva.pct >= 85
                    ? 'Excelente semana! Alta taxa de cumprimento de prazos. Continue assim!'
                    : devolutiva.pct >= 65
                    ? 'Boa semana! Há espaço para melhorar o cumprimento de prazos.'
                    : 'Atenção: muitas tarefas atrasadas esta semana. Revise a distribuição de carga.'}
                </div>

                {/* Por setor */}
                {devolutiva.porSetor.length > 0 && isAdmin && (
                  <div className="space-y-1.5">
                    {devolutiva.porSetor.map(s => (
                      <div key={s.setor}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-brand-700">{s.setor}</span>
                          <span className="text-brand-400">{s.noPrazo}/{s.total} · {s.pct}%</span>
                        </div>
                        <div className="h-1.5 bg-brand-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${s.pct >= 80 ? 'bg-emerald-500' : s.pct >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`}
                            style={{ width: `${s.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quadro de Recados */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-500" />
              <h2 className="text-sm font-semibold text-brand-700">Quadro de Recados</h2>
              {isAdmin && (
                <button
                  onClick={() => setShowNovoRecado(v => !v)}
                  className="ml-auto flex items-center gap-1 text-xs text-accent-700 hover:text-accent-900 font-medium"
                >
                  <Plus size={12} /> Novo
                </button>
              )}
            </div>

            {/* Form novo recado (admin) */}
            {showNovoRecado && isAdmin && (
              <div className="space-y-2 bg-brand-50 rounded-xl p-3">
                <input
                  className="input text-sm"
                  placeholder="Título do recado"
                  value={novoRecado.titulo}
                  onChange={e => setNovoRecado(r => ({ ...r, titulo: e.target.value }))}
                />
                <textarea
                  className="input text-sm resize-none"
                  rows={2}
                  placeholder="Mensagem para a equipe..."
                  value={novoRecado.corpo}
                  onChange={e => setNovoRecado(r => ({ ...r, corpo: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button
                    onClick={salvarRecado}
                    disabled={salvandoRecado}
                    className="btn-primary text-xs py-1.5 flex items-center gap-1"
                  >
                    {salvandoRecado ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Publicar
                  </button>
                  <button
                    onClick={() => setShowNovoRecado(false)}
                    className="btn-secondary text-xs py-1.5"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {recados.length === 0 ? (
              <div className="py-6 text-center text-brand-300 text-xs">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                Nenhum recado no momento.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {recados.map(r => (
                  <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-amber-800 leading-snug">{r.titulo}</p>
                      {isAdmin && (
                        <button
                          onClick={() => removerRecado(r.id)}
                          className="flex-shrink-0 text-amber-400 hover:text-red-500 mt-0.5"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">{r.corpo}</p>
                    <p className="text-[10px] text-amber-500 mt-1.5">
                      {new Date(r.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {r.expira_em && ` · expira ${new Date(r.expira_em).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ranking de Desempenho — todos os usuários */}
        <RankingColaboradores />

        {/* Atalhos rápidos */}
        <section>
          <h2 className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">Acesso Rápido</h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {QUICK_LINKS.map(({ href, label, desc, icon: Icon }) => (
              <a key={href} href={href} className="card-hover flex flex-col gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center group-hover:bg-brand-900 transition-colors">
                  <Icon size={18} className="text-brand-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-900">{label}</p>
                  <p className="text-xs text-brand-500 mt-0.5">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Status do sistema — visível apenas para admin */}
        {isAdmin && <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-brand-700 mb-3">Status do Sistema</h2>
            <ul className="space-y-2">
              {[
                { label: 'Banco de dados (Supabase)', ok: true },
                { label: 'Autenticação',              ok: true },
                { label: 'Storage / Anexos',          ok: true },
                { label: 'Cofre E2EE',                ok: true },
              ].map(({ label, ok }) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-accent-500' : 'bg-danger-500'}`} />
                  <span className="text-brand-600">{label}</span>
                  <span className={`ml-auto text-xs font-medium ${ok ? 'text-accent-700' : 'text-danger-600'}`}>
                    {ok ? 'Operacional' : 'Falha'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-brand-700 mb-3">Módulos Disponíveis</h2>
            <ul className="space-y-1.5 text-sm text-brand-600">
              {[
                'Tarefas multi-setor',
                'Legalização de empresas',
                'Obrigações mensais',
                'Controle gerencial',
                'Rotinas recorrentes',
                'Parcelamentos fiscais',
                'Office Boy / Entregas',
                'Cofre de senhas E2EE',
                'Ordens de serviço',
                'Contratos',
              ].map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-accent-500 flex-shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </section>}
      </div>
    </Shell>
  )
}
