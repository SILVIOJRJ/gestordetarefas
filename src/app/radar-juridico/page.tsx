'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  analisarClientes,
  ALERTAS_JURIDICOS,
  type AlertaJuridico,
  type TipoNorma,
} from '@/services/radarJuridico'
import {
  Scale, AlertTriangle, RefreshCw, Loader2, ChevronDown, ChevronUp,
  Calendar, Tag, Building2, Lightbulb, Search, Filter,
  Thermometer, Calculator, TrendingUp,
} from 'lucide-react'

interface AlertaComClientes extends AlertaJuridico {
  clientesAfetados: Array<{ id: string; nome: string }>
}

interface Cliente {
  id: string
  nome: string
  regime: string | null
  cnae?: string | null
  municipio?: string | null
}

interface GerencialMensal {
  cliente_id: string
  folha_pagamento?: number | null
  receita_servicos?: number | null
  receita_vendas?: number | null
  receita_bruta?: number | null
  competencia?: string | null
}

interface FatorRAlerta {
  clienteId: string
  clienteNome: string
  fatorR: number
  folha: number
  receita: number
  nivel: 'ok' | 'atencao' | 'critico'
}

interface SubLimiteAlerta {
  clienteId: string
  clienteNome: string
  rbt12: number
  sublimite: number
  percentual: number
  tipo: 'sublimite_estadual' | 'sublimite_exclusao'
}

type Aba = 'alertas' | 'termometro' | 'simulador'

const TIPO_COLOR: Record<TipoNorma, string> = {
  'Lei Complementar':    'bg-purple-100 text-purple-700 border-purple-200',
  'Resolução CGSN':      'bg-blue-100 text-blue-700 border-blue-200',
  'Instrução Normativa': 'bg-sky-100 text-sky-700 border-sky-200',
  'Decisão STF':         'bg-red-100 text-red-700 border-red-200',
  'Decisão STJ':         'bg-orange-100 text-orange-700 border-orange-200',
  'Portaria':            'bg-teal-100 text-teal-700 border-teal-200',
  'Emenda Constitucional': 'bg-indigo-100 text-indigo-700 border-indigo-200',
}

const SUBLIMITES = [
  { valor: 3_600_000, rotulo: 'Sublimite ICMS/ISS (R$ 3,6M)' },
  { valor: 4_800_000, rotulo: 'Limite Exclusão Simples (R$ 4,8M)' },
]

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function calcEfetivoSimples(receita: number, servicosPct: number): number {
  // Tabela simplificada Simples Nacional Anexo III (prestação de serviços)
  if (receita <= 180_000) return 6.0
  if (receita <= 360_000) return 11.2
  if (receita <= 720_000) return 13.5
  if (receita <= 1_800_000) return 16.0
  if (receita <= 3_600_000) return 21.0
  return 33.0
}

export default function RadarJuridicoPage() {
  const [aba, setAba]                 = useState<Aba>('alertas')
  const [alertas, setAlertas]         = useState<AlertaComClientes[]>([])
  const [loading, setLoading]         = useState(true)
  const [busca, setBusca]             = useState('')
  const [filtroUrgente, setFiltroUrgente] = useState(false)
  const [filtroTipo, setFiltroTipo]   = useState<TipoNorma | ''>('')
  const [expandido, setExpandido]     = useState<string | null>(null)
  const [totalClientes, setTotalClientes] = useState(0)
  const [clientes, setClientes]       = useState<Cliente[]>([])

  // Termômetro
  const [fatorRAlerts, setFatorRAlerts]       = useState<FatorRAlerta[]>([])
  const [subLimiteAlerts, setSubLimiteAlerts] = useState<SubLimiteAlerta[]>([])
  const [loadingTerm, setLoadingTerm]         = useState(false)

  // Simulador
  const [simClienteId, setSimClienteId]       = useState('')
  const [simReceitaAnual, setSimReceitaAnual] = useState(500_000)
  const [simPctServicos, setSimPctServicos]   = useState(100)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await (supabase.from('clientes') as any)
        .select('id, nome, regime, cnae, municipio')
      const lista: Cliente[] = (data ?? []) as Cliente[]
      setClientes(lista)
      setTotalClientes(lista.length)

      // Alertas estáticos (base sempre disponível)
      const estaticos = analisarClientes(lista)

      // Tenta buscar alertas dinâmicos do Gemini
      try {
        const resp = await fetch('/api/radar-juridico')
        if (resp.ok) {
          const { alertas: dinamicos } = await resp.json() as { alertas: AlertaJuridico[] }
          // Combina: dinâmicos primeiro (mais recentes), depois estáticos que não se repetem
          const idsdinamicos = new Set(dinamicos.map((a: AlertaJuridico) => a.id))
          const estaticosUnicos = estaticos.filter(a => !idsdinamicos.has(a.id))
          const dinamicosComClientes = dinamicos.map((a: AlertaJuridico) => ({
            ...a,
            cnaesImpactados: a.cnaesImpactados ?? [],
            municipiosImpactados: a.municipiosImpactados ?? [],
            clientesAfetados: lista.filter(c =>
              a.regimesImpactados.includes('Todos') ||
              a.regimesImpactados.includes(c.regime as typeof a.regimesImpactados[number])
            ).map(c => ({ id: c.id, nome: c.nome })),
          }))
          setAlertas([...dinamicosComClientes, ...estaticosUnicos])
          return
        }
      } catch {
        // fallback para alertas estáticos
      }

      setAlertas(estaticos)
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarTermometro = useCallback(async () => {
    setLoadingTerm(true)
    try {
      const { data: gerencial } = await (supabase.from('gerencial_mensal') as any)
        .select('cliente_id, folha_pagamento, receita_servicos, receita_vendas, receita_bruta, competencia')
        .order('competencia', { ascending: false })
        .limit(500)

      const { data: clientesData } = await (supabase.from('clientes') as any)
        .select('id, nome, regime, receita_bruta_12')

      const clienteMap: Record<string, string> = {}
      const rbt12Map: Record<string, number> = {}
      ;(clientesData ?? []).forEach((c: { id: string; nome: string; receita_bruta_12?: number | null }) => {
        clienteMap[c.id] = c.nome
        if (c.receita_bruta_12 != null) rbt12Map[c.id] = c.receita_bruta_12
      })

      // Agrupa gerencial por cliente (pega o mais recente)
      const ultimoPorCliente: Record<string, GerencialMensal> = {}
      ;(gerencial ?? []).forEach((g: GerencialMensal) => {
        if (!ultimoPorCliente[g.cliente_id]) ultimoPorCliente[g.cliente_id] = g
      })

      // Fator R
      const frAlerts: FatorRAlerta[] = []
      Object.entries(ultimoPorCliente).forEach(([cid, g]) => {
        const folha = Number(g.folha_pagamento ?? 0)
        const receita = Number((g.receita_servicos ?? 0)) + Number((g.receita_vendas ?? 0)) || Number(g.receita_bruta ?? 0)
        if (receita <= 0) return
        const fatorR = folha / receita
        if (fatorR >= 0.22) {
          frAlerts.push({
            clienteId: cid,
            clienteNome: clienteMap[cid] ?? 'Cliente',
            fatorR,
            folha,
            receita,
            nivel: fatorR >= 0.28 ? 'critico' : 'atencao',
          })
        }
      })
      frAlerts.sort((a, b) => b.fatorR - a.fatorR)
      setFatorRAlerts(frAlerts)

      // Sublimites
      const slAlerts: SubLimiteAlerta[] = []
      ;(clientesData ?? []).forEach((c: { id: string; nome: string; regime?: string | null; receita_bruta_12?: number | null }) => {
        if (c.regime !== 'Simples Nacional') return
        const rbt12 = Number(c.receita_bruta_12 ?? 0)
        if (rbt12 <= 0) return
        SUBLIMITES.forEach(sl => {
          const pct = rbt12 / sl.valor
          if (pct >= 0.80) {
            slAlerts.push({
              clienteId: c.id,
              clienteNome: c.nome,
              rbt12,
              sublimite: sl.valor,
              percentual: pct,
              tipo: sl.valor === 3_600_000 ? 'sublimite_estadual' : 'sublimite_exclusao',
            })
          }
        })
      })
      slAlerts.sort((a, b) => b.percentual - a.percentual)
      setSubLimiteAlerts(slAlerts)
    } finally {
      setLoadingTerm(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    if (aba === 'termometro') carregarTermometro()
  }, [aba, carregarTermometro])

  const alertasFiltrados = alertas.filter(a => {
    if (filtroUrgente && !a.urgente) return false
    if (filtroTipo && a.tipo !== filtroTipo) return false
    if (busca) {
      const q = busca.toLowerCase()
      return (
        a.titulo.toLowerCase().includes(q) ||
        a.norma.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q)) ||
        a.clientesAfetados.some(c => c.nome.toLowerCase().includes(q))
      )
    }
    return true
  })

  const urgentesCount = alertas.filter(a => a.urgente).length
  const totalImpactos = alertas.reduce((s, a) => s + a.clientesAfetados.length, 0)
  const tiposUnicos   = [...new Set(ALERTAS_JURIDICOS.map(a => a.tipo))] as TipoNorma[]

  // Simulador
  const simCliente    = clientes.find(c => c.id === simClienteId)
  const simRecServ    = simReceitaAnual * (simPctServicos / 100)
  const simRecProd    = simReceitaAnual * ((100 - simPctServicos) / 100)
  const aliqSimples   = calcEfetivoSimples(simReceitaAnual, simPctServicos)
  const impostoSimples = simReceitaAnual * (aliqSimples / 100)
  // CBS + IBS estimado: CBS ~8,8% sobre serviços e produtos, IBS ~8,65% (estimativa de transição 2027)
  // Em 2026 as alíquotas de teste são reduzidas (1% CBS, 0,1% IBS)
  const cbsAliq = 8.8
  const ibsAliq = 8.65
  const impostoCbsIbs = simReceitaAnual * ((cbsAliq + ibsAliq) / 100)
  // Crédito estimado (entrada de insumos): 20% da receita como base de crédito
  const creditoEstimado = simReceitaAnual * 0.20 * ((cbsAliq + ibsAliq) / 100)
  const impostoNovoLiq  = Math.max(0, impostoCbsIbs - creditoEstimado)
  const diferenca = impostoNovoLiq - impostoSimples

  return (
    <Shell>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Scale size={22} className="text-brand-700" />
              <h1 className="text-xl font-bold text-brand-900">Radar Jurídico & Inteligência Tributária</h1>
            </div>
            <p className="text-sm text-brand-500 mt-0.5">
              Legislação, enquadramento e simulações para os {totalClientes} clientes
            </p>
          </div>
          <button
            onClick={aba === 'termometro' ? carregarTermometro : carregar}
            disabled={loading || loadingTerm}
            className="btn-secondary self-start sm:self-auto"
          >
            {(loading || loadingTerm) ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Atualizar análise
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Normas monitoradas',     value: ALERTAS_JURIDICOS.length, color: 'text-brand-700' },
            { label: 'Impactam seus clientes', value: alertas.length,           color: 'text-blue-700' },
            { label: 'Atenção urgente',         value: urgentesCount,            color: 'text-red-600' },
            { label: 'Impactos mapeados',       value: totalImpactos,            color: 'text-accent-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center py-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-brand-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-brand-100 p-1 rounded-xl w-fit">
          {([
            { id: 'alertas',     label: 'Alertas Normativos', icon: Scale },
            { id: 'termometro',  label: 'Termômetro',         icon: Thermometer },
            { id: 'simulador',   label: 'Simulador Reforma',  icon: Calculator },
          ] as { id: Aba; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                aba === id ? 'bg-white text-brand-900 shadow-sm' : 'text-brand-500 hover:text-brand-700'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ─── ABA: ALERTAS ─────────────────────────────────── */}
        {aba === 'alertas' && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  className="input pl-8 w-full"
                  placeholder="Buscar norma, tag, cliente..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>
              <select
                className="input w-auto"
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value as TipoNorma | '')}
              >
                <option value="">Todos os tipos</option>
                {tiposUnicos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={() => setFiltroUrgente(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  filtroUrgente
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-brand-600 border-brand-200 hover:border-red-300'
                }`}
              >
                <AlertTriangle size={14} /> Urgentes
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-brand-300" />
              </div>
            ) : alertasFiltrados.length === 0 ? (
              <div className="card text-center py-12 text-brand-400">
                <Filter size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum alerta encontrado com esses filtros.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alertasFiltrados.map(alerta => {
                  const isOpen = expandido === alerta.id
                  return (
                    <div
                      key={alerta.id}
                      className={`card border transition-all ${alerta.urgente ? 'border-red-200' : 'border-brand-200'}`}
                    >
                      <button className="w-full text-left" onClick={() => setExpandido(isOpen ? null : alerta.id)}>
                        <div className="flex items-start gap-3">
                          {alerta.urgente && <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${TIPO_COLOR[alerta.tipo]}`}>
                                {alerta.tipo}
                              </span>
                              <span className="text-xs font-bold text-brand-600">{alerta.norma}</span>
                              <span className="flex items-center gap-1 text-[11px] text-brand-400">
                                <Calendar size={11} />
                                {new Date(alerta.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                              {alerta.urgente && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
                                  URGENTE
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-brand-800 leading-snug">{alerta.titulo}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="flex items-center gap-1 text-xs text-brand-500">
                                <Building2 size={12} />
                                {alerta.clientesAfetados.length} cliente{alerta.clientesAfetados.length !== 1 ? 's' : ''} afetado{alerta.clientesAfetados.length !== 1 ? 's' : ''}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {alerta.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-brand-100 text-brand-600 rounded">
                                    <Tag size={9} />{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-brand-400">
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-4 pt-4 border-t border-brand-100 space-y-4">
                          <div>
                            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-1.5">Análise de Impacto</p>
                            <p className="text-sm text-brand-700 leading-relaxed">{alerta.impacto}</p>
                          </div>
                          <div className="flex gap-3 bg-accent-50 rounded-xl p-3 border border-accent-100">
                            <Lightbulb size={16} className="text-accent-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-accent-700 mb-0.5">Ação Preventiva Recomendada</p>
                              <p className="text-sm text-accent-800">{alerta.acaoPreventiva}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-1.5">Regimes Tributários Impactados</p>
                            <div className="flex flex-wrap gap-1.5">
                              {alerta.regimesImpactados.map(r => (
                                <span key={r} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{r}</span>
                              ))}
                            </div>
                          </div>
                          {alerta.clientesAfetados.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-1.5">
                                Clientes Afetados ({alerta.clientesAfetados.length})
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {alerta.clientesAfetados.map(c => (
                                  <span key={c.id} className="text-xs px-2.5 py-1 bg-brand-100 text-brand-700 rounded-lg font-medium">
                                    {c.nome}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ─── ABA: TERMÔMETRO ──────────────────────────────── */}
        {aba === 'termometro' && (
          <>
            {loadingTerm ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-brand-300" />
              </div>
            ) : (
              <div className="space-y-6">

                {/* Fator R */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-4">
                    <Thermometer size={18} className="text-orange-500" />
                    <h2 className="font-semibold text-brand-800">Fator R — Risco de Mudança de Anexo</h2>
                  </div>
                  <p className="text-xs text-brand-500 mb-4">
                    Clientes cujo Fator R (folha ÷ receita) está próximo ou acima de 28%. Acima de 28% o Simples migra do Anexo V para o III, com alíquotas menores.
                  </p>

                  {fatorRAlerts.length === 0 ? (
                    <div className="text-center py-8 text-brand-400">
                      <Thermometer size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum cliente com dados de folha e receita cadastrados ou nenhum próximo do limiar de 28%.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fatorRAlerts.map(a => {
                        const pct = Math.min(a.fatorR * 100, 100)
                        return (
                          <div key={a.clienteId} className={`p-3 rounded-xl border ${
                            a.nivel === 'critico' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm text-brand-800">{a.clienteNome}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                a.nivel === 'critico'
                                  ? 'bg-red-200 text-red-700'
                                  : 'bg-orange-200 text-orange-700'
                              }`}>
                                {a.nivel === 'critico' ? 'CRÍTICO' : 'ATENÇÃO'} — {(a.fatorR * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-white rounded-full h-2.5 mb-2 overflow-hidden">
                              <div
                                className={`h-2.5 rounded-full transition-all ${
                                  a.nivel === 'critico' ? 'bg-red-500' : 'bg-orange-400'
                                }`}
                                style={{ width: `${Math.min((a.fatorR / 0.28) * 100, 100)}%` }}
                              />
                            </div>
                            <div className="flex gap-4 text-xs text-brand-500">
                              <span>Folha: <strong className="text-brand-700">{fmtBRL(a.folha)}</strong></span>
                              <span>Receita: <strong className="text-brand-700">{fmtBRL(a.receita)}</strong></span>
                              <span className="ml-auto text-[10px]">Limiar: 28%</span>
                            </div>
                            {a.fatorR >= 0.28 && (
                              <p className="text-xs text-red-600 mt-2 font-medium">
                                ✓ Fator R ≥ 28% — cliente pode migrar para Anexo III e reduzir carga tributária
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Sublimites Simples Nacional */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={18} className="text-blue-500" />
                    <h2 className="font-semibold text-brand-800">Sublimites — Simples Nacional</h2>
                  </div>
                  <p className="text-xs text-brand-500 mb-4">
                    Clientes com RBT12 (receita bruta 12 meses) acima de 80% dos sublimites de R$ 3,6M (ICMS/ISS fora do DAS) ou R$ 4,8M (exclusão do Simples).
                  </p>

                  {subLimiteAlerts.length === 0 ? (
                    <div className="text-center py-8 text-brand-400">
                      <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum cliente Simples Nacional próximo dos sublimites. Cadastre o campo <code className="bg-brand-100 px-1 rounded">receita_bruta_12</code> em Clientes.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {subLimiteAlerts.map((a, i) => {
                        const pctBarWidth = Math.min(a.percentual * 100, 100)
                        return (
                          <div key={`${a.clienteId}-${i}`} className={`p-3 rounded-xl border ${
                            a.percentual >= 1 ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm text-brand-800">{a.clienteNome}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                a.percentual >= 1
                                  ? 'bg-red-200 text-red-700'
                                  : 'bg-blue-200 text-blue-700'
                              }`}>
                                {(a.percentual * 100).toFixed(0)}% de {fmtBRL(a.sublimite)}
                              </span>
                            </div>
                            <div className="text-[11px] text-brand-500 mb-1.5">
                              {a.tipo === 'sublimite_estadual' ? 'Sublimite ICMS/ISS fora do DAS' : 'Sublimite de exclusão do Simples'}
                            </div>
                            <div className="w-full bg-white rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-2.5 rounded-full transition-all ${
                                  a.percentual >= 1 ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${pctBarWidth}%` }}
                              />
                            </div>
                            <div className="flex gap-4 text-xs text-brand-500 mt-1.5">
                              <span>RBT12: <strong className="text-brand-700">{fmtBRL(a.rbt12)}</strong></span>
                              <span>Limite: <strong className="text-brand-700">{fmtBRL(a.sublimite)}</strong></span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </>
        )}

        {/* ─── ABA: SIMULADOR CBS/IBS ──────────────────────── */}
        {aba === 'simulador' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Calculator size={18} className="text-purple-500" />
                <h2 className="font-semibold text-brand-800">Simulador de Reforma Tributária — CBS/IBS</h2>
              </div>
              <p className="text-xs text-brand-500 mb-4">
                Simula o impacto da substituição do PIS/Cofins (CBS federal) e ICMS/ISS (IBS subnacional) para clientes do Simples Nacional.
                Alíquotas de referência: CBS 8,8% + IBS 8,65% (estimativa pós-transição 2033).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="input-label">Empresa (opcional)</label>
                  <select className="input" value={simClienteId} onChange={e => setSimClienteId(e.target.value)}>
                    <option value="">Simulação genérica</option>
                    {clientes.filter(c => c.regime === 'Simples Nacional').map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Receita Bruta Anual (R$)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    className="input"
                    value={simReceitaAnual}
                    onChange={e => setSimReceitaAnual(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="input-label">% de Serviços na Receita</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      className="w-full accent-purple-500"
                      value={simPctServicos}
                      onChange={e => setSimPctServicos(Number(e.target.value))}
                    />
                    <span className="text-sm font-semibold text-brand-700 w-12 text-right">{simPctServicos}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-brand-400 mt-0.5">
                    <span>Produtos</span>
                    <span>Serviços</span>
                  </div>
                </div>
              </div>

              {simClienteId && simCliente && (
                <div className="mb-4 text-xs text-brand-500 bg-brand-50 px-3 py-2 rounded-lg">
                  Regime atual: <strong>{simCliente.regime ?? '—'}</strong>
                </div>
              )}

              {/* Comparativo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Regime Atual — Simples Nacional</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-brand-600">Receita Bruta Anual</span>
                      <span className="font-medium">{fmtBRL(simReceitaAnual)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-600">Alíquota Efetiva (estimada)</span>
                      <span className="font-medium">{aliqSimples.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 pt-2">
                      <span className="font-semibold text-blue-800">Total de Impostos</span>
                      <span className="font-bold text-blue-800">{fmtBRL(impostoSimples)}</span>
                    </div>
                  </div>
                  {/* Barra */}
                  <div className="mt-3 w-full bg-white rounded-full h-2 overflow-hidden">
                    <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${Math.min(aliqSimples / 40 * 100, 100)}%` }} />
                  </div>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-3">Novo Regime — CBS + IBS</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-brand-600">CBS ({cbsAliq}%) + IBS ({ibsAliq}%)</span>
                      <span className="font-medium">{fmtBRL(impostoCbsIbs)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Crédito estimado (insumos ~20%)</span>
                      <span className="font-medium">- {fmtBRL(creditoEstimado)}</span>
                    </div>
                    <div className="flex justify-between border-t border-purple-200 pt-2">
                      <span className="font-semibold text-purple-800">Total Líquido Estimado</span>
                      <span className="font-bold text-purple-800">{fmtBRL(impostoNovoLiq)}</span>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-white rounded-full h-2 overflow-hidden">
                    <div className="h-2 bg-purple-500 rounded-full" style={{ width: `${Math.min((cbsAliq + ibsAliq) / 40 * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* Resultado */}
              <div className={`p-4 rounded-xl border-2 text-center ${
                diferenca > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-600">Impacto da Reforma</p>
                <p className={`text-2xl font-bold ${diferenca > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {diferenca > 0 ? '+' : ''}{fmtBRL(diferenca)} / ano
                </p>
                <p className="text-xs text-brand-500 mt-1">
                  {impostoSimples <= 0
                    ? 'Insira uma receita anual acima de zero para ver o impacto.'
                    : diferenca > 0
                      ? `Aumento estimado de carga tributária de ${((diferenca / impostoSimples) * 100).toFixed(1)}% em relação ao Simples`
                      : `Redução estimada de carga tributária de ${(Math.abs(diferenca) / impostoSimples * 100).toFixed(1)}% com aproveitamento de créditos`}
                </p>
              </div>

              <p className="text-[11px] text-brand-400 mt-3 text-center">
                Simulação baseada em estimativas para prestadores de serviços no Simples Nacional (Anexo III/V).
                Alíquotas finais dependem de regulamentação estadual do IBS. Consulte um especialista.
              </p>
            </div>
          </div>
        )}

      </div>
    </Shell>
  )
}
