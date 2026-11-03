'use client'

import { useEffect, useState, use } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import type { Tarefa, Setor } from '@/types/database.types'
import Link from 'next/link'
import {
  Users, BarChart2, Building2, Scale, DollarSign,
  Clock, CheckCircle2, AlertTriangle, Loader2, FileText,
} from 'lucide-react'

// ─── Mapa de departamentos ────────────────────────────────────

type DeptSlug = 'pessoal' | 'fiscal' | 'contabil' | 'societario' | 'financeiro'

interface DeptConfig {
  label: string
  icon: React.ElementType
  setores: Setor[]
  cor: string
  desc: string
}

const DEPT: Record<DeptSlug, DeptConfig> = {
  pessoal:    { label: 'Depto. Pessoal',    icon: Users,     setores: ['RH'],                                  cor: 'text-blue-600',    desc: 'Admissões, demissões, férias e folha de pagamento' },
  fiscal:     { label: 'Depto. Fiscal',     icon: BarChart2, setores: ['Fiscal'],                             cor: 'text-amber-600',   desc: 'Apuração de impostos, DAS, DARF e obrigações acessórias' },
  contabil:   { label: 'Depto. Contábil',   icon: FileText,  setores: ['Gerencial', 'Administrativo'],        cor: 'text-emerald-600', desc: 'Balancetes, balanços, ECF e escrituração contábil' },
  societario: { label: 'Depto. Societário', icon: Scale,     setores: ['Legalização'],                        cor: 'text-purple-600',  desc: 'Abertura, alterações, alvarás e encerramento de empresas' },
  financeiro: { label: 'Financeiro Interno',icon: DollarSign,setores: ['Gerencial', 'Administrativo'],        cor: 'text-rose-600',    desc: 'Controle de receitas, despesas, honorários e inadimplência' },
}

const STATUS_COLOR: Record<string, string> = {
  'Pendente':     'bg-warning-100 text-warning-600',
  'Em andamento': 'bg-blue-100 text-blue-700',
  'Aguardando':   'bg-brand-100 text-brand-600',
  'Concluída':    'bg-accent-100 text-accent-700',
  'Cancelada':    'bg-danger-100 text-danger-600',
}

interface TarefaRow extends Tarefa {
  clientes?: { nome: string } | null
}

// ─── Componente ───────────────────────────────────────────────

export default function DepartamentoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const cfg = DEPT[slug as DeptSlug]

  const [tarefas, setTarefas]     = useState<TarefaRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [filtroStatus, setFiltro] = useState('')
  const [hoje]                    = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!cfg) return
    async function carregar() {
      setLoading(true)
      try {
        let q = (supabase.from('tarefas') as any)
          .select('*, clientes(nome)')
          .in('setor', cfg.setores)
          .order('prazo', { ascending: true, nullsFirst: false })

        if (filtroStatus) q = q.eq('status', filtroStatus)

        const { data } = await q
        setTarefas((data ?? []) as TarefaRow[])
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [cfg, filtroStatus])

  if (!cfg) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24 text-brand-400 text-sm">
          Departamento não encontrado.
        </div>
      </Shell>
    )
  }

  const Icon = cfg.icon
  const total     = tarefas.length
  const pendentes = tarefas.filter(t => t.status === 'Pendente').length
  const emAndamento = tarefas.filter(t => t.status === 'Em andamento').length
  const atrasadas = tarefas.filter(t => t.prazo && t.prazo < hoje && t.status !== 'Concluída' && t.status !== 'Cancelada').length
  const concluidas = tarefas.filter(t => t.status === 'Concluída').length

  return (
    <Shell>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center ${cfg.cor}`}>
            <Icon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-900">{cfg.label}</h1>
            <p className="text-sm text-brand-500 mt-0.5">{cfg.desc}</p>
          </div>
        </div>

        {/* KPI mini cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total ativo',   value: total,      icon: FileText,      cls: 'text-brand-600',   bg: 'bg-brand-50' },
            { label: 'Em andamento',  value: emAndamento, icon: Clock,        cls: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: 'Atrasadas',     value: atrasadas,  icon: AlertTriangle, cls: 'text-danger-600',  bg: 'bg-danger-50' },
            { label: 'Concluídas',    value: concluidas, icon: CheckCircle2,  cls: 'text-accent-700',  bg: 'bg-accent-50' },
          ].map(({ label, value, icon: KIcon, cls, bg }) => (
            <div key={label} className="bg-white border border-brand-100 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <KIcon size={16} className={cls} />
              </div>
              <div>
                <p className="text-xl font-bold text-brand-900">{value}</p>
                <p className="text-xs text-brand-400 leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtro de status */}
        <div className="flex items-center gap-2 flex-wrap">
          {['', 'Pendente', 'Em andamento', 'Aguardando', 'Concluída'].map(s => (
            <button
              key={s}
              onClick={() => setFiltro(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                filtroStatus === s
                  ? 'bg-brand-900 text-white border-brand-900'
                  : 'border-brand-200 text-brand-600 hover:bg-brand-50'
              }`}
            >
              {s || 'Todas'}
            </button>
          ))}
        </div>

        {/* Tabela de tarefas */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-700">
              Tarefas — {cfg.setores.join(', ')}
            </h2>
            <span className="text-xs text-brand-400">{total} tarefa{total !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-brand-300" />
            </div>
          ) : tarefas.length === 0 ? (
            <div className="py-12 text-center text-brand-300 text-sm">
              Nenhuma tarefa encontrada para este departamento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-50 text-xs text-brand-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Tarefa</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Empresa</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Prazo</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50">
                  {tarefas.map(t => {
                    const atrasada = t.prazo && t.prazo < hoje && t.status !== 'Concluída' && t.status !== 'Cancelada'
                    return (
                      <tr key={t.id} className={`hover:bg-brand-50 ${atrasada ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-900 line-clamp-1">{t.titulo}</p>
                          <p className="text-xs text-brand-400">{t.prioridade}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-brand-500">
                          {t.clientes?.nome ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status] ?? 'bg-brand-100 text-brand-600'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className={`px-4 py-3 hidden sm:table-cell text-xs ${atrasada ? 'text-danger-600 font-semibold' : 'text-brand-500'}`}>
                          {t.prazo ? new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                          {atrasada && ' ⚠'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-brand-500">
                          {t.responsavel ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Atalhos para módulos relacionados */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {slug === 'pessoal' && <>
            <DeptLink href="/rotinas?setor=RH"  label="Rotinas de RH"    icon={Clock} />
            <DeptLink href="/officeboy"          label="Entregas"         icon={Building2} />
          </>}
          {slug === 'fiscal' && <>
            <DeptLink href="/rotinas?setor=Fiscal" label="Rotinas Fiscais"  icon={Clock} />
            <DeptLink href="/clientes"             label="Clientes"         icon={Building2} />
          </>}
          {slug === 'contabil' && <>
            <DeptLink href="/gerencial"          label="Gerencial"        icon={BarChart2} />
            <DeptLink href="/clientes"           label="Clientes"         icon={Building2} />
          </>}
          {slug === 'societario' && <>
            <DeptLink href="/processos"          label="Legalização"      icon={Scale} />
          </>}
          {slug === 'financeiro' && <>
            <DeptLink href="/gerencial"          label="Painel Gerencial" icon={DollarSign} />
            <DeptLink href="/contratos"          label="Contratos"        icon={FileText} />
          </>}
        </div>
      </div>
    </Shell>
  )
}

function DeptLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  return (
    <Link href={href} className="flex items-center gap-3 bg-white border border-brand-100 rounded-xl px-4 py-3 hover:bg-brand-50 transition group">
      <Icon size={16} className="text-brand-400 group-hover:text-brand-700 transition" />
      <span className="text-sm font-medium text-brand-700">{label}</span>
    </Link>
  )
}
