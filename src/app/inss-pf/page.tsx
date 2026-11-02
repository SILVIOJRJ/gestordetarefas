'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  Plus, Search, X, Pencil, Trash2, Loader2, AlertTriangle,
  ChevronUp, ChevronDown, Save,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

type CategoriaInss = 'Facultativo' | 'Contribuinte Individual'
type StatusInss    = 'Pago' | 'Pendente'

interface InssPF {
  id: string
  nome: string
  nit: string | null
  cod_gps: string | null
  aliquota: number | null
  categoria: CategoriaInss | string
  salario: number | null
  valor_gps: number | null
  competencia: string | null
  vencimento: string | null
  envio: string | null
  status: StatusInss | string
  created_at: string
  updated_at: string
}

const CATEGORIAS: CategoriaInss[] = ['Facultativo', 'Contribuinte Individual']
const STATUSES: StatusInss[]      = ['Pendente', 'Pago']
const ALIQUOTAS = [11, 20, 22]

const STATUS_COLOR: Record<string, string> = {
  'Pago':     'bg-emerald-100 text-emerald-700',
  'Pendente': 'bg-warning-100 text-warning-700',
}

type SortKey = 'nome' | 'categoria' | 'status' | 'vencimento' | 'valor_gps' | 'competencia'
type SortDir = 'asc' | 'desc'

const now = new Date()
const mesAtual = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

const VAZIO: Omit<InssPF, 'id' | 'created_at' | 'updated_at'> = {
  nome: '', nit: '', cod_gps: '', aliquota: 11, categoria: 'Facultativo',
  salario: null, valor_gps: null, competencia: mesAtual,
  vencimento: null, envio: '', status: 'Pendente',
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
function calcGPS(salario: number | null, aliquota: number | null): number | null {
  if (!salario || !aliquota) return null
  return Math.round(salario * (aliquota / 100) * 100) / 100
}

export default function InssPFPage() {
  const [rows, setRows]         = useState<InssPF[]>([])
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState<string | null>(null)
  const [busca, setBusca]       = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusInss | ''>('')
  const [filtroComp, setFiltroComp]     = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>('nome')
  const [sortDir, setSortDir]   = useState<SortDir>('asc')
  const [form, setForm]         = useState<typeof VAZIO | null>(null)
  const [editId, setEditId]     = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      let q = (supabase.from('inss_pf') as any)
        .select('*')
        .order(sortKey, { ascending: sortDir === 'asc' })
      if (filtroStatus) q = q.eq('status', filtroStatus)
      if (filtroComp)   q = q.eq('competencia', filtroComp)
      const { data, error } = await q
      if (error) throw error
      setRows((data ?? []) as InssPF[])
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao carregar.') }
    finally { setLoading(false) }
  }, [sortKey, sortDir, filtroStatus, filtroComp])

  useEffect(() => { carregar() }, [carregar])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={11} className="text-brand-300" />
    return sortDir === 'asc' ? <ChevronUp size={11} className="text-brand-600" /> : <ChevronDown size={11} className="text-brand-600" />
  }

  const filtrado = rows.filter(r =>
    !busca || r.nome.toLowerCase().includes(busca.toLowerCase()) || (r.nit ?? '').includes(busca)
  )

  const total    = rows.length
  const pagos    = rows.filter(r => r.status === 'Pago').length
  const pendentes = rows.filter(r => r.status === 'Pendente').length
  const totalGPS = rows.reduce((acc, r) => acc + (r.valor_gps ?? 0), 0)

  function abrirNovo() { setForm({ ...VAZIO }); setEditId(null) }
  function abrirEditar(r: InssPF) {
    setForm({
      nome: r.nome, nit: r.nit ?? '', cod_gps: r.cod_gps ?? '',
      aliquota: r.aliquota, categoria: r.categoria,
      salario: r.salario, valor_gps: r.valor_gps,
      competencia: r.competencia ?? mesAtual,
      vencimento: r.vencimento, envio: r.envio ?? '', status: r.status,
    })
    setEditId(r.id)
  }

  function onChangeSalario(val: string) {
    const s = val ? Number(val) : null
    setForm(f => f ? ({ ...f, salario: s, valor_gps: calcGPS(s, f.aliquota) }) : f)
  }
  function onChangeAliquota(val: string) {
    const a = val ? Number(val) : null
    setForm(f => f ? ({ ...f, aliquota: a, valor_gps: calcGPS(f.salario, a) }) : f)
  }

  async function salvar() {
    if (!form) return
    setSalvando(true)
    try {
      const payload = { ...form }
      if (editId) {
        const { error } = await (supabase.from('inss_pf') as any).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('inss_pf') as any).insert(payload)
        if (error) throw error
      }
      setForm(null); setEditId(null); carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este registro?')) return
    await (supabase.from('inss_pf') as any).delete().eq('id', id)
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
            <h1 className="text-xl font-bold text-brand-900">INSS PF</h1>
            <p className="text-xs text-brand-500 mt-0.5">Contribuinte Individual e Facultativo — Guias GPS</p>
          </div>
          <button onClick={abrirNovo} className="btn-primary"><Plus size={15} /> Nova GPS</button>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',         value: total,    color: 'bg-brand-50 border-brand-200 text-brand-700' },
            { label: 'Pagos',         value: pagos,    color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: 'Pendentes',     value: pendentes,color: 'bg-warning-50 border-warning-200 text-warning-700' },
            { label: 'Total GPS (R$)',value: fmtBRL(totalGPS), color: 'bg-blue-50 border-blue-200 text-blue-700' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.color}`}>
              <p className="text-2xl font-bold leading-tight">{c.value}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input className="input pl-9" placeholder="Buscar por nome ou NIT..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <input className="input w-32" placeholder="MM/YYYY" value={filtroComp} onChange={e => setFiltroComp(e.target.value)} />
          <select className="input w-36" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusInss | '')}>
            <option value="">Todos</option>
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
            <h2 className="font-semibold text-brand-900">{editId ? 'Editar INSS PF' : 'Nova GPS'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Nome</label>
                <input className="input" value={form.nome} onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="label">NIT</label>
                <input className="input font-mono" value={form.nit ?? ''} onChange={e => setForm(f => f && ({ ...f, nit: e.target.value }))} />
              </div>
              <div>
                <label className="label">Cód. GPS</label>
                <input className="input font-mono" value={form.cod_gps ?? ''} onChange={e => setForm(f => f && ({ ...f, cod_gps: e.target.value }))} />
              </div>
              <div>
                <label className="label">Categoria</label>
                <select className="input" value={form.categoria} onChange={e => setForm(f => f && ({ ...f, categoria: e.target.value as CategoriaInss }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Alíquota (%)</label>
                <select className="input" value={form.aliquota ?? ''} onChange={e => onChangeAliquota(e.target.value)}>
                  <option value="">—</option>
                  {ALIQUOTAS.map(a => <option key={a} value={a}>{a}%</option>)}
                  <option value="custom">Outra</option>
                </select>
              </div>
              <div>
                <label className="label">Salário/Base (R$)</label>
                <input className="input" type="number" step="0.01" value={form.salario ?? ''} onChange={e => onChangeSalario(e.target.value)} />
              </div>
              <div>
                <label className="label">Valor GPS (R$) <span className="text-brand-400 font-normal">— calculado</span></label>
                <input className="input bg-brand-50" type="number" step="0.01" value={form.valor_gps ?? ''} onChange={e => setForm(f => f && ({ ...f, valor_gps: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <label className="label">Competência (MM/YYYY)</label>
                <input className="input" placeholder="MM/YYYY" value={form.competencia ?? ''} onChange={e => setForm(f => f && ({ ...f, competencia: e.target.value }))} />
              </div>
              <div>
                <label className="label">Vencimento</label>
                <input className="input" type="date" value={form.vencimento ?? ''} onChange={e => setForm(f => f && ({ ...f, vencimento: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Envio</label>
                <input className="input" placeholder="Ex: WhatsApp, E-mail" value={form.envio ?? ''} onChange={e => setForm(f => f && ({ ...f, envio: e.target.value }))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => f && ({ ...f, status: e.target.value as StatusInss }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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
                  <ThSort k="nome"        label="Nome" />
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">NIT</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Cód. GPS</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">%</th>
                  <ThSort k="categoria"   label="Categoria" />
                  <ThSort k="valor_gps"   label="Salário" />
                  <ThSort k="valor_gps"   label="Valor GPS" />
                  <ThSort k="competencia" label="Competência" />
                  <ThSort k="vencimento"  label="Vencimento" />
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Envio</th>
                  <ThSort k="status"      label="Status" />
                  <th className="px-3 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {filtrado.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-12 text-brand-300 text-sm">Nenhum registro encontrado.</td></tr>
                ) : filtrado.map(r => (
                  <tr key={r.id} className="hover:bg-brand-50 group">
                    <td className="px-3 py-2.5 font-medium text-brand-900 whitespace-nowrap">{r.nome}</td>
                    <td className="px-3 py-2.5 text-brand-500 font-mono text-xs">{r.nit ?? '—'}</td>
                    <td className="px-3 py-2.5 text-brand-500 font-mono text-xs">{r.cod_gps ?? '—'}</td>
                    <td className="px-3 py-2.5 text-brand-600 text-xs">{r.aliquota != null ? `${r.aliquota}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-brand-600 whitespace-nowrap">{r.categoria}</td>
                    <td className="px-3 py-2.5 text-xs text-brand-600 whitespace-nowrap">{fmtBRL(r.salario)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-brand-800 whitespace-nowrap">{fmtBRL(r.valor_gps)}</td>
                    <td className="px-3 py-2.5 text-xs text-brand-500 font-mono">{r.competencia ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-brand-600">{fmtData(r.vencimento)}</td>
                    <td className="px-3 py-2.5 text-xs text-brand-400">{r.envio ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] ?? 'bg-brand-100 text-brand-600'}`}>
                        {r.status}
                      </span>
                    </td>
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
