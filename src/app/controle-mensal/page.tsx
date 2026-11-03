'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import { Loader2, X, Save, Truck } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

type StatusObrigacao = 'Pendente' | 'Em andamento' | 'Concluído'

type SetorControle =
  | 'ACOMPANHAMENTO'
  | 'CERTIFICADO DIGITAL'
  | 'CONTÁBIL'
  | 'DP'
  | 'FISCAL'
  | 'LEGALIZAÇÃO'
  | 'OFFICE BOY'

interface ClienteRow {
  id: string
  nome: string
  regime?: string | null
}

interface ObrigacaoCell {
  id?: string
  cliente_id: string
  competencia: string
  setor: SetorControle
  obrigacao: string
  status: StatusObrigacao
  valor: number | null
  observacao: string | null
}

interface ModalState {
  cliente: ClienteRow
  coluna: string
  cell: ObrigacaoCell
}

const MESES_PT = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
]

const SETORES: SetorControle[] = [
  'ACOMPANHAMENTO','CERTIFICADO DIGITAL','CONTÁBIL','DP','FISCAL','LEGALIZAÇÃO','OFFICE BOY',
]

// Colunas dinâmicas por setor
const COLUNAS_POR_SETOR: Record<SetorControle, string[]> = {
  'ACOMPANHAMENTO':     ['GUIAS PAGAS', 'DECLARAÇÕES', 'CONTATO', 'OBS'],
  'CERTIFICADO DIGITAL':['VENCIMENTO CERTIFICADO DIGITAL', 'OBS'],
  'CONTÁBIL':           ['BALANCETE', 'DRE', 'ECF', 'ECD', 'OBS'],
  'DP':                 ['HOLERITES', 'FOLHA LÍQUIDA', 'INSS', 'IRRF', 'DCTFWEB', 'FGTS', 'OBS'],
  'FISCAL':             ['DCTF', 'SPED FISCAL', 'GIA', 'PGDAS', 'OBS'],
  'LEGALIZAÇÃO':        ['ALVARÁ', 'CONTRATO SOCIAL', 'JUNTA', 'OBS'],
  'OFFICE BOY':         ['ENTREGA', 'PROTOCOLO', 'RETORNO', 'OBS'],
}

const STATUS_STYLE: Record<StatusObrigacao, string> = {
  'Pendente':      'bg-amber-100 text-amber-700 border-amber-200',
  'Em andamento':  'bg-blue-100 text-blue-700 border-blue-200',
  'Concluído':     'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const REGIME_BADGE: Record<string, string> = {
  'Simples Nacional': 'bg-emerald-100 text-emerald-700',
  'Lucro Presumido':  'bg-purple-100 text-purple-700',
  'Lucro Real':       'bg-rose-100 text-rose-700',
  'MEI':              'bg-blue-100 text-blue-700',
}

function vazio(clienteId: string, competencia: string, setor: SetorControle, obrigacao: string): ObrigacaoCell {
  return { cliente_id: clienteId, competencia, setor, obrigacao, status: 'Pendente', valor: null, observacao: null }
}

// ─── Componente ───────────────────────────────────────────────

export default function ControleMensalPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [setor, setSetor] = useState<SetorControle>('CONTÁBIL')
  const [busca, setBusca] = useState('')

  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [cells, setCells]       = useState<Map<string, ObrigacaoCell>>(new Map())
  const [loading, setLoading]   = useState(true)

  const [modal, setModal]       = useState<ModalState | null>(null)
  const [formModal, setFormModal] = useState<ObrigacaoCell | null>(null)
  const [officeboy, setOfficeboy] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  const competencia = `${ano}-${String(mes).padStart(2, '0')}`
  const colunas = COLUNAS_POR_SETOR[setor]

  function cellKey(clienteId: string, obrigacao: string) {
    return `${clienteId}:${obrigacao}`
  }

  const carregar = useCallback(async () => {
    setLoading(true)

    // 1. Busca todos os clientes — sempre renderiza a grade completa
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cData } = await (supabase.from('clientes') as any)
      .select('id, nome, regime')
      .order('nome')

    setClientes((cData ?? []) as ClienteRow[])

    // 2. Tenta buscar obrigações do mês/setor — falha silenciosa se tabela não existir ainda
    const novaMapa = new Map<string, ObrigacaoCell>()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: oData, error } = await (supabase.from('controle_mensal_obrigacoes') as any)
        .select('id, cliente_id, competencia, setor, obrigacao, status, valor, observacao')
        .eq('competencia', competencia)
        .eq('setor', setor)

      if (!error) {
        for (const o of (oData ?? [])) {
          novaMapa.set(cellKey(o.cliente_id, o.obrigacao), o as ObrigacaoCell)
        }
      }
    } catch {
      // tabela ainda não existe no banco — mostra clientes com status Pendente
    }

    setCells(novaMapa)
    setLoading(false)
  }, [competencia, setor])

  useEffect(() => { carregar() }, [carregar])

  function abrirModal(cliente: ClienteRow, coluna: string) {
    const key = cellKey(cliente.id, coluna)
    const cell = cells.get(key) ?? vazio(cliente.id, competencia, setor, coluna)
    setModal({ cliente, coluna, cell })
    setFormModal({ ...cell })
    setOfficeboy(false)
    setErroSalvar(null)
  }

  function fecharModal() { setModal(null); setFormModal(null) }

  function setF(k: keyof ObrigacaoCell, v: unknown) {
    setFormModal(f => f ? { ...f, [k]: v } : f)
  }

  async function salvar() {
    if (!formModal || !modal) return
    setSaving(true)
    setErroSalvar(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        cliente_id:   formModal.cliente_id,
        competencia:  formModal.competencia,
        setor:        formModal.setor,
        obrigacao:    formModal.obrigacao,
        status:       formModal.status,
        valor:        formModal.valor,
        observacao:   formModal.observacao,
        atualizado_por: user?.email ?? 'sistema',
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = formModal.id
        ? (supabase.from('controle_mensal_obrigacoes') as any).update(payload).eq('id', formModal.id).select('id').single()
        : (supabase.from('controle_mensal_obrigacoes') as any).insert(payload).select('id').single()
      const { data, error } = await q
      if (error) throw error

      // Gatilho Office Boy
      if (officeboy) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('tarefas') as any).insert({
          titulo:      `Entrega: ${formModal.obrigacao} - ${modal.cliente.nome}`,
          setor:       'Office Boy',
          status:      'Pendente',
          descricao:   `Gerado automaticamente pelo Controle Mensal — ${MESES_PT[mes-1]}/${ano}`,
          criado_por:  user?.id ?? null,
        })
      }

      // Atualiza mapa local
      const key = cellKey(formModal.cliente_id, formModal.obrigacao)
      setCells(m => {
        const nova = new Map(m)
        nova.set(key, { ...formModal, id: data?.id ?? formModal.id })
        return nova
      })
      fecharModal()
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  function navMes(dir: -1 | 1) {
    const novo = mes + dir
    if (novo < 1)   { setMes(12); setAno(a => a - 1) }
    else if (novo > 12) { setMes(1); setAno(a => a + 1) }
    else setMes(novo)
  }

  const clientesFiltrados = clientes.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <Shell>
      <div className="space-y-4">

        {/* ── Header ──────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-brand-900">Controle Mensal</h1>
          <p className="text-sm text-brand-500">Acompanhamento de obrigações por competência e setor</p>
        </div>

        {/* ── Filtros ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Competência */}
          <div className="flex items-center gap-1 bg-white border border-brand-200 rounded-lg px-2 py-1.5">
            <button onClick={() => navMes(-1)} className="text-brand-400 hover:text-brand-700 px-0.5">‹</button>
            <span className="text-sm font-semibold text-brand-800 min-w-[150px] text-center capitalize">
              {MESES_PT[mes - 1]} de {ano}
            </span>
            <button onClick={() => navMes(1)} className="text-brand-400 hover:text-brand-700 px-0.5">›</button>
          </div>
          {/* Setor */}
          <select
            className="input w-auto text-sm font-semibold"
            value={setor}
            onChange={e => setSetor(e.target.value as SetorControle)}
          >
            {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Busca */}
          <input
            className="input flex-1 min-w-[180px] text-sm"
            placeholder="Filtrar empresa..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* ── Tabela ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-brand-100 overflow-x-auto">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 size={26} className="animate-spin text-brand-300" />
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] text-brand-400 bg-brand-50 border-b border-brand-100">
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">REGIME</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">EMPRESA</th>
                  <th className="px-3 py-2 font-semibold whitespace-nowrap">CONDIÇÃO</th>
                  {colunas.map(col => (
                    <th key={col} className="px-2 py-2 font-semibold whitespace-nowrap text-center">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map(c => (
                  <tr key={c.id} className="border-b border-brand-50 hover:bg-brand-50/50 transition-colors">
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${REGIME_BADGE[c.regime ?? ''] ?? 'bg-brand-100 text-brand-500'}`}>
                        {c.regime ?? 'N/D'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-brand-800 whitespace-nowrap max-w-[160px] truncate">{c.nome}</td>
                    <td className="px-3 py-1.5 text-brand-400">Normal</td>
                    {colunas.map(col => {
                      const cell = cells.get(cellKey(c.id, col))
                      const status: StatusObrigacao = cell?.status ?? 'Pendente'
                      const isObs = col === 'OBS'
                      return (
                        <td key={col} className="px-2 py-1.5 text-center">
                          {isObs ? (
                            <button
                              onClick={() => abrirModal(c, col)}
                              className="text-brand-300 hover:text-brand-600 text-[10px] underline-offset-2 hover:underline max-w-[80px] truncate block mx-auto"
                            >
                              {cell?.observacao ? cell.observacao.slice(0, 15) + '…' : '—'}
                            </button>
                          ) : col === 'VENCIMENTO CERTIFICADO DIGITAL' ? (
                            <button
                              onClick={() => abrirModal(c, col)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${
                                cell?.observacao
                                  ? (() => {
                                      const d = new Date(cell.observacao + 'T00:00:00')
                                      const diff = (d.getTime() - Date.now()) / 86400000
                                      return diff < 0 ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                             diff < 30 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                             'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    })()
                                  : STATUS_STYLE[status]
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                              {cell?.observacao?.match(/^\d{4}-\d{2}-\d{2}$/)
                                ? new Date(cell.observacao + 'T00:00:00').toLocaleDateString('pt-BR')
                                : (cell?.observacao ?? status)}
                            </button>
                          ) : (
                            <button
                              onClick={() => abrirModal(c, col)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${STATUS_STYLE[status]}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                              {status}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {clientesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={3 + colunas.length} className="py-12 text-center text-brand-300 text-sm">
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal de Baixa ──────────────────────────────────── */}
      {modal && formModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-brand-100">
              <div>
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wide">{modal.coluna}</p>
                <h2 className="text-base font-bold text-brand-900 leading-tight mt-0.5">
                  {modal.cliente.nome}
                </h2>
                <p className="text-xs text-brand-400 capitalize mt-0.5">{MESES_PT[mes-1]}/{ano}</p>
              </div>
              <button onClick={fecharModal} className="text-brand-400 hover:text-brand-700 mt-0.5">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="input-label">STATUS</label>
                <select
                  className="input text-sm"
                  value={formModal.status}
                  onChange={e => setF('status', e.target.value as StatusObrigacao)}
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Em andamento">Em andamento</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>

              {modal.coluna === 'VENCIMENTO CERTIFICADO DIGITAL' ? (
                <div>
                  <label className="input-label">DATA DE VENCIMENTO</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={formModal.observacao?.match(/^\d{4}-\d{2}-\d{2}$/) ? formModal.observacao : ''}
                    onChange={e => setF('observacao', e.target.value || null)}
                  />
                  {formModal.observacao && !formModal.observacao.match(/^\d{4}-\d{2}-\d{2}$/) && (
                    <p className="text-xs text-brand-400 mt-1">Atual: {formModal.observacao}</p>
                  )}
                </div>
              ) : modal.coluna !== 'OBS' && (
                <div>
                  <label className="input-label">VALOR (R$) — opcional</label>
                  <input
                    type="number" min={0} step={0.01} className="input text-sm"
                    placeholder="0,00"
                    value={formModal.valor ?? ''}
                    onChange={e => setF('valor', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              )}

              <div>
                <label className="input-label">OBSERVAÇÃO</label>
                <textarea
                  rows={3}
                  className="input text-sm resize-none"
                  placeholder="Anotações..."
                  value={formModal.observacao ?? ''}
                  onChange={e => setF('observacao', e.target.value || null)}
                />
              </div>

              {/* Checkbox Office Boy */}
              <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-brand-200 cursor-pointer hover:border-brand-400 transition-colors">
                <input
                  type="checkbox"
                  checked={officeboy}
                  onChange={e => setOfficeboy(e.target.checked)}
                  className="w-4 h-4 accent-accent-500"
                />
                <Truck size={16} className="text-brand-500 flex-shrink-0" />
                <span className="text-sm font-medium text-brand-700">
                  ENVIAR PARA OFFICE BOY (ENTREGA PRESENCIAL)
                </span>
              </label>

              {erroSalvar && (
                <p className="text-sm text-red-600">{erroSalvar}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-brand-100">
              <button onClick={salvar} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
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
