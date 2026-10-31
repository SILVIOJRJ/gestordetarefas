'use client'

import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import type { ProcessoLegalizacao, Cliente, StatusProcesso } from '@/types/database.types'
import { FileText, Plus, X, ChevronRight, Search, AlertCircle, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

type TipoProcesso = 'Abertura' | 'Alteração Contratual' | 'Alvará' | 'CND' | 'Encerramento' | 'Outro'

interface ProcessoComCliente extends ProcessoLegalizacao {
  clientes?: { nome: string } | null
}

// ─── Etapas do fluxo societário ───────────────────────────────

const ETAPAS = [
  'Viabilidade',
  'DBE / Redesim',
  'Junta Comercial',
  'Insc. Municipal/Estadual',
  'Licenciamento',
  'Concluído',
]

const TIPOS: TipoProcesso[] = ['Abertura', 'Alteração Contratual', 'Alvará', 'CND', 'Encerramento', 'Outro']

const STATUS_CONFIG: Record<StatusProcesso, { label: string; cor: string; icon: React.ReactNode }> = {
  'Pendente':     { label: 'Pendente',     cor: 'bg-yellow-100 text-yellow-800 border-yellow-200',   icon: <Clock size={13} className="text-yellow-500" /> },
  'Em andamento': { label: 'Em andamento', cor: 'bg-blue-100 text-blue-800 border-blue-200',         icon: <Loader2 size={13} className="text-blue-500" /> },
  'Aguardando':   { label: 'Aguardando',   cor: 'bg-purple-100 text-purple-800 border-purple-200',   icon: <AlertCircle size={13} className="text-purple-500" /> },
  'Concluído':    { label: 'Concluído',    cor: 'bg-emerald-100 text-emerald-800 border-emerald-200',icon: <CheckCircle2 size={13} className="text-emerald-500" /> },
  'Cancelado':    { label: 'Cancelado',    cor: 'bg-red-100 text-red-800 border-red-200',            icon: <XCircle size={13} className="text-red-500" /> },
}

const TIPO_COR: Record<TipoProcesso, string> = {
  'Abertura':              'bg-emerald-100 text-emerald-700',
  'Alteração Contratual':  'bg-blue-100 text-blue-700',
  'Alvará':                'bg-amber-100 text-amber-700',
  'CND':                   'bg-purple-100 text-purple-700',
  'Encerramento':          'bg-red-100 text-red-700',
  'Outro':                 'bg-gray-100 text-gray-700',
}

// ─── Form vazio ───────────────────────────────────────────────

interface NovoProcessoForm {
  cliente_id: string
  tipo: TipoProcesso
  descricao: string
  prazo: string
  responsavel: string
  protocolo: string
  etapa: string
  obs: string
}

const FORM_VAZIO: NovoProcessoForm = {
  cliente_id: '', tipo: 'Abertura', descricao: '', prazo: '',
  responsavel: '', protocolo: '', etapa: 'Viabilidade', obs: '',
}

// ─── Progresso de etapas ─────────────────────────────────────

function EtapasBar({ etapaAtual }: { etapaAtual: string }) {
  const idx = ETAPAS.indexOf(etapaAtual)
  return (
    <div className="flex items-center gap-0">
      {ETAPAS.map((e, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <div key={e} className="flex items-center">
            <div className={`w-2.5 h-2.5 rounded-full border-2 shrink-0
              ${done ? 'bg-emerald-500 border-emerald-500' :
                active ? 'bg-accent-500 border-accent-500' :
                'bg-white border-brand-200'}`}
            />
            {i < ETAPAS.length - 1 && (
              <div className={`h-0.5 w-4 sm:w-6 ${done ? 'bg-emerald-400' : 'bg-brand-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Componente ───────────────────────────────────────────────

export default function ProcessosPage() {
  const [processos, setProcessos] = useState<ProcessoComCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusProcesso | 'Todos'>('Todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoProcesso | 'Todos'>('Todos')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NovoProcessoForm>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [detalhe, setDetalhe] = useState<ProcessoComCliente | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: pData }, { data: cData }] = await Promise.all([
        (supabase.from('processos_legalizacao') as any).select('*, clientes(nome)').order('created_at', { ascending: false }),
        (supabase.from('clientes') as any).select('id,nome').order('nome'),
      ])
      setProcessos((pData ?? []) as ProcessoComCliente[])
      setClientes((cData ?? []) as Cliente[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    if (!form.descricao.trim() || !form.cliente_id) return
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        cliente_id: form.cliente_id,
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        prazo: form.prazo || null,
        responsavel: form.responsavel.trim() || null,
        protocolo: form.protocolo.trim() || null,
        status: 'Pendente' as StatusProcesso,
        obs: `etapa:${form.etapa}${form.obs ? '\n' + form.obs : ''}`,
        lembrar_antes_dias: 3,
        retorno_confirmado: false,
      }
      const { error } = await (supabase.from('processos_legalizacao') as any).insert(payload)
      if (error) throw error
      setMsg({ tipo: 'ok', texto: 'Processo criado com sucesso!' })
      setForm(FORM_VAZIO)
      setShowForm(false)
      await carregar()
    } catch (e) {
      setMsg({ tipo: 'err', texto: String(e) })
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(id: string, status: StatusProcesso) {
    await (supabase.from('processos_legalizacao') as any).update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setProcessos(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    if (detalhe?.id === id) setDetalhe(prev => prev ? { ...prev, status } : null)
  }

  // ─── Filtros ─────────────────────────────────────────────────

  const lista = processos.filter(p => {
    const q = busca.toLowerCase()
    const matchBusca = !q || p.descricao?.toLowerCase().includes(q) || p.clientes?.nome?.toLowerCase().includes(q) || p.protocolo?.toLowerCase().includes(q)
    const matchStatus = filtroStatus === 'Todos' || p.status === filtroStatus
    const matchTipo = filtroTipo === 'Todos' || p.tipo === filtroTipo
    return matchBusca && matchStatus && matchTipo
  })

  function etapaDe(p: ProcessoLegalizacao): string {
    if (!p.obs) return 'Viabilidade'
    const m = p.obs.match(/^etapa:([^\n]+)/)
    return m?.[1] ?? 'Viabilidade'
  }

  // ─── Stats header ────────────────────────────────────────────

  const total = processos.length
  const andamento = processos.filter(p => p.status === 'Em andamento').length
  const concluidos = processos.filter(p => p.status === 'Concluído').length

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText size={24} className="text-brand-600" />
            <div>
              <h1 className="text-xl font-bold text-brand-800">Legalização & Processos</h1>
              <p className="text-xs text-brand-400">Aberturas, alterações, alvarás e CNDs</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setMsg(null) }}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Plus size={16} />
            Novo Processo
          </button>
        </div>

        {msg && (
          <div className={`text-sm rounded-lg px-4 py-2 ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.texto}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', valor: total, cor: 'text-brand-700' },
            { label: 'Em andamento', valor: andamento, cor: 'text-blue-600' },
            { label: 'Concluídos', valor: concluidos, cor: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-brand-100 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-brand-400">{s.label}</p>
              <p className={`text-2xl font-bold ${s.cor}`}>{s.valor}</p>
            </div>
          ))}
        </div>

        {/* Modal de novo processo */}
        {showForm && (
          <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-700">Novo Processo</h3>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-brand-400" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-brand-500 block mb-1">Cliente *</label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                >
                  <option value="">Selecione…</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoProcesso }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                >
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-brand-500 block mb-1">Descrição *</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Abertura de empresa — LTDA — Atividade comercial"
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                />
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Etapa atual</label>
                <select
                  value={form.etapa}
                  onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                >
                  {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Prazo</label>
                <input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400" />
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Responsável</label>
                <input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400" />
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Protocolo</label>
                <input value={form.protocolo} onChange={e => setForm(f => ({ ...f, protocolo: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-brand-500 block mb-1">Observações</label>
                <textarea rows={2} value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setForm(FORM_VAZIO) }} className="text-sm text-brand-500 px-3 py-1.5 hover:bg-brand-50 rounded-lg">Cancelar</button>
              <button
                onClick={salvar}
                disabled={salvando || !form.descricao.trim() || !form.cliente_id}
                className="text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white font-medium px-4 py-1.5 rounded-lg"
              >{salvando ? 'Salvando…' : 'Criar Processo'}</button>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por descrição, cliente, protocolo…"
              className="w-full border border-brand-200 rounded-lg pl-9 pr-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['Todos', 'Pendente', 'Em andamento', 'Aguardando', 'Concluído', 'Cancelado'] as const).map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                className={`text-xs px-2 py-1 rounded-full border transition ${filtroStatus === s ? 'bg-brand-700 text-white border-brand-700' : 'border-brand-200 text-brand-500 hover:bg-brand-50'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por tipo */}
        <div className="flex gap-2 flex-wrap">
          {(['Todos', ...TIPOS] as const).map(t => (
            <button key={t} onClick={() => setFiltroTipo(t as TipoProcesso | 'Todos')}
              className={`text-xs px-2 py-1 rounded-full border transition ${filtroTipo === t ? 'bg-accent-600 text-white border-accent-600' : 'border-brand-200 text-brand-500 hover:bg-brand-50'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Lista de processos */}
        {loading ? (
          <div className="py-12 text-center text-brand-300 text-sm">Carregando processos…</div>
        ) : lista.length === 0 ? (
          <div className="py-12 text-center text-brand-300 text-sm">Nenhum processo encontrado.</div>
        ) : (
          <div className="space-y-3">
            {lista.map(p => {
              const etapa = etapaDe(p)
              const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG['Pendente']
              return (
                <div
                  key={p.id}
                  className="bg-white border border-brand-100 rounded-xl p-4 hover:border-brand-200 transition cursor-pointer"
                  onClick={() => setDetalhe(detalhe?.id === p.id ? null : p)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: tipo + cliente */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${TIPO_COR[p.tipo as TipoProcesso] ?? 'bg-gray-100 text-gray-600'}`}>
                          {p.tipo ?? 'Processo'}
                        </span>
                        {p.clientes?.nome && (
                          <span className="text-xs text-brand-500">{p.clientes.nome}</span>
                        )}
                      </div>
                      {/* Descrição */}
                      <p className="text-sm font-medium text-brand-800 truncate">{p.descricao}</p>
                      {/* Etapas */}
                      <div className="mt-2 flex items-center gap-2">
                        <EtapasBar etapaAtual={etapa} />
                        <span className="text-[10px] text-brand-400 hidden sm:inline">{etapa}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${sc.cor}`}>
                        {sc.icon} {sc.label}
                      </span>
                      {p.prazo && (
                        <span className="text-[11px] text-brand-400">
                          {new Date(p.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <ChevronRight size={14} className={`text-brand-300 transition ${detalhe?.id === p.id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Detalhe expandido */}
                  {detalhe?.id === p.id && (
                    <div className="mt-4 pt-4 border-t border-brand-50 space-y-3" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        {p.responsavel && <div><span className="text-brand-400">Responsável</span><p className="text-brand-700 font-medium">{p.responsavel}</p></div>}
                        {p.protocolo && <div><span className="text-brand-400">Protocolo</span><p className="text-brand-700 font-medium">{p.protocolo}</p></div>}
                        <div><span className="text-brand-400">Criado em</span><p className="text-brand-700">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p></div>
                      </div>
                      {/* Etapas detalhadas */}
                      <div>
                        <p className="text-xs text-brand-400 mb-2">Progresso por etapas:</p>
                        <div className="flex flex-wrap gap-2">
                          {ETAPAS.map((e, i) => {
                            const idx = ETAPAS.indexOf(etapa)
                            const done = i < idx
                            const active = i === idx
                            return (
                              <span key={e} className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                done ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                active ? 'bg-accent-100 text-accent-700 border-accent-200' :
                                'bg-gray-50 text-gray-400 border-gray-200'
                              }`}>{e}</span>
                            )
                          })}
                        </div>
                      </div>
                      {/* Mudança de status */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-brand-400">Alterar status:</span>
                        {(['Pendente', 'Em andamento', 'Aguardando', 'Concluído', 'Cancelado'] as StatusProcesso[]).map(s => (
                          <button
                            key={s}
                            onClick={() => mudarStatus(p.id, s)}
                            className={`text-xs px-2 py-1 rounded border transition ${
                              p.status === s ? 'bg-brand-700 text-white border-brand-700' : 'border-brand-200 text-brand-500 hover:bg-brand-50'
                            }`}
                          >{s}</button>
                        ))}
                      </div>
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
