'use client'

import { useEffect, useState } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  CheckSquare, AlertTriangle, Clock, CheckCircle2, Users, FileText,
  Repeat, Lock, TrendingUp, ArrowRightLeft, BarChart2, Activity,
} from 'lucide-react'
import type { Setor, TaskEvento } from '@/types/database.types'

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

// ─── Constantes ───────────────────────────────────────────────

const QUICK_LINKS: QuickLink[] = [
  { href: '/tarefas',   label: 'Tarefas',        desc: 'Criar tarefa em qualquer setor',  icon: CheckSquare },
  { href: '/clientes',  label: 'Clientes',        desc: 'Gerenciar empresas e contratos',  icon: Users },
  { href: '/processos', label: 'Legalização',     desc: 'Processos e prazos',              icon: FileText },
  { href: '/rotinas',   label: 'Rotinas',         desc: 'Pendências recorrentes',          icon: Repeat },
  { href: '/cofre',     label: 'Cofre de Senhas', desc: 'Credenciais criptografadas E2EE', icon: Lock },
]

const SETORES_PROD: Setor[] = ['Legalização', 'Fiscal', 'RH', 'Office Boy', 'Gerencial', 'Administrativo']

// ─── Componente ───────────────────────────────────────────────

export default function DashboardPage() {
  const [isAdmin, setIsAdmin]     = useState(false)
  const [kpi, setKpi]             = useState<KpiAdmin | null>(null)
  const [feed, setFeed]           = useState<FeedEvento[]>([])
  const [loadingKpi, setLoadingKpi] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await (supabase.from('perfis_usuarios') as any)
        .select('role')
        .eq('id', user.id)
        .single()

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

        {/* Status do sistema */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </section>
      </div>
    </Shell>
  )
}
