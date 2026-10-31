'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Clock, AlertTriangle } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

export interface CalendarEvent {
  dia: number
  titulo: string
  tipo: 'fiscal' | 'vencimento' | 'rotina' | 'prazo'
  regime?: string
  obs?: string
}

interface Props {
  mes?: number   // 1-12, default = mês atual
  ano?: number
  eventos?: CalendarEvent[]
}

// ─── Helpers ──────────────────────────────────────────────────

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['D','S','T','Q','Q','S','S']

const TIPO_COR: Record<CalendarEvent['tipo'], string> = {
  fiscal:    'bg-amber-400',
  vencimento:'bg-rose-400',
  rotina:    'bg-emerald-400',
  prazo:     'bg-blue-400',
}

const TIPO_LABEL: Record<CalendarEvent['tipo'], string> = {
  fiscal:    'Fiscal',
  vencimento:'Vencimento',
  rotina:    'Rotina',
  prazo:     'Prazo',
}

// ─── Componente ───────────────────────────────────────────────

export default function SmartCalendarWidget({ mes, ano, eventos = [] }: Props) {
  const now = new Date()
  const [mesAtual, setMes] = useState(mes ? mes - 1 : now.getMonth()) // 0-based
  const [anoAtual, setAno] = useState(ano ?? now.getFullYear())
  const [tooltipDia, setTooltipDia] = useState<number | null>(null)
  const [modalDia, setModalDia]     = useState<number | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const hoje = now.getDate()
  const mesHoje = now.getMonth()
  const anoHoje = now.getFullYear()

  function navMes(delta: number) {
    let m = mesAtual + delta
    let a = anoAtual
    if (m < 0)  { m = 11; a-- }
    if (m > 11) { m = 0;  a++ }
    setMes(m); setAno(a)
    setTooltipDia(null); setModalDia(null)
  }

  // Grid do mês
  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay() // 0=Dom
  const diasNoMes   = new Date(anoAtual, mesAtual + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null)

  // Eventos por dia
  const eventosPorDia = new Map<number, CalendarEvent[]>()
  eventos.forEach(e => {
    if (!eventosPorDia.has(e.dia)) eventosPorDia.set(e.dia, [])
    eventosPorDia.get(e.dia)!.push(e)
  })

  // Fechar tooltip ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltipDia(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const modalEventos = modalDia !== null ? (eventosPorDia.get(modalDia) ?? []) : []

  return (
    <div className="bg-white border border-brand-100 rounded-xl overflow-visible" ref={tooltipRef}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-50">
        <button onClick={() => navMes(-1)} className="p-1 rounded-lg hover:bg-brand-100 text-brand-500 transition">
          <ChevronLeft size={16} />
        </button>
        <h3 className="text-sm font-semibold text-brand-800">
          {MESES[mesAtual]} {anoAtual}
        </h3>
        <button onClick={() => navMes(1)} className="p-1 rounded-lg hover:bg-brand-100 text-brand-500 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid de dias */}
      <div className="p-3">
        {/* Cabeçalho dias da semana */}
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-semibold text-brand-400 py-1">{d}</div>
          ))}
        </div>

        {/* Células */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((dia, idx) => {
            if (dia === null) return <div key={idx} />

            const isHoje = dia === hoje && mesAtual === mesHoje && anoAtual === anoHoje
            const evsDia = eventosPorDia.get(dia) ?? []
            const temEvento = evsDia.length > 0

            return (
              <div
                key={idx}
                className="relative"
                onMouseEnter={() => temEvento && setTooltipDia(dia)}
                onMouseLeave={() => setTooltipDia(null)}
                onClick={() => temEvento && setModalDia(dia)}
              >
                <div
                  className={[
                    'flex flex-col items-center justify-start py-1 rounded-lg transition-all',
                    temEvento ? 'cursor-pointer hover:bg-brand-50' : '',
                    isHoje ? 'bg-brand-900' : '',
                  ].join(' ')}
                >
                  <span className={`text-xs font-medium leading-none ${
                    isHoje ? 'text-white' : 'text-brand-700'
                  }`}>
                    {dia}
                  </span>

                  {/* Pontos coloridos (máx 3) */}
                  {evsDia.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {evsDia.slice(0, 3).map((e, i) => (
                        <span key={i} className={`w-1 h-1 rounded-full ${TIPO_COR[e.tipo]}`} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Tooltip hover */}
                {tooltipDia === dia && evsDia.length > 0 && (
                  <div
                    className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-brand-900 text-white rounded-xl shadow-xl p-3 pointer-events-none"
                    style={{ minWidth: '180px' }}
                  >
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-brand-900" />
                    <p className="text-[10px] font-semibold text-brand-300 mb-2">Dia {dia}</p>
                    <div className="space-y-1.5">
                      {evsDia.map((e, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${TIPO_COR[e.tipo]}`} />
                          <div>
                            <p className="text-[11px] font-medium leading-tight">{e.titulo}</p>
                            {e.regime && <p className="text-[10px] text-brand-400">{e.regime}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-brand-400 mt-2">Clique para detalhes</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="px-4 pb-3 flex flex-wrap gap-3">
        {(Object.entries(TIPO_COR) as [CalendarEvent['tipo'], string][]).map(([tipo, cor]) => (
          <div key={tipo} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cor}`} />
            <span className="text-[10px] text-brand-400">{TIPO_LABEL[tipo]}</span>
          </div>
        ))}
      </div>

      {/* Modal de detalhe do dia */}
      {modalDia !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setModalDia(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="bg-brand-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-300">Compromissos do dia</p>
                <p className="font-semibold">{dia2(modalDia)} de {MESES[mesAtual]} de {anoAtual}</p>
              </div>
              <button onClick={() => setModalDia(null)} className="p-1.5 hover:bg-brand-800 rounded-lg transition">
                <X size={16} />
              </button>
            </div>

            {/* Lista de eventos */}
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {modalEventos.map((e, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${TIPO_COR[e.tipo]}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 justify-between">
                      <p className="text-sm font-semibold text-brand-800">{e.titulo}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        e.tipo === 'vencimento' ? 'bg-rose-100 text-rose-700' :
                        e.tipo === 'fiscal'     ? 'bg-amber-100 text-amber-700' :
                        e.tipo === 'rotina'     ? 'bg-emerald-100 text-emerald-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {TIPO_LABEL[e.tipo]}
                      </span>
                    </div>
                    {e.regime && (
                      <p className="text-xs text-brand-500 mt-0.5 flex items-center gap-1">
                        <Clock size={10} /> {e.regime}
                      </p>
                    )}
                    {e.obs && (
                      <p className="text-xs text-brand-400 mt-0.5">{e.obs}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Ação rápida */}
            <div className="px-4 pb-4">
              <a
                href="/rotinas"
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl py-2.5 transition"
              >
                <AlertTriangle size={14} /> Ver todas as obrigações do mês
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function dia2(d: number) {
  return String(d).padStart(2, '0')
}
