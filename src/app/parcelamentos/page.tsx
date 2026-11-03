'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  Plus, Search, X, Pencil, Trash2, Loader2, AlertTriangle,
  ChevronUp, ChevronDown, Save, Eye, EyeOff,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

type StatusParc = 'Em andamento' | 'Concluído' | 'Atrasado' | 'Env. Cliente'
type TipoParc   = 'Previdência' | 'Simples Nacional' | 'Outro'
type OrgaoParc  = 'ESTADO' | 'PGFN' | 'RFB' | 'MUNICÍPIO' | 'Outro'

interface Parcelamento {
  id: string
  cliente_id: string | null
  cliente_nome?: string | null
  codigo: string | null
  tipo: TipoParc | string
  orgao: OrgaoParc | string | null
  total_parcelas: number | null
  parcela_atual: number | null
  valor: number | null
  vencimento: string | null
  login: string | null
  senha: string | null
  obs: string | null
  status: StatusParc | string
  enviado_cliente: boolean
  created_at: string
  updated_at: string
}

interface Cliente { id: string; nome: string }

const STATUSES: StatusParc[] = ['Em andamento', 'Concluído', 'Atrasado', 'Env. Cliente']
const TIPOS: TipoParc[]      = ['Previdência', 'Simples Nacional', 'Outro']
const ORGAOS: OrgaoParc[]    = ['ESTADO', 'PGFN', 'RFB', 'MUNICÍPIO', 'Outro']

const STATUS_COLOR: Record<string, string> = {
  'Em andamento': 'bg-blue-100 text-blue-700',
  'Concluído':    'bg-emerald-100 text-emerald-700',
  'Atrasado':     'bg-red-100 text-red-700',
  'Env. Cliente': 'bg-purple-100 text-purple-700',
}

type SortKey = 'cliente_nome' | 'tipo' | 'status' | 'vencimento' | 'valor'
type SortDir = 'asc' | 'desc'

const VAZIO: Omit<Parcelamento, 'id' | 'created_at' | 'updated_at'> = {
  cliente_id: null, codigo: '', tipo: 'Simples Nacional', orgao: 'PGFN',
  total_parcelas: null, parcela_atual: null, valor: null, vencimento: null,
  login: '', senha: '', obs: '', status: 'Em andamento', enviado_cliente: false,
}

function fmtBRL(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}
function fmtData(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function isAtrasado(d: string | null) {
  if (!d) return false
  return new Date(d) < new Date()
}

export default function ParcelamentosPage() {
  const [rows, setRows]             = useState<Parcelamento[]>([])
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [loading, setLoading]       = useState(true)
  const [erro, setErro]             = useState<string | null>(null)
  const [busca, setBusca]           = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusParc | ''>('')
  const [sortKey, setSortKey]       = useState<SortKey>('vencimento')
  const [sortDir, setSortDir]       = useState<SortDir>('asc')
  const [form, setForm]             = useState<typeof VAZIO | null>(null)
  const [editId, setEditId]         = useState<string | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [showSenha, setShowSenha]   = useState<Record<string, boolean>>({})

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const { data, error } = await (supabase.from('parcelamentos') as any)
        .select('*, clientes(nome)')
        .order(sortKey === 'cliente_nome' ? 'created_at' : sortKey, { ascending: sortDir === 'asc' })
      if (error) throw error
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        cliente_nome: r.clientes?.nome ?? null,
      })) as Parcelamento[]
      setRows(mapped)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao carregar.') }
    finally { setLoading(false) }
  }, [sortKey, sortDir])

  useEffect(() => {
    carregar()
    ;(supabase.from('clientes') as any).select('id, nome').order('nome').then(({ data }: any) => setClientes(data ?? []))
  }, [carregar])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={11} className="text-brand-300" />
    return sortDir === 'asc' ? <ChevronUp size={11} className="text-brand-600" /> : <ChevronDown size={11} className="text-brand-600" />
  }

  const filtrado = rows.filter(r => {
    const ok = (!busca || r.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) || r.codigo?.toLowerCase().includes(busca.toLowerCase()))
    const st = (!filtroStatus || r.status === filtroStatus)
    return ok && st
  })

  const total       = rows.length
  const concluidos  = rows.filter(r => r.status === 'Concluído').length
  const pendentes   = rows.filter(r => r.status === 'Em andamento').length
  const atrasados   = rows.filter(r => r.status === 'Atrasado' || (r.status === 'Em andamento' && isAtrasado(r.vencimento))).length
  const envCliente  = rows.filter(r => r.status === 'Env. Cliente' || r.enviado_cliente).length

  function abrirNovo() { setForm({ ...VAZIO }); setEditId(null) }
  function abrirEditar(r: Parcelamento) {
    setForm({ cliente_id: r.cliente_id, codigo: r.codigo ?? '', tipo: r.tipo, orgao: r.orgao ?? '',
      total_parcelas: r.total_parcelas, parcela_atual: r.parcela_atual, valor: r.valor,
      vencimento: r.vencimento, login: r.login ?? '', senha: r.senha ?? '', obs: r.obs ?? '',
      status: r.status, enviado_cliente: r.enviado_cliente })
    setEditId(r.id)
  }

  async function salvar() {
    if (!form) return
    setSalvando(true)
    try {
      const payload = { ...form }
      if (editId) {
        const { error } = await (supabase.from('parcelamentos') as any).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('parcelamentos') as any).insert(payload)
        if (error) throw error
      }
      setForm(null); setEditId(null); carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este parcelamento?')) return
    await (supabase.from('parcelamentos') as any).delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function ThSort({ k, label, cls = '' }: { k: SortKey; label: string; cls?: string }) {
    return (
      <th className={`text-left px-3 py-2.5 cursor-pointer select-none hover:bg-brand-100 ${cls}`} onClick={() => toggleSort(k)}>
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase text-brand-500">{label}<SortIcon k={k} /></span>
      </th>
    )
  }

  return (
    <Shell>
      <div className="space-y-5">

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-brand-900">Parcelamentos</h1>
            <p className="text-xs text-brand-500 mt-0.5">Controle de parcelamentos fiscais e previdenciários</p>
          </div>
          <button onClick={abrirNovo} className="btn-primary"><Plus size={15} /> Novo Parcelamento</button>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',        value: total,      color: 'bg-brand-50 border-brand-200 text-brand-700' },
            { label: 'Concluídos',   value: concluidos, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: 'Pendentes',    value: pendentes,  color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'Atrasados',    value: atrasados,  color: 'bg-red-50 border-red-200 text-red-700' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input className="input pl-9" placeholder="Buscar empresa ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select className="input w-44" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusParc | '')}>
            <option value="">Todos os status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2 text-sm text-danger-600 bg-danger-100 px-3 py-2 rounded-lg">
            <AlertTriangle size={14} /> {erro}
            <button onClick={() => setErro(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Formulário */}
        {form && (
          <div className="card border-2 border-brand-300 space-y-4">
            <h2 className="font-semibold text-brand-900">{editId ? 'Editar Parcelamento' : 'Novo Parcelamento'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Empresa</label>
                <select className="input" value={form.cliente_id ?? ''} onChange={e => setForm(f => f && ({ ...f, cliente_id: e.target.value || null }))}>
                  <option value="">— Selecionar —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Código</label>
                <input className="input" value={form.codigo ?? ''} onChange={e => setForm(f => f && ({ ...f, codigo: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={form.tipo} onChange={e => setForm(f => f && ({ ...f, tipo: e.target.value as TipoParc }))}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Órgão</label>
                <select className="input" value={form.orgao ?? ''} onChange={e => setForm(f => f && ({ ...f, orgao: e.target.value }))}>
                  <option value="">—</option>
                  {ORGAOS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => f && ({ ...f, status: e.target.value as StatusParc }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Parcela Atual</label>
                <input className="input" type="number" min={1} value={form.parcela_atual ?? ''} onChange={e => setForm(f => f && ({ ...f, parcela_atual: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <label className="label">Total de Parcelas</label>
                <input className="input" type="number" min={1} value={form.total_parcelas ?? ''} onChange={e => setForm(f => f && ({ ...f, total_parcelas: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <label className="label">Valor (R$)</label>
                <input className="input" type="number" step="0.01" value={form.valor ?? ''} onChange={e => setForm(f => f && ({ ...f, valor: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <label className="label">Vencimento</label>
                <input className="input" type="date" value={form.vencimento ?? ''} onChange={e => setForm(f => f && ({ ...f, vencimento: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Login</label>
                <input className="input" value={form.login ?? ''} onChange={e => setForm(f => f && ({ ...f, login: e.target.value }))} />
              </div>
              <div>
                <label className="label">Senha</label>
                <input className="input" type="text" value={form.senha ?? ''} onChange={e => setForm(f => f && ({ ...f, senha: e.target.value }))} />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Observações</label>
                <textarea className="input min-h-[60px]" value={form.obs ?? ''} onChange={e => setForm(f => f && ({ ...f, obs: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="env" checked={form.enviado_cliente} onChange={e => setForm(f => f && ({ ...f, enviado_cliente: e.target.checked }))} />
                <label htmlFor="env" className="text-sm text-brand-700">Enviado ao cliente</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={salvar} disabled={salvando} className="btn-primary">
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
              </button>
              <button onClick={() => { setForm(null); setEditId(null) }} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {/* Tabela */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-300" /></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-200">
            <table className="w-full text-sm">
              <thead className="bg-brand-50">
                <tr>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500 w-32">Status</th>
                  <ThSort k="cliente_nome" label="Empresa" />
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Código</th>
                  <ThSort k="tipo" label="Tipo" />
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Parcela</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Órgão</th>
                  <ThSort k="valor" label="Valor" />
                  <ThSort k="vencimento" label="Vencimento" />
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Login</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Senha</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500 hidden xl:table-cell">Obs</th>
                  <th className="px-3 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {filtrado.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-12 text-brand-300 text-sm">Nenhum parcelamento encontrado.</td></tr>
                ) : filtrado.map(r => (
                  <tr key={r.id} className="hover:bg-brand-50 group">
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] ?? 'bg-brand-100 text-brand-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-brand-900 whitespace-nowrap">{r.cliente_nome ?? '—'}</td>
                    <td className="px-3 py-2.5 text-brand-500 font-mono text-xs">{r.codigo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-brand-600 text-xs whitespace-nowrap">{r.tipo}</td>
                    <td className="px-3 py-2.5 text-brand-600 text-xs whitespace-nowrap font-mono">
                      {r.parcela_atual && r.total_parcelas ? `${r.parcela_atual}/${r.total_parcelas}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-brand-500 text-xs">{r.orgao ?? '—'}</td>
                    <td className="px-3 py-2.5 text-brand-800 text-xs font-medium whitespace-nowrap">{fmtBRL(r.valor)}</td>
                    <td className={`px-3 py-2.5 text-xs whitespace-nowrap font-medium ${isAtrasado(r.vencimento) && r.status !== 'Concluído' ? 'text-red-600' : 'text-brand-600'}`}>
                      {fmtData(r.vencimento)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-brand-500 font-mono">{r.login ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.senha ? (
                        <span className="flex items-center gap-1">
                          <span className="font-mono text-brand-500">{showSenha[r.id] ? r.senha : '••••••'}</span>
                          <button onClick={() => setShowSenha(s => ({ ...s, [r.id]: !s[r.id] }))} className="text-brand-300 hover:text-brand-600">
                            {showSenha[r.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-brand-400 hidden xl:table-cell max-w-[160px] truncate">{r.obs ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => abrirEditar(r)} className="p-1.5 rounded hover:bg-brand-100 text-brand-400 hover:text-brand-700"><Pencil size={13} /></button>
                        <button onClick={() => excluir(r.id)} className="p-1.5 rounded hover:bg-red-100 text-brand-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
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
