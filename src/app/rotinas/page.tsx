'use client'

import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import {
  listarRotinas,
  listarRotinasAtivas,
  gerarTarefasDaRotinaDoMes,
  gerarCalendarioDoMes,
  statsRotinasMes,
  atualizarStatusRotina,
} from '@/services/routines'
import type { Rotina, VencimentoCalendario, StatsMes } from '@/services/routines'
import { Repeat, ChevronLeft, ChevronRight, Zap, CheckCircle2, Clock, PauseCircle, AlertCircle } from 'lucide-react'

// ─── Constantes ───────────────────────────────────────────────

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const SETOR_COR: Record<string, string> = {
  'Fiscal': 'bg-blue-100 text-blue-800',
  'RH': 'bg-purple-100 text-purple-800',
  'Contábil': 'bg-emerald-100 text-emerald-800',
  'Administrativo': 'bg-yellow-100 text-yellow-800',
  'Legalização': 'bg-orange-100 text-orange-800',
  'Office Boy': 'bg-gray-100 text-gray-700',
  'Gerencial': 'bg-red-100 text-red-800',
}

const TIPO_BADGE: Record<string, string> = {
  mensal: 'bg-blue-50 text-blue-700 border border-blue-200',
  trimestral: 'bg-amber-50 text-amber-700 border border-amber-200',
  anual: 'bg-rose-50 text-rose-700 border border-rose-200',
  rotina: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const FREQ_LABEL: Record<string, string> = {
  diaria: 'Diária', semanal: 'Semanal', quinzenal: 'Quinzenal',
  mensal: 'Mensal', anual: 'Anual', data_fixa: 'Data Fixa',
}

const STATUS_ICON: Record<Rotina['status'], React.ReactNode> = {
  ativa: <CheckCircle2 size={14} className="text-emerald-500" />,
  pausada: <PauseCircle size={14} className="text-yellow-500" />,
  encerrada: <AlertCircle size={14} className="text-red-400" />,
}

// ─── Helpers ──────────────────────────────────────────────────

function hoje() {
  const d = new Date()
  return { mes: d.getMonth() + 1, ano: d.getFullYear(), dia: d.getDate() }
}

function diasNoMes(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate()
}

function primeiroDiaDaSemana(mes: number, ano: number) {
  return new Date(ano, mes - 1, 1).getDay()
}

// ─── Componente ───────────────────────────────────────────────

export default function RotinasPage() {
  const now = hoje()
  const [mes, setMes] = useState(now.mes)
  const [ano, setAno] = useState(now.ano)
  const [rotinas, setRotinas] = useState<Rotina[]>([])
  const [calendario, setCalendario] = useState<VencimentoCalendario[]>([])
  const [stats, setStats] = useState<StatsMes>({ total: 0, concluidas: 0, pendentes: 0, pct: 0 })
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [disparando, setDisparando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [filtroSetor, setFiltroSetor] = useState<string>('Todos')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([listarRotinas(), statsRotinasMes(mes, ano)])
      setRotinas(r)
      const rAtivas = r.filter(x => x.status === 'ativa')
      setCalendario(gerarCalendarioDoMes(mes, ano, rAtivas))
      setStats(s)
    } finally {
      setLoading(false)
    }
  }, [mes, ano])

  useEffect(() => { carregar() }, [carregar])

  function navMes(delta: number) {
    setDiaSelecionado(null)
    const d = new Date(ano, mes - 1 + delta, 1)
    setMes(d.getMonth() + 1)
    setAno(d.getFullYear())
  }

  async function disparar() {
    if (!confirm(`Gerar tarefas de ${MESES[mes - 1]!}/${ano} para todos os clientes ativos?`)) return
    setDisparando(true)
    setMsg(null)
    try {
      const { geradas, erros } = await gerarTarefasDaRotinaDoMes(mes, ano)
      setMsg({ tipo: erros > 0 ? 'err' : 'ok', texto: `${geradas} tarefas geradas${erros > 0 ? `, ${erros} com erro` : ''}.` })
      await carregar()
    } catch (e) {
      setMsg({ tipo: 'err', texto: String(e) })
    } finally {
      setDisparando(false)
    }
  }

  async function toggleStatus(r: Rotina) {
    const prox: Rotina['status'] = r.status === 'ativa' ? 'pausada' : 'ativa'
    await atualizarStatusRotina(r.id, prox)
    await carregar()
  }

  // ─── Grid do calendário ──────────────────────────────────────

  const total = diasNoMes(mes, ano)
  const offset = primeiroDiaDaSemana(mes, ano)
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  const eventosPorDia = (dia: number) => calendario.filter(v => v.dia === dia)
  const diaTemEvento = (dia: number) => eventosPorDia(dia).length > 0
  const eventosHoje = diaSelecionado ? eventosPorDia(diaSelecionado) : []

  // ─── Tabela de rotinas ────────────────────────────────────────

  const setores = ['Todos', ...Array.from(new Set(rotinas.map(r => r.setor).filter(Boolean) as string[]))]
  const rotinasFiltradas = filtroSetor === 'Todos' ? rotinas : rotinas.filter(r => r.setor === filtroSetor)

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Repeat size={24} className="text-brand-600" />
            <div>
              <h1 className="text-xl font-bold text-brand-800">Rotinas & Obrigações</h1>
              <p className="text-xs text-brand-400">Calendário fiscal e controle de obrigações mensais</p>
            </div>
          </div>
          <button
            onClick={disparar}
            disabled={disparando}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Zap size={16} />
            {disparando ? 'Gerando...' : `Disparar Obrigações — ${MESES[mes - 1]!}/${ano}`}
          </button>
        </div>

        {msg && (
          <div className={`text-sm rounded-lg px-4 py-2 ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.texto}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total mês', valor: stats.total, cor: 'text-brand-700' },
            { label: 'Concluídas', valor: stats.concluidas, cor: 'text-emerald-600' },
            { label: 'Pendentes', valor: stats.pendentes, cor: 'text-yellow-600' },
            { label: 'Progresso', valor: `${stats.pct}%`, cor: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-brand-100 rounded-xl px-4 py-3">
              <p className="text-xs text-brand-400">{s.label}</p>
              <p className={`text-2xl font-bold ${s.cor}`}>{s.valor}</p>
            </div>
          ))}
        </div>

        {/* Barra de progresso */}
        <div className="bg-white border border-brand-100 rounded-xl px-4 py-3">
          <div className="flex justify-between text-xs text-brand-500 mb-1">
            <span>Obrigações concluídas</span>
            <span>{stats.concluidas}/{stats.total}</span>
          </div>
          <div className="w-full bg-brand-100 rounded-full h-2">
            <div
              className="bg-accent-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        </div>

        {/* Calendário */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          {/* Nav cabeçalho */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-brand-50">
            <button onClick={() => navMes(-1)} className="p-1 hover:bg-brand-50 rounded">
              <ChevronLeft size={18} className="text-brand-500" />
            </button>
            <span className="text-sm font-semibold text-brand-700">
              {MESES[mes - 1]} {ano}
            </span>
            <button onClick={() => navMes(1)} className="p-1 hover:bg-brand-50 rounded">
              <ChevronRight size={18} className="text-brand-500" />
            </button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 text-center text-[10px] font-medium text-brand-400 border-b border-brand-50">
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((dia, i) => {
              const isHoje = dia === now.dia && mes === now.mes && ano === now.ano
              const selecionado = dia === diaSelecionado
              const temEvento = dia ? diaTemEvento(dia) : false
              return (
                <div
                  key={i}
                  onClick={() => dia && setDiaSelecionado(selecionado ? null : dia)}
                  className={`min-h-[52px] p-1 border-r border-b border-brand-50 cursor-pointer transition
                    ${dia ? 'hover:bg-brand-50' : ''}
                    ${selecionado ? 'bg-accent-50' : ''}
                  `}
                >
                  {dia && (
                    <>
                      <span className={`text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full
                        ${isHoje ? 'bg-accent-600 text-white' : 'text-brand-600'}
                      `}>{dia}</span>
                      {temEvento && (
                        <div className="flex flex-wrap gap-[2px] mt-[2px]">
                          {eventosPorDia(dia).slice(0, 3).map((ev, j) => (
                            <span key={j} className={`block w-1.5 h-1.5 rounded-full ${
                              ev.tipo === 'anual' ? 'bg-rose-500' :
                              ev.tipo === 'trimestral' ? 'bg-amber-500' :
                              ev.tipo === 'rotina' ? 'bg-emerald-500' : 'bg-blue-500'
                            }`} />
                          ))}
                          {eventosPorDia(dia).length > 3 && (
                            <span className="text-[8px] text-brand-400">+{eventosPorDia(dia).length - 3}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Painel lateral do dia selecionado */}
        {diaSelecionado && eventosHoje.length > 0 && (
          <div className="bg-white border border-brand-100 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-brand-700 mb-3">
              Vencimentos — {String(diaSelecionado).padStart(2,'0')}/{String(mes).padStart(2,'0')}/{ano}
            </h3>
            <div className="space-y-2">
              {eventosHoje.map((ev, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${TIPO_BADGE[ev.tipo]}`}>{ev.tipo}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] ${SETOR_COR[ev.setor] ?? 'bg-gray-100 text-gray-700'}`}>{ev.setor}</span>
                  <span className="text-brand-700 font-medium">{ev.titulo}</span>
                  {ev.regimes.length > 0 && (
                    <span className="text-xs text-brand-400">{ev.regimes.join(', ')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabela de modelos de rotinas */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-brand-50">
            <h2 className="text-sm font-semibold text-brand-700">Modelos de Rotinas Recorrentes</h2>
            <div className="flex gap-2 flex-wrap">
              {setores.map(s => (
                <button
                  key={s}
                  onClick={() => setFiltroSetor(s)}
                  className={`text-xs px-2 py-1 rounded-full border transition ${
                    filtroSetor === s
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'border-brand-200 text-brand-500 hover:bg-brand-50'
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
          ) : rotinasFiltradas.length === 0 ? (
            <div className="py-10 text-center text-brand-300 text-sm">Nenhuma rotina cadastrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-brand-400 bg-brand-50/60 border-b border-brand-100">
                    <th className="px-4 py-2 font-medium">Título</th>
                    <th className="px-3 py-2 font-medium">Setor</th>
                    <th className="px-3 py-2 font-medium">Frequência</th>
                    <th className="px-3 py-2 font-medium">Vencimento</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rotinasFiltradas.map(r => (
                    <tr key={r.id} className="border-b border-brand-50 hover:bg-brand-50/40 transition">
                      <td className="px-4 py-2 text-brand-800 font-medium">{r.titulo}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${SETOR_COR[r.setor ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.setor ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-brand-600 text-xs">{FREQ_LABEL[r.frequencia] ?? r.frequencia}</td>
                      <td className="px-3 py-2 text-brand-500 text-xs">
                        {r.frequencia === 'mensal' && r.dia_mes ? `Dia ${r.dia_mes}` :
                         r.frequencia === 'semanal' && r.dia_semana !== null ? ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][r.dia_semana] :
                         r.frequencia === 'data_fixa' && r.data_fixa ? new Date(r.data_fixa).toLocaleDateString('pt-BR') :
                         r.dia_ano ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1 text-xs">
                          {STATUS_ICON[r.status]}
                          <span className={r.status === 'ativa' ? 'text-emerald-600' : r.status === 'pausada' ? 'text-yellow-600' : 'text-red-400'}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.status !== 'encerrada' && (
                          <button
                            onClick={() => toggleStatus(r)}
                            className="text-xs text-brand-500 hover:text-brand-700 underline"
                          >
                            {r.status === 'ativa' ? 'Pausar' : 'Ativar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-3 text-xs text-brand-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Mensal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Trimestral</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Anual</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Rotina interna</span>
        </div>
      </div>
    </Shell>
  )
}
