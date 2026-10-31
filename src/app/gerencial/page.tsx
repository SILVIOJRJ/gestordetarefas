'use client'

import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import type { Cliente, Contrato, RegimeTributario } from '@/types/database.types'
import { BarChart2, TrendingUp, AlertTriangle, DollarSign, ChevronLeft, ChevronRight, FileText, Printer, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { buscarLancamentosDoMes, imprimirRelatorioGerencial, type LancamentoFinanceiro } from '@/services/reports'

// ─── Tipos ────────────────────────────────────────────────────

interface ClienteContrato extends Cliente {
  contratos: Contrato[]
}

interface KPIs {
  mrr: number
  faturadoMes: number
  adicionais: number
  inadimplentes: number
}

interface FaturamentoPorRegime {
  regime: string
  clientes: number
  mrr: number
}

interface ServicoAdicional {
  clienteId: string
  nomeCliente: string
  descricao: string
  valorEstimado: number | null
}

const REGIME_COR: Record<string, string> = {
  'Simples Nacional': 'bg-blue-500',
  'Lucro Presumido':  'bg-purple-500',
  'Lucro Real':       'bg-rose-500',
  'MEI':              'bg-emerald-500',
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

// ─── Componente ───────────────────────────────────────────────

export default function GerencialPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())

  const [clientes, setClientes] = useState<ClienteContrato[]>([])
  const [kpis, setKpis] = useState<KPIs>({ mrr: 0, faturadoMes: 0, adicionais: 0, inadimplentes: 0 })
  const [porRegime, setPorRegime] = useState<FaturamentoPorRegime[]>([])
  const [adicionais, setAdicionais] = useState<ServicoAdicional[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      // Clientes + contratos ativos
      const { data: cData } = await (supabase.from('clientes') as any)
        .select('*, contratos(*)')
        .order('nome')
      const lista = (cData ?? []) as ClienteContrato[]
      setClientes(lista)

      // KPIs
      let mrr = 0
      let inadimplentes = 0
      const regimeMap: Record<string, FaturamentoPorRegime> = {}
      const extras: ServicoAdicional[] = []

      for (const c of lista) {
        const contratosAtivos = (c.contratos ?? []).filter((ct: Contrato) => ct.status === 'ativo')
        const valorMensal = contratosAtivos.reduce((acc: number, ct: Contrato) => acc + (ct.valor_mensal ?? 0), 0)
        mrr += valorMensal

        const regime = c.regime ?? 'Sem Regime'
        if (!regimeMap[regime]) regimeMap[regime] = { regime, clientes: 0, mrr: 0 }
        regimeMap[regime].clientes += 1
        regimeMap[regime].mrr += valorMensal

        // Contratos vencidos = inadimplência
        const vencidos = contratosAtivos.filter((ct: Contrato) => {
          if (!ct.termino) return false
          return new Date(ct.termino) < new Date() && !ct.renovacao_auto
        })
        if (vencidos.length > 0) inadimplentes++

        // Serviços extras sem contrato ativo
        if (valorMensal === 0 && c.nome) {
          extras.push({ clienteId: c.id, nomeCliente: c.nome, descricao: 'Cliente sem contrato ativo', valorEstimado: null })
        }
      }

      setKpis({ mrr, faturadoMes: mrr, adicionais: extras.length * 150, inadimplentes })
      setPorRegime(Object.values(regimeMap).sort((a, b) => b.mrr - a.mrr))
      setAdicionais(extras.slice(0, 20))

      // Lançamentos financeiros do mês
      const lanc = await buscarLancamentosDoMes(mes, ano)
      setLancamentos(lanc)
    } finally {
      setLoading(false)
    }
  }, [mes, ano])

  useEffect(() => { carregar() }, [carregar])

  function navMes(d: number) {
    const dt = new Date(ano, mes - 1 + d, 1)
    setMes(dt.getMonth() + 1)
    setAno(dt.getFullYear())
  }

  const maxMrr = Math.max(...porRegime.map(r => r.mrr), 1)

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <BarChart2 size={24} className="text-brand-600" />
            <div>
              <h1 className="text-xl font-bold text-brand-800">Painel Gerencial</h1>
              <p className="text-xs text-brand-400">Honorários, faturamento e adicionais extracontratuais</p>
            </div>
          </div>
          <button
            onClick={() => imprimirRelatorioGerencial(mes, ano, lancamentos)}
            className="flex items-center gap-2 border border-brand-200 hover:bg-brand-50 text-brand-600 text-sm font-medium px-3 py-2 rounded-lg transition"
          >
            <Printer size={15} /> Imprimir Relatório
          </button>
          <div className="flex items-center gap-2 bg-white border border-brand-100 rounded-xl px-3 py-2">
            <button onClick={() => navMes(-1)} className="p-1 hover:bg-brand-50 rounded">
              <ChevronLeft size={16} className="text-brand-500" />
            </button>
            <span className="text-sm font-medium text-brand-700 w-28 text-center">
              {MESES[mes - 1]} / {ano}
            </span>
            <button onClick={() => navMes(1)} className="p-1 hover:bg-brand-50 rounded">
              <ChevronRight size={16} className="text-brand-500" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'MRR — Honorários Recorrentes',
              valor: fmt(kpis.mrr),
              icon: <DollarSign size={20} className="text-emerald-500" />,
              sub: `${clientes.length} clientes ativos`,
              cor: 'border-emerald-200 bg-emerald-50/40',
            },
            {
              label: 'Total Faturado no Mês',
              valor: fmt(kpis.faturadoMes),
              icon: <TrendingUp size={20} className="text-blue-500" />,
              sub: `${MESES[mes - 1]}/${ano}`,
              cor: 'border-blue-200 bg-blue-50/40',
            },
            {
              label: 'Adicionais Pendentes',
              valor: fmt(kpis.adicionais),
              icon: <FileText size={20} className="text-amber-500" />,
              sub: `${adicionais.length} itens sem contrato`,
              cor: 'border-amber-200 bg-amber-50/40',
            },
            {
              label: 'Inadimplência',
              valor: kpis.inadimplentes.toString(),
              icon: <AlertTriangle size={20} className="text-rose-500" />,
              sub: 'contratos vencidos',
              cor: 'border-rose-200 bg-rose-50/40',
            },
          ].map(k => (
            <div key={k.label} className={`bg-white border rounded-xl p-4 ${k.cor}`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-brand-500 leading-tight max-w-[80%]">{k.label}</p>
                {k.icon}
              </div>
              <p className="text-2xl font-bold text-brand-800">{k.valor}</p>
              <p className="text-xs text-brand-400 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Faturamento por Regime */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50">
            <h2 className="text-sm font-semibold text-brand-700">Faturamento por Regime Tributário</h2>
          </div>
          {loading ? (
            <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
          ) : porRegime.length === 0 ? (
            <div className="py-10 text-center text-brand-300 text-sm">Nenhum dado disponível.</div>
          ) : (
            <div className="p-4 space-y-4">
              {porRegime.map(r => (
                <div key={r.regime}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${REGIME_COR[r.regime] ?? 'bg-gray-400'}`} />
                      <span className="text-sm text-brand-700 font-medium">{r.regime}</span>
                      <span className="text-xs text-brand-400">{r.clientes} cliente{r.clientes !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-sm font-semibold text-brand-800">{fmt(r.mrr)}</span>
                  </div>
                  <div className="w-full bg-brand-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${REGIME_COR[r.regime] ?? 'bg-gray-400'}`}
                      style={{ width: `${(r.mrr / maxMrr) * 100}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Totais */}
              <div className="pt-3 border-t border-brand-50 flex justify-between text-sm">
                <span className="text-brand-500">Total geral</span>
                <span className="font-bold text-brand-800">{fmt(porRegime.reduce((a, r) => a + r.mrr, 0))}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabela resumo por cliente */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50">
            <h2 className="text-sm font-semibold text-brand-700">Honorários por Cliente</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-brand-400 bg-brand-50/60 border-b border-brand-100">
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Regime</th>
                  <th className="px-3 py-2 font-medium text-right">Honorário</th>
                  <th className="px-3 py-2 font-medium">Contratos</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => {
                  const ativos = (c.contratos ?? []).filter((ct: Contrato) => ct.status === 'ativo')
                  const valor = ativos.reduce((a: number, ct: Contrato) => a + (ct.valor_mensal ?? 0), 0)
                  return (
                    <tr key={c.id} className="border-b border-brand-50 hover:bg-brand-50/40 transition">
                      <td className="px-4 py-2 text-brand-800 font-medium">{c.nome}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 text-xs`}>
                          <span className={`w-2 h-2 rounded-full ${REGIME_COR[c.regime ?? ''] ?? 'bg-gray-300'}`} />
                          {c.regime ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-brand-700">
                        {valor > 0 ? fmt(valor) : <span className="text-brand-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-brand-500 text-xs">{ativos.length} ativo{ativos.length !== 1 ? 's' : ''}</td>
                      <td className="px-3 py-2">
                        {valor === 0
                          ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Sem contrato</span>
                          : <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Regular</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Lançamentos Financeiros */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-700">Entradas & Saídas — {MESES[mes - 1]}/{ano}</h2>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-600">
                <ArrowUpCircle size={13} />
                Entradas: {fmt(lancamentos.filter(l => l.tipo === 'entrada').reduce((a, l) => a + l.valor, 0))}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <ArrowDownCircle size={13} />
                Saídas: {fmt(lancamentos.filter(l => l.tipo === 'saida').reduce((a, l) => a + l.valor, 0))}
              </span>
            </div>
          </div>
          {lancamentos.length === 0 ? (
            <div className="py-8 text-center text-brand-300 text-sm">Nenhum lançamento registrado para o período.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-brand-400 bg-brand-50/60 border-b border-brand-100">
                    <th className="px-4 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Forma</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l, i) => (
                    <tr key={i} className="border-b border-brand-50 hover:bg-brand-50/40">
                      <td className="px-4 py-2 text-brand-500 text-xs whitespace-nowrap">
                        {new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 text-brand-700 text-xs">{l.descricao}</td>
                      <td className="px-3 py-2 text-brand-400 text-xs">{l.cliente ?? '—'}</td>
                      <td className="px-3 py-2 text-brand-400 text-xs">{l.forma}</td>
                      <td className={`px-3 py-2 text-right font-semibold text-xs ${l.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {l.tipo === 'saida' ? '−' : '+'}{fmt(l.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-50 border-t-2 border-brand-200">
                    <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-brand-600">Saldo do mês</td>
                    <td className={`px-3 py-2 text-right font-bold text-sm ${
                      lancamentos.reduce((a, l) => a + (l.tipo === 'entrada' ? l.valor : -l.valor), 0) >= 0
                        ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {fmt(lancamentos.reduce((a, l) => a + (l.tipo === 'entrada' ? l.valor : -l.valor), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Adicionais extracontratuais */}
        {adicionais.length > 0 && (
          <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/40 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-amber-700">Serviços Adicionais Pendentes de Faturamento</h2>
            </div>
            <div className="divide-y divide-brand-50">
              {adicionais.map(a => (
                <div key={a.clienteId} className="px-4 py-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-brand-800">{a.nomeCliente}</p>
                    <p className="text-xs text-brand-400">{a.descricao}</p>
                  </div>
                  {a.valorEstimado && (
                    <span className="text-sm font-semibold text-amber-600">{fmt(a.valorEstimado)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
