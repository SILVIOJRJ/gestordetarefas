'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  Plus, Search, X, Pencil, Trash2, Loader2, AlertTriangle,
  ChevronUp, ChevronDown, Save, CheckCircle2, Circle, ArrowRight,
} from 'lucide-react'

type CategoriaInss = 'Facultativo' | 'Contribuinte Individual'
type StatusInss    = 'Pago' | 'Pendente'

interface InssPF {
  id: string
  nome: string
  nit: string | null
  codigo: string | null
  aliquota: number | null
  categoria: CategoriaInss | string
  salario: number | null
  valor: number | null
  competencia: string | null
  vencimento: string | null
  envio: string | null
  status: StatusInss | string
  enviado: boolean
  obs: string | null
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

type SortKey = 'nome' | 'categoria' | 'status' | 'vencimento' | 'valor' | 'competencia'
type SortDir = 'asc' | 'desc'

function mesAtualStr() {
  const n = new Date()
  return `${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`
}

function proximaCompetencia(comp: string): string {
  const [m, y] = comp.split('/').map(Number)
  if (m === 12) return `01/${y + 1}`
  return `${String(m + 1).padStart(2, '0')}/${y}`
}

function compToInputMonth(comp: string) {
  if (!comp) return ''
  const [m, y] = comp.split('/')
  return `${y}-${m}`
}
function inputMonthToComp(val: string) {
  if (!val) return ''
  const [y, m] = val.split('-')
  return `${m}/${y}`
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

const VAZIO = {
  nome: '', nit: '', codigo: '', aliquota: 11 as number | null,
  categoria: 'Facultativo' as CategoriaInss,
  salario: null as number | null, valor: null as number | null,
  competencia: mesAtualStr(), vencimento: null as string | null,
  envio: '', status: 'Pendente' as StatusInss, obs: '', enviado: false,
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
  const [avancando, setAvancando] = useState(false)

  // Na primeira carga, encontra a competência mais recente com dados
  useEffect(() => {
    ;(supabase.from('inss_pf') as any)
      .select('competencia')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { competencia: string } | null }) => {
        setFiltroComp(data?.competencia ?? mesAtualStr())
      })
  }, [])

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

  const total     = filtrado.length
  const pagos     = filtrado.filter(r => r.status === 'Pago').length
  const pendentes = filtrado.filter(r => r.status === 'Pendente').length
  const enviados  = filtrado.filter(r => r.enviado).length
  const totalGPS  = filtrado.reduce((acc, r) => acc + (r.valor ?? 0), 0)

  function abrirNovo() {
    setForm({ ...VAZIO, competencia: filtroComp || mesAtualStr() })
    setEditId(null)
  }

  function abrirEditar(r: InssPF) {
    setForm({
      nome: r.nome,
      nit: r.nit ?? '',
      codigo: r.codigo ?? '',
      aliquota: r.aliquota,
      categoria: r.categoria as CategoriaInss,
      salario: r.salario,
      valor: r.valor,
      competencia: r.competencia ?? mesAtualStr(),
      vencimento: r.vencimento,
      envio: r.envio ?? '',
      status: r.status as StatusInss,
      obs: r.obs ?? '',
      enviado: r.enviado,
    })
    setEditId(r.id)
  }

  function onChangeSalario(val: string) {
    const s = val ? Number(val) : null
    setForm(f => f ? ({ ...f, salario: s, valor: calcGPS(s, f.aliquota) }) : f)
  }
  function onChangeAliquota(val: string) {
    const a = val ? Number(val) : null
    setForm(f => f ? ({ ...f, aliquota: a, valor: calcGPS(f.salario, a) }) : f)
  }

  async function salvar() {
    if (!form || !form.nome.trim()) return
    setSalvando(true); setErro(null)
    try {
      const payload = {
        nome: form.nome, nit: form.nit || null, codigo: form.codigo || null,
        aliquota: form.aliquota, categoria: form.categoria,
        salario: form.salario, valor: form.valor,
        competencia: form.competencia, vencimento: form.vencimento || null,
        envio: form.envio || null, status: form.status,
        obs: form.obs || null, enviado: form.enviado,
      }
      if (editId) {
        const { error } = await (supabase.from('inss_pf') as any)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editId)
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

  async function toggleEnviado(r: InssPF) {
    const novoValor = !r.enviado
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, enviado: novoValor } : x))
    await (supabase.from('inss_pf') as any)
      .update({ enviado: novoValor, updated_at: new Date().toISOString() })
      .eq('id', r.id)
  }

  async function avancarCompetencia() {
    if (!filtroComp) return
    const proxComp = proximaCompetencia(filtroComp)
    if (!confirm(`Criar registros para ${proxComp} baseados em ${filtroComp}?`)) return
    setAvancando(true); setErro(null)
    try {
      const { data: atuais, error: errLer } = await (supabase.from('inss_pf') as any)
        .select('*').eq('competencia', filtroComp)
      if (errLer) throw errLer
      if (!atuais || atuais.length === 0) throw new Error('Nenhum registro na competência atual.')

      const novos = (atuais as InssPF[]).map(r => ({
        nome: r.nome, nit: r.nit, codigo: r.codigo,
        aliquota: r.aliquota != null ? Number(r.aliquota) : null,
        categoria: r.categoria,
        salario: r.salario != null ? Number(r.salario) : null,
        valor: r.valor != null ? Number(r.valor) : null,
        competencia: proxComp, vencimento: null, envio: null,
        status: 'Pendente', obs: null,
      }))
      const { error: errIns } = await (supabase.from('inss_pf') as any).insert(novos)
      if (errIns) throw errIns
      setFiltroComp(proxComp)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao avançar.') }
    finally { setAvancando(false) }
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
          <div className="flex gap-2">
            <button
              onClick={avancarCompetencia}
              disabled={avancando || !filtroComp}
              className="btn-secondary text-sm"
              title={`Criar registros para ${filtroComp ? proximaCompetencia(filtroComp) : 'próximo mês'}`}
            >
              {avancando ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              Avançar para {filtroComp ? proximaCompetencia(filtroComp) : '...'}
            </button>
            <button onClick={abrirNovo} className="btn-primary"><Plus size={15} /> Nova GPS</button>
          </div>
        </div>

        {/* Cards de resumo — refletem o filtro atual */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: total,                  color: 'bg-brand-50 border-brand-200 text-brand-700' },
            { label: 'Pagos',     value: pagos,                  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: 'Pendentes', value: pendentes,              color: 'bg-warning-50 border-warning-200 text-warning-700' },
            { label: 'Enviados',  value: `${enviados}/${total}`, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.color}`}>
              <p className="text-xl font-bold leading-tight">{c.value}</p>
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
          <input
            className="input w-40"
            type="month"
            value={compToInputMonth(filtroComp)}
            onChange={e => setFiltroComp(inputMonthToComp(e.target.value))}
          />
          <select className="input w-36" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusInss | '')}>
            <option value="">Todos status</option>
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
            <h2 className="font-semibold text-brand-900">{editId ? 'Editar GPS' : 'Nova GPS'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Nome Completo *</label>
                <input className="input" placeholder="Nome do contribuinte" value={form.nome}
                  onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="label">NIT / PIS</label>
                <input className="input font-mono" placeholder="000.00000.00-0" value={form.nit ?? ''}
                  onChange={e => setForm(f => f && ({ ...f, nit: e.target.value }))} />
              </div>
              <div>
                <label className="label">Código GPS</label>
                <input className="input font-mono" placeholder="1007, 1473..." value={form.codigo ?? ''}
                  onChange={e => setForm(f => f && ({ ...f, codigo: e.target.value }))} />
              </div>
              <div>
                <label className="label">Categoria *</label>
                <select className="input" value={form.categoria}
                  onChange={e => setForm(f => f && ({ ...f, categoria: e.target.value as CategoriaInss }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Alíquota</label>
                <select className="input" value={form.aliquota ?? ''} onChange={e => onChangeAliquota(e.target.value)}>
                  <option value="">—</option>
                  {ALIQUOTAS.map(a => <option key={a} value={a}>{a}%</option>)}
                </select>
              </div>
              <div>
                <label className="label">Salário Base (R$)</label>
                <input className="input" type="number" step="0.01" placeholder="0,00"
                  value={form.salario ?? ''} onChange={e => onChangeSalario(e.target.value)} />
              </div>
              <div>
                <label className="label">Valor GPS (R$) <span className="text-brand-400 font-normal">— calculado</span></label>
                <input className="input bg-brand-50" type="number" step="0.01"
                  value={form.valor ?? ''}
                  onChange={e => setForm(f => f && ({ ...f, valor: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <label className="label">Competência</label>
                <input className="input" type="month"
                  value={compToInputMonth(form.competencia ?? '')}
                  onChange={e => setForm(f => f && ({ ...f, competencia: inputMonthToComp(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Vencimento</label>
                <input className="input" type="date" value={form.vencimento ?? ''}
                  onChange={e => setForm(f => f && ({ ...f, vencimento: e.target.value || null }))} />
              </div>
              <div>
                <label className="label">Envio (WPP / E-mail)</label>
                <input className="input" placeholder="WPP - Nome..." value={form.envio ?? ''}
                  onChange={e => setForm(f => f && ({ ...f, envio: e.target.value }))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status}
                  onChange={e => setForm(f => f && ({ ...f, status: e.target.value as StatusInss }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="label">Observação</label>
                <input className="input" value={form.obs ?? ''}
                  onChange={e => setForm(f => f && ({ ...f, obs: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} className="btn-primary">
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
              </button>
              <button onClick={() => { setForm(null); setEditId(null) }} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {/* Tabela */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-300" /></div>
        ) : filtrado.length === 0 ? (
          <div className="text-center py-16 text-brand-300 text-sm">
            <p>Nenhum registro para {filtroComp || 'esta competência'}.</p>
            {filtroComp && (
              <p className="mt-1 text-xs">
                Use <strong>Avançar competência</strong> para criar registros do mês anterior, ou <strong>+ Nova GPS</strong>.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-200">
            <table className="w-full text-sm">
              <thead className="bg-brand-50">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center text-[11px] font-semibold uppercase text-brand-500">Env.</th>
                  <ThSort k="nome"        label="Nome" />
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">NIT</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Cód.</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">%</th>
                  <ThSort k="categoria"   label="Categoria" />
                  <ThSort k="valor"       label="Valor GPS" />
                  <ThSort k="vencimento"  label="Vencimento" />
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase text-brand-500">Envio</th>
                  <ThSort k="status"      label="Status" />
                  <th className="px-3 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {filtrado.map(r => (
                  <tr
                    key={r.id}
                    className={`group transition-all ${r.enviado ? 'opacity-50' : 'hover:bg-brand-50'}`}
                  >
                    {/* Botão Enviado */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggleEnviado(r)}
                        className="relative group/env"
                        title={r.enviado ? 'Marcar como não enviado' : 'Marcar como enviado'}
                      >
                        {r.enviado
                          ? <CheckCircle2 size={18} className="text-emerald-500" />
                          : <Circle size={18} className="text-brand-300 group-hover/env:text-emerald-400" />
                        }
                      </button>
                    </td>
                    <td className={`px-3 py-2.5 font-medium whitespace-nowrap ${r.enviado ? 'text-brand-400 line-through decoration-emerald-400' : 'text-brand-900'}`}>
                      {r.nome}
                    </td>
                    <td className="px-3 py-2.5 text-brand-500 font-mono text-xs">{r.nit ?? '—'}</td>
                    <td className="px-3 py-2.5 text-brand-500 font-mono text-xs">{r.codigo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-brand-600 text-xs">{r.aliquota != null ? `${r.aliquota}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-brand-600 whitespace-nowrap">{r.categoria}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-brand-800 whitespace-nowrap">{fmtBRL(r.valor)}</td>
                    <td className="px-3 py-2.5 text-xs text-brand-600">{fmtData(r.vencimento)}</td>
                    <td className="px-3 py-2.5 text-xs text-brand-400">{r.envio ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] ?? 'bg-brand-100 text-brand-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => abrirEditar(r)} className="p-1.5 rounded hover:bg-brand-100 text-brand-400 hover:text-brand-700">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluir(r.id)} className="p-1.5 rounded hover:bg-red-100 text-brand-300 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
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
