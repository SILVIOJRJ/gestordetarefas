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
} from 'lucide-react'

interface AlertaComClientes extends AlertaJuridico {
  clientesAfetados: Array<{ id: string; nome: string }>
}

interface Cliente {
  id: string
  nome: string
  regime: string | null
  cnae?: string | null
}

const TIPO_COLOR: Record<TipoNorma, string> = {
  'Lei Complementar':    'bg-purple-100 text-purple-700 border-purple-200',
  'Resolução CGSN':      'bg-blue-100 text-blue-700 border-blue-200',
  'Instrução Normativa': 'bg-sky-100 text-sky-700 border-sky-200',
  'Decisão STF':         'bg-red-100 text-red-700 border-red-200',
  'Decisão STJ':         'bg-orange-100 text-orange-700 border-orange-200',
  'Portaria':            'bg-teal-100 text-teal-700 border-teal-200',
  'Emenda Constitucional': 'bg-indigo-100 text-indigo-700 border-indigo-200',
}

export default function RadarJuridicoPage() {
  const [alertas, setAlertas]         = useState<AlertaComClientes[]>([])
  const [loading, setLoading]         = useState(true)
  const [busca, setBusca]             = useState('')
  const [filtroUrgente, setFiltroUrgente] = useState(false)
  const [filtroTipo, setFiltroTipo]   = useState<TipoNorma | ''>('')
  const [expandido, setExpandido]     = useState<string | null>(null)
  const [totalClientes, setTotalClientes] = useState(0)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await (supabase.from('clientes') as any)
        .select('id, nome, regime, cnae')
      const clientes: Cliente[] = (data ?? []) as Cliente[]
      setTotalClientes(clientes.length)
      const resultado = analisarClientes(clientes)
      setAlertas(resultado)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

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

  const urgentesCount  = alertas.filter(a => a.urgente).length
  const totalImpactos  = alertas.reduce((s, a) => s + a.clientesAfetados.length, 0)
  const tiposUnicos    = [...new Set(ALERTAS_JURIDICOS.map(a => a.tipo))] as TipoNorma[]

  return (
    <Shell>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Scale size={22} className="text-brand-700" />
              <h1 className="text-xl font-bold text-brand-900">Radar Jurídico</h1>
            </div>
            <p className="text-sm text-brand-500 mt-0.5">
              Legislação e decisões com impacto direto nos seus {totalClientes} clientes
            </p>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            className="btn-secondary self-start sm:self-auto"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Atualizar análise
          </button>
        </div>

        {/* ── KPIs ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Normas monitoradas', value: ALERTAS_JURIDICOS.length, color: 'text-brand-700' },
            { label: 'Impactam seus clientes', value: alertas.length, color: 'text-blue-700' },
            { label: 'Atenção urgente', value: urgentesCount, color: 'text-red-600' },
            { label: 'Impactos mapeados', value: totalImpactos, color: 'text-accent-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center py-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-brand-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Filtros ─────────────────────────────────────────────── */}
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

        {/* ── Alertas ─────────────────────────────────────────────── */}
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
                  className={`card border transition-all ${
                    alerta.urgente ? 'border-red-200' : 'border-brand-200'
                  }`}
                >
                  {/* Card header */}
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandido(isOpen ? null : alerta.id)}
                  >
                    <div className="flex items-start gap-3">
                      {alerta.urgente && (
                        <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                      )}
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

                  {/* Expandido */}
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-brand-100 space-y-4">
                      {/* Impacto */}
                      <div>
                        <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-1.5">Análise de Impacto</p>
                        <p className="text-sm text-brand-700 leading-relaxed">{alerta.impacto}</p>
                      </div>

                      {/* Ação Preventiva */}
                      <div className="flex gap-3 bg-accent-50 rounded-xl p-3 border border-accent-100">
                        <Lightbulb size={16} className="text-accent-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-accent-700 mb-0.5">Ação Preventiva Recomendada</p>
                          <p className="text-sm text-accent-800">{alerta.acaoPreventiva}</p>
                        </div>
                      </div>

                      {/* Regimes impactados */}
                      <div>
                        <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-1.5">Regimes Tributários Impactados</p>
                        <div className="flex flex-wrap gap-1.5">
                          {alerta.regimesImpactados.map(r => (
                            <span key={r} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{r}</span>
                          ))}
                        </div>
                      </div>

                      {/* Clientes afetados */}
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
      </div>
    </Shell>
  )
}
