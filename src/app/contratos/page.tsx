'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import ContratoForm from '@/components/forms/ContratoForm'
import { supabase } from '@/lib/supabase'
import {
  Plus, Search, X, AlertTriangle, Loader2,
  Pencil, FileText, ChevronUp, ChevronDown,
} from 'lucide-react'

interface Contrato {
  id: string
  cliente_id: string
  titulo: string
  valor_mensal: number | null
  inicio: string
  termino: string | null
  renovacao_auto: boolean
  status: string
  clientes?: { nome: string } | null
}

type SortKey = 'titulo' | 'valor_mensal' | 'inicio' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_COLOR: Record<string, string> = {
  ativo:      'bg-accent-100 text-accent-700',
  suspenso:   'bg-warning-100 text-warning-600',
  encerrado:  'bg-danger-100 text-danger-600',
}

export default function ContratosPage() {
  const [contratos, setContratos]       = useState<Contrato[]>([])
  const [loading, setLoading]           = useState(true)
  const [erro, setErro]                 = useState<string | null>(null)
  const [busca, setBusca]               = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [sortKey, setSortKey]           = useState<SortKey>('titulo')
  const [sortDir, setSortDir]           = useState<SortDir>('asc')
  const [showForm, setShowForm]         = useState(false)
  const [editando, setEditando]         = useState<Contrato | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase.from('contratos') as any)
        .select('*, clientes(nome)')
        .order(sortKey, { ascending: sortDir === 'asc' })
      if (filtroStatus) q = q.eq('status', filtroStatus)
      if (busca) q = q.ilike('titulo', `%${busca}%`)
      const { data, error } = await q
      if (error) throw error
      setContratos((data ?? []) as Contrato[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [busca, filtroStatus, sortKey, sortDir])

  useEffect(() => { carregar() }, [carregar])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={12} className="text-brand-300" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-brand-600" /> : <ChevronDown size={12} className="text-brand-600" />
  }

  function Th({ k, label }: { k: SortKey; label: string }) {
    return (
      <th className="text-left px-4 py-3 cursor-pointer select-none hover:bg-brand-100" onClick={() => toggleSort(k)}>
        <span className="flex items-center gap-1">{label}<SortIcon k={k} /></span>
      </th>
    )
  }

  return (
    <Shell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-brand-900">Contratos</h1>
            <p className="text-xs text-brand-500 mt-0.5">{contratos.length} contrato{contratos.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => { setEditando(null); setShowForm(true) }} className="btn-primary">
            <Plus size={15} /> Novo Contrato
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input className="input pl-9" placeholder="Buscar contrato..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className="input w-36" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            {['ativo', 'suspenso', 'encerrado'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {erro && (
          <div className="flex items-center gap-2 text-sm text-danger-600 bg-danger-100 px-3 py-2 rounded-lg">
            <AlertTriangle size={14} /> {erro}
            <button onClick={() => setErro(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {showForm && (
          <div className="card border-2 border-brand-300">
            <h2 className="font-semibold text-brand-900 mb-4">
              {editando ? `Editar — ${editando.titulo}` : 'Novo Contrato'}
            </h2>
            <ContratoForm
              inicial={editando ?? undefined}
              onSalvo={() => { setShowForm(false); setEditando(null); carregar() }}
              onCancelar={() => { setShowForm(false); setEditando(null) }}
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-300" /></div>
        ) : contratos.length === 0 ? (
          <div className="text-center py-16 text-brand-400">
            <FileText size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum contrato encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-200">
            <table className="w-full text-sm">
              <thead className="bg-brand-50 text-xs text-brand-500 uppercase">
                <tr>
                  <Th k="titulo" label="Título" />
                  <th className="text-left px-4 py-3">Empresa</th>
                  <Th k="valor_mensal" label="Honorários" />
                  <Th k="inicio" label="Início" />
                  <Th k="status" label="Status" />
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {contratos.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-50 group">
                    <td className="px-4 py-2.5 font-medium text-brand-900">{c.titulo}</td>
                    <td className="px-4 py-2.5 text-brand-600 text-xs">{c.clientes?.nome ?? '—'}</td>
                    <td className="px-4 py-2.5 text-brand-700 font-medium">
                      {c.valor_mensal != null ? `R$ ${c.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-brand-500 text-xs">{new Date(c.inicio).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] ?? 'bg-brand-100 text-brand-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => { setEditando(c); setShowForm(true) }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-brand-100 text-brand-400 hover:text-brand-700"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  )
}
