'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import { uploadDocumentoComIA } from '@/services/documents'
import {
  classificarLotePorDestino,
  type LancamentoClassificado,
} from '@/services/documents'
import {
  FileText, Upload, ChevronLeft, ChevronRight, Loader2,
  ArrowUpCircle, ArrowDownCircle, AlertTriangle, Check, X,
  RefreshCw, TrendingUp,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

type StatusRec = 'Recebido' | 'Pendente' | 'Inadimplente'

interface LinhaApuracao {
  clienteId: string
  nome: string
  regime: string | null
  honorarios: number
  adicionais: number
  statusRec: StatusRec
  obs: string
}

interface Lancamento {
  id: string
  tipo: 'entrada' | 'saida'
  valor: number
  descricao: string | null
  categoria: string | null
  cliente: string | null
  data: string
  forma: string | null
  auto_classificado?: boolean
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

// ─── Componente ───────────────────────────────────────────────

export default function ContabilPage() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())

  const [apuracao, setApuracao]           = useState<LinhaApuracao[]>([])
  const [lancamentos, setLancamentos]     = useState<Lancamento[]>([])
  const [loading, setLoading]             = useState(true)
  const [uploading, setUploading]         = useState(false)
  const [uploadResult, setUploadResult]   = useState<LancamentoClassificado[] | null>(null)
  const [uploadErro, setUploadErro]       = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: cData }, { data: lData }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('clientes') as any).select('id, nome, regime, contratos(valor_mensal, status, descricao)').order('nome'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('lancamentos_financeiros') as any)
          .select('*')
          .eq('mes', mes)
          .eq('ano', ano)
          .order('data', { ascending: false }),
      ])

      const clientes = (cData ?? []) as Array<{
        id: string; nome: string; regime: string | null
        contratos: Array<{ valor_mensal: number | null; status: string; descricao: string | null }>
      }>

      const linhas: LinhaApuracao[] = clientes.map(c => {
        const ativos = (c.contratos ?? []).filter(ct => ct.status === 'ativo')
        const honorarios = ativos.reduce((s, ct) => s + (ct.valor_mensal ?? 0), 0)

        let adicionais = 0
        for (const ct of ativos) {
          if (ct.descricao) {
            try {
              const p = JSON.parse(ct.descricao)
              if (typeof p.adicional === 'number') adicionais += p.adicional
            } catch { /* não é JSON */ }
          }
        }

        return {
          clienteId: c.id,
          nome: c.nome,
          regime: c.regime,
          honorarios,
          adicionais,
          statusRec: 'Pendente',
          obs: '',
        }
      })

      setApuracao(linhas)
      setLancamentos((lData ?? []) as Lancamento[])
    } finally {
      setLoading(false)
    }
  }, [mes, ano])

  useEffect(() => { carregar() }, [carregar])

  function setStatus(clienteId: string, val: StatusRec) {
    setApuracao(a => a.map(l => l.clienteId === clienteId ? { ...l, statusRec: val } : l))
  }
  function setObs(clienteId: string, val: string) {
    setApuracao(a => a.map(l => l.clienteId === clienteId ? { ...l, obs: val } : l))
  }

  // ── Upload em lote com IA ─────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setUploadErro(null)
    setUploadResult(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      const resultados: LancamentoClassificado[] = []
      for (const file of files) {
        try {
          const r = await uploadDocumentoComIA(file, 'escritorio', user.id)
          resultados.push(...classificarLotePorDestino([r.dados]))
        } catch (err) {
          resultados.push({
            origem: file.name,
            destino: 'IGNORADO',
            descricao: `Erro: ${err instanceof Error ? err.message : 'falha'}`,
            valor: null,
            tipo: 'entrada',
            categoria: 'Outros',
          })
        }
      }
      setUploadResult(resultados)

      // Salva automaticamente os classificados como lançamentos
      const lancParaSalvar = resultados.filter(r => r.destino !== 'IGNORADO' && r.valor)
      if (lancParaSalvar.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('lancamentos_financeiros') as any).insert(
          lancParaSalvar.map(l => ({
            tipo:        l.tipo,
            valor:       l.valor,
            descricao:   l.descricao,
            categoria:   l.categoria,
            cliente:     l.cliente ?? null,
            data:        new Date().toISOString().slice(0, 10),
            forma:       'Auto-IA',
            mes,
            ano,
            auto_classificado: true,
          }))
        )
        carregar()
      }
    } catch (err) {
      setUploadErro(err instanceof Error ? err.message : 'Erro no upload.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // ── Totais ───────────────────────────────────────────────────
  const totalHonorarios = apuracao.reduce((s, a) => s + a.honorarios, 0)
  const totalAdicionais  = apuracao.reduce((s, a) => s + a.adicionais, 0)
  const totalFaturado    = totalHonorarios + totalAdicionais
  const entradas         = lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
  const saidas           = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0)
  const saldo            = entradas - saidas
  const inadimplentes    = apuracao.filter(a => a.statusRec === 'Inadimplente').length

  return (
    <Shell>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={22} className="text-emerald-600" />
              <h1 className="text-xl font-bold text-brand-900">Departamento Contábil</h1>
            </div>
            <p className="text-sm text-brand-500 mt-0.5">Apuração mensal de caixa, DRE por cliente e conciliação contábil</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { if (mes === 1) { setMes(12); setAno(a => a - 1) } else setMes(m => m - 1) }} className="btn-secondary px-2">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-brand-700 min-w-[90px] text-center">
              {MESES[mes - 1]} / {ano}
            </span>
            <button onClick={() => { if (mes === 12) { setMes(1); setAno(a => a + 1) } else setMes(m => m + 1) }} className="btn-secondary px-2">
              <ChevronRight size={16} />
            </button>
            <button onClick={carregar} disabled={loading} className="btn-secondary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          </div>
        </div>

        {/* ── KPIs ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Faturamento Previsto', value: fmt(totalFaturado), color: 'text-brand-800', sub: `${apuracao.filter(a => a.honorarios > 0).length} contratos ativos` },
            { label: 'Entradas no mês', value: fmt(entradas), color: 'text-emerald-600', sub: `Saldo líquido: ${fmt(saldo)}` },
            { label: 'Saídas no mês', value: fmt(saidas), color: 'text-red-500', sub: `${lancamentos.filter(l => l.tipo === 'saida').length} lançamentos` },
            { label: 'Inadimplentes', value: String(inadimplentes), color: inadimplentes > 0 ? 'text-red-600' : 'text-emerald-600', sub: inadimplentes > 0 ? 'Verificar cobrança' : 'Situação normal' },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="card py-4 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-brand-500 mt-0.5">{label}</p>
              <p className="text-[10px] text-brand-300 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Upload IA ────────────────────────────────────────── */}
        <div className="card border-dashed border-2 border-brand-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-700">Triagem Inteligente de Comprovantes</p>
              <p className="text-xs text-brand-400 mt-0.5">Envie PDFs/imagens em lote — a IA classifica e lança automaticamente no fluxo de caixa</p>
            </div>
            <label className={`btn-primary cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Processando...' : 'Enviar Comprovantes'}
              <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
            </label>
          </div>

          {uploadErro && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle size={14} /> {uploadErro}
            </div>
          )}

          {uploadResult && uploadResult.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">Resultado da Triagem IA</p>
              {uploadResult.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 text-xs px-3 py-1.5 rounded-lg ${
                  r.destino === 'IGNORADO' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {r.destino === 'IGNORADO'
                    ? <X size={13} />
                    : <Check size={13} />
                  }
                  <span className="font-medium truncate max-w-[200px]">{r.origem}</span>
                  <span className="text-brand-400">→</span>
                  <span>{r.descricao}</span>
                  {r.valor && <span className="ml-auto font-semibold">{fmt(r.valor)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tabela DRE por Cliente ─────────────────────────── */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-brand-700">Apuração de Honorários — {MESES[mes - 1]}/{ano}</h2>
          </div>
          {loading ? (
            <div className="py-10 text-center"><Loader2 size={24} className="animate-spin text-brand-300 mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-left text-xs text-brand-400 bg-brand-50/60 border-b border-brand-100">
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Regime</th>
                    <th className="px-3 py-2 font-medium text-right">Honorários</th>
                    <th className="px-3 py-2 font-medium text-right">Adicionais</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {apuracao.filter(a => a.honorarios > 0 || a.adicionais > 0).map(a => (
                    <tr key={a.clienteId} className="border-b border-brand-50 hover:bg-brand-50/40">
                      <td className="px-4 py-2 text-sm font-medium text-brand-800">{a.nome}</td>
                      <td className="px-3 py-2 text-xs text-brand-400">{a.regime ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-xs text-brand-600">{fmt(a.honorarios)}</td>
                      <td className="px-3 py-2 text-right text-xs text-amber-600">
                        {a.adicionais > 0 ? fmt(a.adicionais) : <span className="text-brand-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-brand-800">{fmt(a.honorarios + a.adicionais)}</td>
                      <td className="px-3 py-2">
                        <select
                          value={a.statusRec}
                          onChange={e => setStatus(a.clienteId, e.target.value as StatusRec)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${
                            a.statusRec === 'Recebido'     ? 'bg-emerald-100 text-emerald-700'
                            : a.statusRec === 'Pendente'  ? 'bg-amber-100 text-amber-700'
                            : 'bg-danger-100 text-danger-700'
                          }`}
                        >
                          <option value="Recebido">Recebido</option>
                          <option value="Pendente">Pendente</option>
                          <option value="Inadimplente">Inadimplente</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-full text-xs border border-brand-100 rounded px-1.5 py-0.5 bg-transparent"
                          placeholder="Observação..."
                          value={a.obs}
                          onChange={e => setObs(a.clienteId, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-50 border-t-2 border-brand-200 text-xs font-bold">
                    <td className="px-4 py-2 text-brand-600" colSpan={2}>Total Geral</td>
                    <td className="px-3 py-2 text-right text-brand-800">{fmt(totalHonorarios)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">{fmt(totalAdicionais)}</td>
                    <td className="px-3 py-2 text-right text-brand-800">{fmt(totalFaturado)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── Fluxo de Caixa ────────────────────────────────── */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-700">Fluxo de Caixa — {MESES[mes - 1]}/{ano}</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-600"><ArrowUpCircle size={12} /> {fmt(entradas)}</span>
              <span className="flex items-center gap-1 text-red-500"><ArrowDownCircle size={12} /> {fmt(saidas)}</span>
              <span className={`font-bold ${saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                Saldo: {fmt(saldo)}
              </span>
            </div>
          </div>
          {lancamentos.length === 0 ? (
            <div className="py-8 text-center text-brand-300 text-sm">
              Nenhum lançamento registrado. Use &ldquo;Enviar Comprovantes&rdquo; acima ou acesse <span className="font-medium">/gerencial</span> para lançar manualmente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-left text-xs text-brand-400 bg-brand-50/60 border-b border-brand-100">
                    <th className="px-4 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium">Categoria</th>
                    <th className="px-3 py-2 font-medium">Forma</th>
                    {/* auto-IA badge */}
                    <th className="px-3 py-2 font-medium">Origem</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map(l => (
                    <tr key={l.id} className="border-b border-brand-50 hover:bg-brand-50/40">
                      <td className="px-4 py-2 text-xs text-brand-500 whitespace-nowrap">
                        {new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 text-xs text-brand-700">{l.descricao ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-brand-400">{l.categoria ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-brand-400">{l.forma ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {l.auto_classificado
                          ? <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-[10px] font-medium">IA</span>
                          : <span className="text-brand-300">Manual</span>
                        }
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold text-xs ${l.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {l.tipo === 'saida' ? '−' : '+'}{fmt(l.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Shell>
  )
}
