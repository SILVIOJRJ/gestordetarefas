'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import ClienteForm from '@/components/forms/ClienteForm'
import ClientGovernanceTab from '@/components/clients/ClientGovernanceTab'
import { supabase } from '@/lib/supabase'
import type { Cliente, RegimeTributario } from '@/types/database.types'
import {
  Plus, Search, X, AlertTriangle, Loader2,
  ChevronUp, ChevronDown, Pencil, Building2, ShieldCheck, ChevronRight,
} from 'lucide-react'

type SortKey = 'nome' | 'cnpj' | 'regime' | 'responsavel'
type SortDir = 'asc' | 'desc'
type DetalheAba = 'dados' | 'governanca'

const REGIMES: RegimeTributario[] = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI']

const REGIME_COLOR: Record<RegimeTributario, string> = {
  'Simples Nacional': 'bg-accent-100 text-accent-700',
  'Lucro Presumido':  'bg-blue-100 text-blue-700',
  'Lucro Real':       'bg-warning-100 text-warning-600',
  'MEI':              'bg-brand-100 text-brand-600',
}

export default function ClientesPage() {
  const [clientes, setClientes]         = useState<Cliente[]>([])
  const [loading, setLoading]           = useState(true)
  const [erro, setErro]                 = useState<string | null>(null)
  const [busca, setBusca]               = useState('')
  const [filtroRegime, setFiltroRegime] = useState<RegimeTributario | ''>('')
  const [sortKey, setSortKey]           = useState<SortKey>('nome')
  const [sortDir, setSortDir]           = useState<SortDir>('asc')
  const [showForm, setShowForm]         = useState(false)
  const [editando, setEditando]         = useState<Cliente | null>(null)

  // Painel de detalhe do cliente
  const [detalhe, setDetalhe]           = useState<Cliente | null>(null)
  const [detalheAba, setDetalheAba]     = useState<DetalheAba>('dados')

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      let q = (supabase.from('clientes') as any).select('*').order(sortKey, { ascending: sortDir === 'asc' })
      if (filtroRegime) q = q.eq('regime', filtroRegime)
      if (busca) q = q.ilike('nome', `%${busca}%`)
      const { data, error } = await q
      if (error) throw error
      setClientes((data ?? []) as Cliente[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [busca, filtroRegime, sortKey, sortDir])

  useEffect(() => { carregar() }, [carregar])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={12} className="text-brand-300" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-brand-600" /> : <ChevronDown size={12} className="text-brand-600" />
  }

  function ThSort({ k, label }: { k: SortKey; label: string }) {
    return (
      <th className="text-left px-4 py-3 cursor-pointer select-none hover:bg-brand-100" onClick={() => toggleSort(k)}>
        <span className="flex items-center gap-1">{label}<SortIcon k={k} /></span>
      </th>
    )
  }

  function abrirDetalhe(c: Cliente) {
    if (detalhe?.id === c.id) { setDetalhe(null); return }
    setDetalhe(c)
    setDetalheAba('dados')
    setShowForm(false)
  }

  return (
    <Shell>
      <div className={`flex gap-4 ${detalhe ? 'lg:flex-row' : ''}`}>

        {/* ─── Lista principal ─────────────────────────────────── */}
        <div className={`flex-1 min-w-0 space-y-5 transition-all ${detalhe ? 'hidden lg:block' : ''}`}>

          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-brand-900">Clientes / Empresas</h1>
              <p className="text-xs text-brand-500 mt-0.5">{clientes.length} empresa{clientes.length !== 1 ? 's' : ''} cadastrada{clientes.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => { setEditando(null); setShowForm(true); setDetalhe(null) }} className="btn-primary">
              <Plus size={15} /> Nova Empresa
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-40">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input className="input pl-9" placeholder="Buscar empresa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select className="input w-44" value={filtroRegime} onChange={(e) => setFiltroRegime(e.target.value as RegimeTributario | '')}>
              <option value="">Todos os regimes</option>
              {REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-center gap-2 text-sm text-danger-600 bg-danger-100 px-3 py-2 rounded-lg">
              <AlertTriangle size={14} /> {erro}
              <button onClick={() => setErro(null)} className="ml-auto"><X size={14} /></button>
            </div>
          )}

          {/* Formulário inline */}
          {showForm && (
            <div className="card border-2 border-brand-300">
              <h2 className="font-semibold text-brand-900 mb-4">
                {editando ? `Editar — ${editando.nome}` : 'Nova Empresa'}
              </h2>
              <ClienteForm
                inicial={editando ?? undefined}
                onSalvo={() => { setShowForm(false); setEditando(null); carregar() }}
                onCancelar={() => { setShowForm(false); setEditando(null) }}
              />
            </div>
          )}

          {/* Tabela densa */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-300" /></div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-16 text-brand-400">
              <Building2 size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma empresa encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-brand-200">
              <table className="w-full text-sm">
                <thead className="bg-brand-50 text-xs text-brand-500 uppercase">
                  <tr>
                    <ThSort k="nome" label="Razão Social" />
                    <ThSort k="cnpj" label="CNPJ/CPF" />
                    <ThSort k="regime" label="Regime" />
                    <th className="text-left px-4 py-3 hidden md:table-cell">E-mail</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Telefone</th>
                    <ThSort k="responsavel" label="Responsável" />
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {clientes.map((c) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-brand-50 group cursor-pointer ${detalhe?.id === c.id ? 'bg-accent-50' : ''}`}
                      onClick={() => abrirDetalhe(c)}
                    >
                      <td className="px-4 py-2.5 font-medium text-brand-900 whitespace-nowrap">{c.nome}</td>
                      <td className="px-4 py-2.5 text-brand-500 font-mono text-xs whitespace-nowrap">{c.cnpj ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {c.regime ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REGIME_COLOR[c.regime]}`}>{c.regime}</span>
                        ) : <span className="text-brand-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-brand-500 text-xs hidden md:table-cell">{c.email ?? '—'}</td>
                      <td className="px-4 py-2.5 text-brand-500 text-xs hidden lg:table-cell">{c.telefone ?? '—'}</td>
                      <td className="px-4 py-2.5 text-brand-500 text-xs whitespace-nowrap">{c.responsavel ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditando(c); setShowForm(true) }}
                            className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-400 hover:text-brand-700"
                          >
                            <Pencil size={14} />
                          </button>
                          <ChevronRight size={14} className="text-brand-300" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Painel de detalhe (slide-in) ─────────────────────── */}
        {detalhe && (
          <div className="w-full lg:w-[480px] shrink-0 space-y-4">
            {/* Header do painel */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-brand-800 truncate max-w-xs">{detalhe.nome}</h2>
                <p className="text-xs text-brand-400">{detalhe.cnpj ?? ''} {detalhe.regime ? `· ${detalhe.regime}` : ''}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="p-1.5 hover:bg-brand-100 rounded-lg text-brand-400">
                <X size={16} />
              </button>
            </div>

            {/* Abas */}
            <div className="flex gap-1 bg-brand-50 rounded-xl p-1">
              {([
                { id: 'dados',      label: 'Dados',      icon: Building2 },
                { id: 'governanca', label: 'Governança', icon: ShieldCheck },
              ] as { id: DetalheAba; label: string; icon: React.ComponentType<{ size: number; className?: string }> }[]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setDetalheAba(id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all
                    ${detalheAba === id ? 'bg-white text-brand-800 shadow-sm' : 'text-brand-400 hover:text-brand-600'}`}
                >
                  <Icon size={14} className="shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* Conteúdo da aba */}
            {detalheAba === 'dados' ? (
              <div className="card space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Razão Social', value: detalhe.nome },
                    { label: 'CNPJ/CPF', value: detalhe.cnpj ?? '—' },
                    { label: 'Regime', value: detalhe.regime ?? '—' },
                    { label: 'Responsável', value: detalhe.responsavel ?? '—' },
                    { label: 'E-mail', value: detalhe.email ?? '—' },
                    { label: 'Telefone', value: detalhe.telefone ?? '—' },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-xs text-brand-400">{f.label}</p>
                      <p className="text-brand-800 font-medium mt-0.5 break-all">{f.value}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setEditando(detalhe); setShowForm(true) }}
                  className="btn-secondary w-full"
                >
                  <Pencil size={14} /> Editar dados cadastrais
                </button>
              </div>
            ) : (
              <ClientGovernanceTab
                cliente={detalhe}
                onAtualizado={() => {
                  carregar()
                  // atualiza o cliente no painel de detalhe
                  supabase.from('clientes' as any).select('*').eq('id', detalhe.id).single()
                    .then(({ data }) => { if (data) setDetalhe(data as Cliente) })
                }}
              />
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}
