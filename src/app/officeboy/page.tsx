'use client'

import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import type { Entrega } from '@/types/database.types'
import { Truck, CheckCircle2, Circle, Plus, RefreshCw, Clock, AlertCircle, Filter } from 'lucide-react'

// ─── Tipos locais ─────────────────────────────────────────────

interface EntregaComCliente extends Entrega {
  clientes?: { nome: string } | null
}

type StatusEntrega = 'pendente' | 'em_rota' | 'entregue' | 'nao_localizado' | 'reagendado'

const STATUS_CONFIG: Record<StatusEntrega, { label: string; cor: string; icon: React.ReactNode }> = {
  pendente:        { label: 'Pendente',        cor: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Circle size={14} className="text-yellow-500" /> },
  em_rota:         { label: 'Em Rota',         cor: 'bg-blue-100 text-blue-800 border-blue-200',       icon: <Truck size={14} className="text-blue-500" /> },
  entregue:        { label: 'Entregue',        cor: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
  nao_localizado:  { label: 'Não Localizado',  cor: 'bg-red-100 text-red-800 border-red-200',          icon: <AlertCircle size={14} className="text-red-500" /> },
  reagendado:      { label: 'Reagendado',      cor: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Clock size={14} className="text-purple-500" /> },
}

const STATUS_ORDEM: StatusEntrega[] = ['pendente', 'em_rota', 'entregue', 'nao_localizado', 'reagendado']

// ─── Formulário de nova entrega ───────────────────────────────

interface NovaEntregaForm {
  descricao: string
  responsavel: string
  status: StatusEntrega
  cliente_nome: string
}

const FORM_VAZIO: NovaEntregaForm = { descricao: '', responsavel: '', status: 'pendente', cliente_nome: '' }

// ─── Componente ───────────────────────────────────────────────

export default function OfficeBoyPage() {
  const [entregas, setEntregas] = useState<EntregaComCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<StatusEntrega | 'todos'>('todos')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NovaEntregaForm>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await (supabase.from('entregas') as any)
        .select('*, clientes(nome)')
        .order('created_at', { ascending: false })
        .limit(200)
      setEntregas((data ?? []) as EntregaComCliente[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function atualizarStatus(id: string, status: StatusEntrega) {
    const atualizacao: Partial<Entrega> = {
      status,
      ...(status === 'entregue' ? {
        conferido_por: 'office_boy',
        conferido_em: new Date().toISOString(),
      } : {}),
    }
    const { error } = await (supabase.from('entregas') as any).update(atualizacao).eq('id', id)
    if (error) { setMsg({ tipo: 'err', texto: 'Erro ao atualizar status: ' + error.message }); return }
    setEntregas(prev => prev.map(e => e.id === id ? { ...e, ...atualizacao } : e))
  }

  async function salvarNovaEntrega() {
    if (!form.descricao.trim()) return
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        descricao: form.descricao.trim(),
        responsavel: form.responsavel.trim() || null,
        status: form.status,
        cliente_id: null,
      }
      const { error } = await (supabase.from('entregas') as any).insert(payload)
      if (error) throw error
      setMsg({ tipo: 'ok', texto: 'Entrega adicionada!' })
      setForm(FORM_VAZIO)
      setShowForm(false)
      await carregar()
    } catch (e) {
      setMsg({ tipo: 'err', texto: String(e) })
    } finally {
      setSalvando(false)
    }
  }

  // ─── Stats ────────────────────────────────────────────────────

  const total = entregas.length
  const entregues = entregas.filter(e => e.status === 'entregue').length
  const pendentes = entregas.filter(e => e.status === 'pendente' || e.status === 'em_rota').length
  const pct = total ? Math.round((entregues / total) * 100) : 0

  // ─── Filtro ───────────────────────────────────────────────────

  const listaFiltrada = filtroStatus === 'todos' ? entregas : entregas.filter(e => e.status === filtroStatus)

  const gruposPorStatus: Record<StatusEntrega, EntregaComCliente[]> = {
    pendente: [], em_rota: [], entregue: [], nao_localizado: [], reagendado: [],
  }
  for (const e of listaFiltrada) {
    const s = e.status as StatusEntrega
    if (gruposPorStatus[s]) gruposPorStatus[s].push(e)
  }

  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck size={24} className="text-brand-600" />
            <div>
              <h1 className="text-xl font-bold text-brand-800">Office Boy / Entregas</h1>
              <p className="text-xs text-brand-400">Controle de protocolos e entregas físicas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={carregar} className="p-2 text-brand-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setMsg(null) }}
              className="flex items-center gap-1 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
            >
              <Plus size={16} />
              Nova
            </button>
          </div>
        </div>

        {msg && (
          <div className={`text-sm rounded-lg px-4 py-2 ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.texto}
          </div>
        )}

        {/* Formulário nova entrega */}
        {showForm && (
          <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-brand-700">Nova Entrega / Protocolo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-brand-500 block mb-1">Descrição *</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Protocolo SEFAZ — NF-e cliente X"
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                />
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Responsável</label>
                <input
                  value={form.responsavel}
                  onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                  placeholder="Nome do office boy"
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                />
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Status inicial</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusEntrega }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                >
                  {STATUS_ORDEM.map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setForm(FORM_VAZIO) }} className="text-sm text-brand-500 px-3 py-1 hover:bg-brand-50 rounded-lg">Cancelar</button>
              <button
                onClick={salvarNovaEntrega}
                disabled={salvando || !form.descricao.trim()}
                className="text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white font-medium px-4 py-1.5 rounded-lg"
              >
                {salvando ? 'Salvando…' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-brand-100 rounded-xl px-3 py-3 text-center">
            <p className="text-xs text-brand-400">Total</p>
            <p className="text-2xl font-bold text-brand-700">{total}</p>
          </div>
          <div className="bg-white border border-brand-100 rounded-xl px-3 py-3 text-center">
            <p className="text-xs text-brand-400">Entregues</p>
            <p className="text-2xl font-bold text-emerald-600">{entregues}</p>
          </div>
          <div className="bg-white border border-brand-100 rounded-xl px-3 py-3 text-center">
            <p className="text-xs text-brand-400">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600">{pendentes}</p>
          </div>
        </div>

        {/* Progresso */}
        <div className="bg-white border border-brand-100 rounded-xl px-4 py-3">
          <div className="flex justify-between text-xs text-brand-500 mb-1">
            <span>Concluídas hoje</span>
            <span>{pct}% — {entregues}/{total}</span>
          </div>
          <div className="w-full bg-brand-100 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Filtros por status */}
        <div className="flex gap-2 flex-wrap items-center">
          <Filter size={14} className="text-brand-400" />
          <button
            onClick={() => setFiltroStatus('todos')}
            className={`text-xs px-2 py-1 rounded-full border transition ${filtroStatus === 'todos' ? 'bg-brand-700 text-white border-brand-700' : 'border-brand-200 text-brand-500 hover:bg-brand-50'}`}
          >Todos ({total})</button>
          {STATUS_ORDEM.map(s => {
            const cnt = entregas.filter(e => e.status === s).length
            if (cnt === 0) return null
            return (
              <button
                key={s}
                onClick={() => setFiltroStatus(s)}
                className={`text-xs px-2 py-1 rounded-full border transition ${filtroStatus === s ? 'bg-brand-700 text-white border-brand-700' : 'border-brand-200 text-brand-500 hover:bg-brand-50'}`}
              >{STATUS_CONFIG[s].label} ({cnt})</button>
            )
          })}
        </div>

        {/* Checklist agrupado por status */}
        {loading ? (
          <div className="py-12 text-center text-brand-300 text-sm">Carregando entregas…</div>
        ) : listaFiltrada.length === 0 ? (
          <div className="py-12 text-center text-brand-300 text-sm">Nenhuma entrega encontrada.</div>
        ) : (
          <div className="space-y-4">
            {STATUS_ORDEM.map(status => {
              const grupo = gruposPorStatus[status]
              if (grupo.length === 0) return null
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2">
                    {STATUS_CONFIG[status].icon}
                    <h3 className="text-xs font-semibold text-brand-500 uppercase tracking-wide">
                      {STATUS_CONFIG[status].label} ({grupo.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {grupo.map(entrega => (
                      <div
                        key={entrega.id}
                        className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-3 transition ${
                          entrega.status === 'entregue' ? 'opacity-70' : ''
                        }`}
                      >
                        {/* Checkbox rápido */}
                        <button
                          onClick={() => atualizarStatus(entrega.id, entrega.status === 'entregue' ? 'pendente' : 'entregue')}
                          className="mt-0.5 shrink-0"
                        >
                          {entrega.status === 'entregue'
                            ? <CheckCircle2 size={20} className="text-emerald-500" />
                            : <Circle size={20} className="text-brand-200 hover:text-brand-400" />
                          }
                        </button>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${entrega.status === 'entregue' ? 'line-through text-brand-400' : 'text-brand-800'}`}>
                            {entrega.descricao}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1 items-center">
                            {entrega.clientes?.nome && (
                              <span className="text-xs text-brand-400">{entrega.clientes.nome}</span>
                            )}
                            {entrega.responsavel && (
                              <span className="text-xs text-brand-400">• {entrega.responsavel}</span>
                            )}
                            {entrega.conferido_em && (
                              <span className="text-xs text-emerald-500">
                                • {new Date(entrega.conferido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Selector de status */}
                        <select
                          value={entrega.status}
                          onChange={e => atualizarStatus(entrega.id, e.target.value as StatusEntrega)}
                          className={`text-[11px] border rounded-lg px-1.5 py-1 shrink-0 focus:outline-none ${STATUS_CONFIG[entrega.status as StatusEntrega]?.cor ?? 'bg-gray-100'}`}
                        >
                          {STATUS_ORDEM.map(s => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}
