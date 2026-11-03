'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import type { AdminCompromisso } from '@/types/database.types'
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar,
  Clock, Users, Flag, Bell, ArrowLeft,
} from 'lucide-react'

interface Evento {
  id: string
  titulo: string
  data: string // YYYY-MM-DD
  hora?: string
  tipo: 'tarefa' | 'compromisso' | 'vencimento' | 'andamento'
  cor: string
  descricao?: string
}

const TIPO_COR: Record<string, string> = {
  tarefa:      '#6366f1',
  compromisso: '#f59e0b',
  vencimento:  '#ef4444',
  andamento:   '#10b981',
  reuniao:     '#8b5cf6',
  prazo:       '#ef4444',
  lembrete:    '#3b82f6',
}

const TIPO_LABEL: Record<string, string> = {
  compromisso: 'Compromisso',
  reuniao:     'Reunião',
  prazo:       'Prazo',
  lembrete:    'Lembrete',
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function AdminCalendarioPage() {
  const router = useRouter()
  const hoje = new Date()
  const [ano, setAno]       = useState(hoje.getFullYear())
  const [mes, setMes]       = useState(hoje.getMonth())
  const [eventos, setEventos] = useState<Evento[]>([])
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [modalNovo, setModalNovo]   = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [novo, setNovo] = useState({
    titulo: '', tipo: 'compromisso', data_inicio: '', hora: '',
    data_fim: '', dia_todo: false, descricao: '', cor: '#f59e0b',
  })

  useEffect(() => {
    carregarEventos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes])

  async function carregarEventos() {
    const inicio = new Date(ano, mes, 1).toISOString().slice(0, 10)
    const fim    = new Date(ano, mes + 1, 0).toISOString().slice(0, 10)

    const [{ data: tarefas }, { data: comps }] = await Promise.all([
      (supabase.from('tarefas') as any)
        .select('id, titulo, prazo, status, prioridade')
        .not('prazo', 'is', null)
        .gte('prazo', inicio)
        .lte('prazo', fim),
      (supabase.from('admin_compromissos') as any)
        .select('*')
        .gte('data_inicio', inicio + 'T00:00:00')
        .lte('data_inicio', fim + 'T23:59:59'),
    ])

    const evs: Evento[] = []

    for (const t of tarefas ?? []) {
      if (t.status === 'Cancelada') continue
      evs.push({
        id:    `t-${t.id}`,
        titulo: t.titulo,
        data:  t.prazo,
        tipo:  t.status === 'Concluída' ? 'andamento' : 'vencimento',
        cor:   t.status === 'Concluída' ? '#10b981' : t.prioridade === 'Urgente' ? '#ef4444' : '#6366f1',
        descricao: `${t.status} · ${t.prioridade}`,
      })
    }

    for (const c of comps ?? []) {
      evs.push({
        id:    `c-${c.id}`,
        titulo: c.titulo,
        data:  c.data_inicio.slice(0, 10),
        hora:  c.dia_todo ? undefined : c.data_inicio.slice(11, 16),
        tipo:  'compromisso',
        cor:   c.cor ?? TIPO_COR[c.tipo] ?? '#f59e0b',
        descricao: c.descricao ?? undefined,
      })
    }

    setEventos(evs)
  }

  async function salvarCompromisso() {
    if (!novo.titulo.trim() || !novo.data_inicio) return
    setSalvando(true)
    const dtInicio = novo.dia_todo
      ? novo.data_inicio + 'T00:00:00'
      : novo.data_inicio + 'T' + (novo.hora || '09:00') + ':00'
    await (supabase.from('admin_compromissos') as any).insert({
      titulo:      novo.titulo.trim(),
      tipo:        novo.tipo,
      data_inicio: dtInicio,
      dia_todo:    novo.dia_todo,
      descricao:   novo.descricao || null,
      cor:         TIPO_COR[novo.tipo] ?? novo.cor,
    })
    await carregarEventos()
    setModalNovo(false)
    setNovo({ titulo: '', tipo: 'compromisso', data_inicio: '', hora: '', data_fim: '', dia_todo: false, descricao: '', cor: '#f59e0b' })
    setSalvando(false)
  }

  // Construção da grade do calendário
  const primeiroDia     = new Date(ano, mes, 1).getDay()
  const diasNoMes       = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]
  while (celulas.length % 7 !== 0) celulas.push(null)

  function dataStr(dia: number) {
    return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  function eventosNoDia(dia: number) {
    return eventos.filter(e => e.data === dataStr(dia))
  }

  const eventosDiaSelecionado = diaSelecionado
    ? eventos.filter(e => e.data === diaSelecionado)
    : []

  function navMes(d: -1 | 1) {
    let nm = mes + d
    let na = ano
    if (nm < 0)  { nm = 11; na-- }
    if (nm > 11) { nm = 0;  na++ }
    setMes(nm)
    setAno(na)
    setDiaSelecionado(null)
  }

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl border border-brand-200 text-brand-500 hover:bg-brand-50">
              <ArrowLeft size={15} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-brand-900 flex items-center gap-2">
                <Calendar size={22} className="text-accent-600" /> Calendário Admin
              </h1>
              <p className="text-xs text-brand-400">Tarefas, compromissos e vencimentos</p>
            </div>
          </div>
          <button
            onClick={() => setModalNovo(true)}
            className="flex items-center gap-2 text-sm bg-accent-600 text-white px-4 py-2 rounded-xl hover:bg-accent-700 transition font-medium"
          >
            <Plus size={15} /> Novo compromisso
          </button>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { cor: '#6366f1', l: 'Tarefa pendente' },
            { cor: '#ef4444', l: 'Vencimento urgente' },
            { cor: '#10b981', l: 'Concluída' },
            { cor: '#f59e0b', l: 'Compromisso' },
            { cor: '#8b5cf6', l: 'Reunião' },
            { cor: '#3b82f6', l: 'Lembrete' },
          ].map(({ cor, l }) => (
            <span key={l} className="flex items-center gap-1 text-brand-600">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: cor }} />
              {l}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Grade calendário */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
            {/* Nav mês */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-brand-100">
              <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-500">
                <ChevronLeft size={16} />
              </button>
              <h2 className="font-semibold text-brand-900">{MESES[mes]} {ano}</h2>
              <button onClick={() => navMes(1)} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-500">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 border-b border-brand-100">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="text-center text-[11px] font-semibold text-brand-400 py-2">{d}</div>
              ))}
            </div>

            {/* Células */}
            <div className="grid grid-cols-7">
              {celulas.map((dia, i) => {
                if (!dia) return <div key={i} className="min-h-[70px] border-r border-b border-brand-50" />
                const ds     = dataStr(dia)
                const evs    = eventosNoDia(dia)
                const ehHoje = ds === hoje.toISOString().slice(0, 10)
                const selecionado = ds === diaSelecionado
                return (
                  <div
                    key={i}
                    onClick={() => setDiaSelecionado(selecionado ? null : ds)}
                    className={`min-h-[70px] border-r border-b border-brand-50 p-1 cursor-pointer transition
                      ${selecionado ? 'bg-accent-50 ring-2 ring-inset ring-accent-400' : 'hover:bg-brand-50'}`}
                  >
                    <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1
                      ${ehHoje ? 'bg-accent-600 text-white' : 'text-brand-600'}`}>
                      {dia}
                    </div>
                    <div className="space-y-0.5">
                      {evs.slice(0, 3).map(e => (
                        <div
                          key={e.id}
                          className="text-[10px] truncate px-1 py-0.5 rounded font-medium text-white leading-tight"
                          style={{ background: e.cor }}
                          title={e.titulo}
                        >
                          {e.hora ? `${e.hora} ` : ''}{e.titulo}
                        </div>
                      ))}
                      {evs.length > 3 && (
                        <div className="text-[10px] text-brand-400 pl-1">+{evs.length - 3} mais</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Painel lateral — dia selecionado */}
          <div className="bg-white rounded-2xl border border-brand-100 shadow-sm">
            <div className="p-4 border-b border-brand-100">
              <h3 className="font-semibold text-brand-900 text-sm">
                {diaSelecionado
                  ? new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Selecione um dia'}
              </h3>
            </div>
            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
              {!diaSelecionado && (
                <p className="text-xs text-brand-300 text-center py-8">Clique em um dia para ver os eventos.</p>
              )}
              {diaSelecionado && eventosDiaSelecionado.length === 0 && (
                <p className="text-xs text-brand-300 text-center py-8">Nenhum evento neste dia.</p>
              )}
              {eventosDiaSelecionado.map(e => (
                <div
                  key={e.id}
                  className="flex gap-3 p-3 rounded-xl border border-brand-100 hover:bg-brand-50 transition"
                >
                  <div className="w-1 rounded-full shrink-0" style={{ background: e.cor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-900 truncate">{e.titulo}</p>
                    {e.hora && (
                      <p className="text-xs text-brand-400 flex items-center gap-1 mt-0.5">
                        <Clock size={10} /> {e.hora}
                      </p>
                    )}
                    {e.descricao && (
                      <p className="text-xs text-brand-500 mt-0.5">{e.descricao}</p>
                    )}
                    <span
                      className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: e.cor }}
                    >
                      {e.tipo === 'tarefa' || e.tipo === 'vencimento' ? 'Tarefa' : e.tipo === 'andamento' ? 'Concluída' : TIPO_LABEL[e.tipo] ?? e.tipo}
                    </span>
                  </div>
                </div>
              ))}
              {diaSelecionado && (
                <button
                  onClick={() => { setNovo(p => ({ ...p, data_inicio: diaSelecionado })); setModalNovo(true) }}
                  className="w-full flex items-center justify-center gap-2 text-xs text-accent-600 border border-dashed border-accent-300 rounded-xl py-2.5 hover:bg-accent-50 transition"
                >
                  <Plus size={12} /> Adicionar compromisso neste dia
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal novo compromisso */}
      {modalNovo && (
        <>
          <div className="fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm" onClick={() => setModalNovo(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-brand-100">
                <h2 className="font-semibold text-brand-900 flex items-center gap-2"><Calendar size={16} className="text-accent-600" />Novo Compromisso</h2>
                <button onClick={() => setModalNovo(false)} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-400"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="input-label">Título *</label>
                  <input value={novo.titulo} onChange={e => setNovo(p => ({ ...p, titulo: e.target.value }))} className="input w-full" placeholder="Descrição do compromisso" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Tipo</label>
                    <select value={novo.tipo} onChange={e => setNovo(p => ({ ...p, tipo: e.target.value }))} className="input w-full">
                      <option value="compromisso">Compromisso</option>
                      <option value="reuniao">Reunião</option>
                      <option value="prazo">Prazo</option>
                      <option value="lembrete">Lembrete</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Data *</label>
                    <input type="date" value={novo.data_inicio} onChange={e => setNovo(p => ({ ...p, data_inicio: e.target.value }))} className="input w-full" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={novo.dia_todo} onChange={e => setNovo(p => ({ ...p, dia_todo: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-brand-700">Dia todo</span>
                </label>
                {!novo.dia_todo && (
                  <div>
                    <label className="input-label">Horário</label>
                    <input type="time" value={novo.hora} onChange={e => setNovo(p => ({ ...p, hora: e.target.value }))} className="input w-full" />
                  </div>
                )}
                <div>
                  <label className="input-label">Descrição (opcional)</label>
                  <textarea rows={2} value={novo.descricao} onChange={e => setNovo(p => ({ ...p, descricao: e.target.value }))} className="input w-full resize-none" />
                </div>
              </div>
              <div className="p-5 border-t border-brand-100 flex justify-end gap-2">
                <button onClick={() => setModalNovo(false)} className="text-sm px-4 py-2 rounded-xl border border-brand-200 text-brand-600">Cancelar</button>
                <button
                  onClick={salvarCompromisso}
                  disabled={salvando || !novo.titulo.trim() || !novo.data_inicio}
                  className="text-sm px-5 py-2 rounded-xl bg-accent-600 text-white disabled:opacity-50 font-medium"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
