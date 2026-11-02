'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import { Loader2, Pencil, X, Save, ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

type Regime = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI' | string | null

interface ClienteRow {
  id: string
  nome: string
  regime?: Regime
}

interface ValoresGerenciais {
  id?: string
  cliente_id: string
  competencia: string   // YYYY-MM
  condicao: string
  fgts: number | null
  inss: number | null
  das: number | null
  irpj: number | null
  csll: number | null
  pis_cofins: number | null
  receita_servicos: number | null
  receita_vendas: number | null
  despesas_total: number | null
  folha_liquida: number | null
  caixa_atual: number | null
  fator_r: number | null
  obs: string | null
  atualizado_por: string | null
}

interface LinhaTabela extends ClienteRow {
  valores: ValoresGerenciais
}

// ─── Constantes ───────────────────────────────────────────────

const MESES_PT = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
]

const REGIME_BADGE: Record<string, string> = {
  'Simples Nacional': 'bg-emerald-100 text-emerald-700',
  'Lucro Presumido':  'bg-purple-100 text-purple-700',
  'Lucro Real':       'bg-rose-100 text-rose-700',
  'MEI':              'bg-blue-100 text-blue-700',
}

function n(v: number | null | undefined): number { return v ?? 0 }

function calcCaixa(v: ValoresGerenciais): number {
  const receitas  = n(v.receita_servicos) + n(v.receita_vendas)
  const encargos  = n(v.fgts) + n(v.inss) + n(v.das) + n(v.irpj) + n(v.csll) + n(v.pis_cofins)
  return receitas - encargos - n(v.despesas_total) - n(v.folha_liquida)
}

function fmt(v: number | null | undefined): string {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtR(v: number | null | undefined): string {
  if (!v) return '—'
  return v.toFixed(2).replace('.', ',')
}

function vazioValores(clienteId: string, competencia: string): ValoresGerenciais {
  return {
    cliente_id: clienteId, competencia, condicao: 'Normal',
    fgts: null, inss: null, das: null, irpj: null, csll: null,
    pis_cofins: null, receita_servicos: null, receita_vendas: null,
    despesas_total: null, folha_liquida: null, caixa_atual: null,
    fator_r: null, obs: null, atualizado_por: null,
  }
}

// ─── Campo moeda com formatação BRL ──────────────────────────

interface CurrencyInputProps {
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  placeholder?: string
  className?: string
}

function CurrencyInput({ value, onChange, step = 0.01, placeholder = '0,00', className = '' }: CurrencyInputProps) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  function handleFocus() {
    setEditing(true)
    setRaw(value != null ? String(value) : '')
  }

  function handleBlur() {
    setEditing(false)
    const parsed = raw === '' ? null : parseFloat(raw.replace(',', '.'))
    onChange(isNaN(parsed as number) ? null : parsed)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value)
  }

  const displayValue = editing
    ? raw
    : value != null
      ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ''

  return (
    <input
      type={editing ? 'number' : 'text'}
      step={step}
      min={0}
      className={`input text-sm ${className}`}
      placeholder={placeholder}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  )
}

// ─── Componente principal ─────────────────────────────────────

export default function GerencialPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [busca, setBusca] = useState('')

  const [linhas, setLinhas] = useState<LinhaTabela[]>([])
  const [loading, setLoading] = useState(true)
  const [erroClientes, setErroClientes] = useState<string | null>(null)

  const [modal, setModal] = useState<LinhaTabela | null>(null)
  const [form, setForm]   = useState<ValoresGerenciais | null>(null)
  const [saving, setSaving] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  const competencia = `${ano}-${String(mes).padStart(2, '0')}`

  const carregar = useCallback(async () => {
    setLoading(true)
    setErroClientes(null)

    // 1. Busca todos os clientes — captura erro para diagnóstico
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientes, error: erroQ } = await (supabase.from('clientes') as any)
      .select('id, nome')
      .order('nome')

    if (erroQ) {
      setErroClientes(`Erro ao buscar clientes: ${erroQ.message ?? JSON.stringify(erroQ)}`)
      setLinhas([])
      setLoading(false)
      return
    }

    // 2. Tenta buscar valores do mês — se a tabela ainda não tiver as colunas,
    //    a query falha mas não deve impedir a listagem de clientes
    let mapa: Record<string, ValoresGerenciais> = {}
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: valores, error } = await (supabase.from('gerencial_mensal') as any)
        .select('id, cliente_id, competencia, fgts, inss, das, irpj, csll, pis_cofins, receita_servicos, receita_vendas, despesas_total, folha_pagamento, caixa_atual, fator_r, obs, atualizado_por, condicao')
        .eq('competencia', competencia)

      if (!error) {
        for (const v of (valores ?? [])) {
          mapa[v.cliente_id] = {
            ...v,
            folha_liquida: v.folha_liquida ?? v.folha_pagamento ?? null,
          }
        }
      }
    } catch {
      // tabela ou colunas inexistentes — mostra clientes sem valores
    }

    // 3. Merge: todo cliente aparece, com ou sem valores no mês
    const rows: LinhaTabela[] = ((clientes ?? []) as ClienteRow[]).map(c => ({
      ...c,
      valores: mapa[c.id] ?? vazioValores(c.id, competencia),
    }))

    setLinhas(rows)
    setLoading(false)
  }, [competencia])

  useEffect(() => { carregar() }, [carregar])

  function abrirModal(linha: LinhaTabela) {
    setModal(linha)
    setForm({ ...linha.valores })
    setErroSalvar(null)
  }

  function fecharModal() {
    setModal(null)
    setForm(null)
  }

  function setF(k: keyof ValoresGerenciais, v: unknown) {
    setForm(f => f ? { ...f, [k]: v } : f)
  }

  const caixaCalc = form ? calcCaixa(form) : 0

  async function salvar() {
    if (!form) return
    setSaving(true)
    setErroSalvar(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        cliente_id:       form.cliente_id,
        competencia:      form.competencia,
        fgts:             form.fgts,
        inss:             form.inss,
        das:              form.das,
        irpj:             form.irpj,
        csll:             form.csll,
        pis_cofins:       form.pis_cofins,
        receita_servicos: form.receita_servicos,
        receita_vendas:   form.receita_vendas,
        despesas_total:   form.despesas_total,
        folha_pagamento:  form.folha_liquida,   // nome da coluna no banco
        caixa_atual:      caixaCalc,
        fator_r:          form.fator_r,
        obs:              form.obs,
        atualizado_por:   user?.email ?? 'sistema',
        updated_at:       new Date().toISOString(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = form.id
        ? (supabase.from('gerencial_mensal') as any).update(payload).eq('id', form.id).select('id').single()
        : (supabase.from('gerencial_mensal') as any).insert(payload).select('id').single()
      const { data, error } = await q
      if (error) throw error
      await carregar()
      fecharModal()
      if (!form.id && data?.id) setF('id', data.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message
        : (e as { message?: string })?.message
        ?? JSON.stringify(e)
      setErroSalvar(`Erro: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const linhasFiltradas = linhas.filter(l =>
    !busca || l.nome.toLowerCase().includes(busca.toLowerCase())
  )

  function navMes(dir: -1 | 1) {
    const novo = mes + dir
    if (novo < 1)  { setMes(12); setAno(a => a - 1) }
    else if (novo > 12) { setMes(1); setAno(a => a + 1) }
    else setMes(novo)
  }

  return (
    <Shell>
      <div className="space-y-4">

        {/* ── Header ──────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-brand-900">Planilha Gerencial</h1>
          <p className="text-sm text-brand-500">Valores financeiros por cliente e competência</p>
        </div>

        {/* ── Filtros ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Competência */}
          <div className="flex items-center gap-1 bg-white border border-brand-200 rounded-lg px-2 py-1.5">
            <button onClick={() => navMes(-1)} className="text-brand-400 hover:text-brand-700 p-0.5">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-brand-800 min-w-[160px] text-center capitalize">
              {MESES_PT[mes - 1]} de {ano}
            </span>
            <button onClick={() => navMes(1)} className="text-brand-400 hover:text-brand-700 p-0.5">
              <ChevronRight size={15} />
            </button>
          </div>
          {/* Busca */}
          <input
            className="input flex-1 min-w-[200px] text-sm"
            placeholder="Filtrar empresa..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* ── Erro de carregamento ─────────────────────────────── */}
        {erroClientes && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <strong>Erro ao carregar empresas:</strong> {erroClientes}
          </div>
        )}

        {/* ── Tabela ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-brand-100 overflow-x-auto">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 size={26} className="animate-spin text-brand-300" />
            </div>
          ) : (
            <table className="w-full text-xs min-w-[1200px]">
              <thead>
                <tr className="text-left text-[11px] text-brand-400 bg-brand-50 border-b border-brand-100">
                  {['REGIME','EMPRESA','CONDIÇÃO','FGTS','INSS','DAS','IRPJ','CSLL','PIS/COFINS',
                    'REC. SERVIÇOS','REC. VENDAS','DESPESAS','FOLHA LÍQUIDA','CAIXA','FATOR R','OBS','ATUALIZADO POR',''].map((h, i) => (
                    <th key={i} className={`px-2 py-2 font-semibold whitespace-nowrap ${i >= 3 && i <= 13 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas.map(l => {
                  const v = l.valores
                  const caixa = calcCaixa(v)
                  return (
                    <tr key={l.id} className="border-b border-brand-50 hover:bg-brand-50/60 transition-colors">
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${REGIME_BADGE[l.regime ?? ''] ?? 'bg-brand-100 text-brand-500'}`}>
                          {l.regime ?? 'N/D'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-semibold text-brand-800 whitespace-nowrap max-w-[160px] truncate">{l.nome}</td>
                      <td className="px-2 py-1.5 text-brand-500">{v.condicao ?? 'Normal'}</td>
                      <td className="px-2 py-1.5 text-right text-brand-600">{fmt(v.fgts)}</td>
                      <td className="px-2 py-1.5 text-right text-brand-600">{fmt(v.inss)}</td>
                      <td className="px-2 py-1.5 text-right text-brand-600">{fmt(v.das)}</td>
                      <td className="px-2 py-1.5 text-right text-brand-600">{fmt(v.irpj)}</td>
                      <td className="px-2 py-1.5 text-right text-brand-600">{fmt(v.csll)}</td>
                      <td className="px-2 py-1.5 text-right text-brand-600">{fmt(v.pis_cofins)}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-600 font-medium">{fmt(v.receita_servicos)}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-600 font-medium">{fmt(v.receita_vendas)}</td>
                      <td className="px-2 py-1.5 text-right text-red-500">{fmt(v.despesas_total)}</td>
                      <td className="px-2 py-1.5 text-right text-red-500">{fmt(v.folha_liquida)}</td>
                      <td className={`px-2 py-1.5 text-right font-bold ${caixa >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmt(caixa)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-brand-500">{fmtR(v.fator_r)}</td>
                      <td className="px-2 py-1.5 text-brand-400 max-w-[100px] truncate">{v.obs ?? ''}</td>
                      <td className="px-2 py-1.5 text-brand-300 text-[10px] whitespace-nowrap">{v.atualizado_por ?? ''}</td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => abrirModal(l)}
                          className="p-1 rounded hover:bg-brand-100 text-brand-400 hover:text-brand-700 transition-colors"
                          title="Editar valores"
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {linhasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={18} className="py-12 text-center text-brand-300 text-sm">
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal Valores Gerenciais ─────────────────────────── */}
      {modal && form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100">
              <div>
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wide">Valores Gerenciais</p>
                <h2 className="text-base font-bold text-brand-900">
                  {modal.nome} — <span className="capitalize">{MESES_PT[mes - 1]}/{ano}</span>
                </h2>
              </div>
              <button onClick={fecharModal} className="text-brand-400 hover:text-brand-700">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">

                {/* Coluna 1 */}
                <div className="space-y-3">
                  {([
                    ['fgts',            'FGTS'],
                    ['das',             'DAS'],
                    ['csll',            'CSLL'],
                    ['receita_servicos','RECEITA SERVIÇOS'],
                    ['despesas_total',  'DESPESAS TOTAL'],
                  ] as [keyof ValoresGerenciais, string][]).map(([k, label]) => (
                    <div key={k}>
                      <label className="input-label">{label}</label>
                      <CurrencyInput
                        value={form[k] as number | null}
                        onChange={v => setF(k, v)}
                      />
                    </div>
                  ))}
                  {/* Caixa Atual — read-only calculado */}
                  <div>
                    <label className="input-label">CAIXA ATUAL (calculado)</label>
                    <div className={`input text-sm font-bold bg-brand-50 cursor-default ${
                      caixaCalc >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {caixaCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Coluna 2 */}
                <div className="space-y-3">
                  {([
                    ['inss',           'INSS'],
                    ['irpj',           'IRPJ'],
                    ['pis_cofins',     'PIS/COFINS / ISS / ICMS'],
                    ['receita_vendas', 'RECEITA VENDAS'],
                    ['folha_liquida',  'FOLHA LÍQUIDA'],
                    ['fator_r',        'FATOR R'],
                  ] as [keyof ValoresGerenciais, string][]).map(([k, label]) => (
                    <div key={k}>
                      <label className="input-label">{label}</label>
                      <CurrencyInput
                        value={form[k] as number | null}
                        onChange={v => setF(k, v)}
                        step={k === 'fator_r' ? 0.0001 : 0.01}
                        placeholder={k === 'fator_r' ? '0,0000' : '0,00'}
                      />
                    </div>
                  ))}
                </div>

                {/* Observação — 2 colunas */}
                <div className="col-span-2">
                  <label className="input-label">OBSERVAÇÃO</label>
                  <textarea
                    rows={3}
                    className="input text-sm resize-none"
                    placeholder="Anotações sobre a competência..."
                    value={form.obs ?? ''}
                    onChange={e => setF('obs', e.target.value || null)}
                  />
                </div>

              </div>

              {erroSalvar && (
                <p className="text-sm text-red-600">{erroSalvar}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-brand-100">
              <button onClick={salvar} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Valores
              </button>
              <button onClick={fecharModal} className="btn-secondary">
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
