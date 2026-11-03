'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Shell from '@/components/layout/Shell'
import {
  uploadDocumentoComIA, obterUrlSegura,
  listarHistoricoUploads, type AnexoHistorico,
} from '@/services/documents'
import { gerarMensagemNotificacaoWhatsApp } from '@/lib/gemini'
import type { DadosDocumentoExtraidos } from '@/lib/gemini'
import { supabase } from '@/lib/supabase'
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  MessageCircle, ExternalLink, Trash2, X, Search,
  Sparkles, RefreshCw, Clock,
} from 'lucide-react'

interface DocumentoProcessado {
  id: string
  nome: string
  caminho: string
  dados: DadosDocumentoExtraidos
  alocado: boolean
  alocacaoDetalhes: string[]
  telefonePara?: string
  enviandoWpp?: boolean
}

const TIPOS_ACEITOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/xml',
  'application/xml',
  'application/x-ofx',
  'text/x-ofx',
]

const MIME_ACEITOS_STR = '.pdf,.jpg,.jpeg,.png,.webp,.xml,.ofx'
const MAX_SIZE_MB = 20

const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const STATUS_STYLE: Record<string, string> = {
  'Processado com IA': 'bg-emerald-100 text-emerald-700',
  'Pendente':          'bg-amber-100 text-amber-700',
  'Erro':              'bg-red-100 text-red-700',
}

function fmtData(ts: string) {
  try { return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return ts }
}

export default function DocumentosPage() {
  const now = new Date()
  const [mes, setMes]                     = useState(now.getMonth() + 1)
  const [ano, setAno]                     = useState(now.getFullYear())
  const [clienteId, setClienteId]         = useState('')
  const [clientes, setClientes]           = useState<Array<{ id: string; nome: string; telefone: string | null }>>([])
  const [dragging, setDragging]           = useState(false)
  const [processando, setProcessando]     = useState(false)
  const [progresso, setProgresso]         = useState<string | null>(null)
  const [erro, setErro]                   = useState<string | null>(null)
  const [docs, setDocs]                   = useState<DocumentoProcessado[]>([])
  const [busca, setBusca]                 = useState('')
  const [historico, setHistorico]         = useState<AnexoHistorico[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const competencia = `${ano}-${String(mes).padStart(2, '0')}`

  useEffect(() => {
    supabase.from('clientes').select('id, nome, telefone').order('nome').then(({ data }) => {
      setClientes(data ?? [])
    })
    carregarHistorico()
  }, [])

  async function carregarHistorico() {
    setLoadingHistorico(true)
    const dados = await listarHistoricoUploads(50)
    setHistorico(dados)
    setLoadingHistorico(false)
  }

  const clienteSelecionado = clientes.find((c) => c.id === clienteId)

  // OFX/XML enviados como text/plain por alguns browsers — aceita tudo
  function validarArquivo(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const tipoOk = TIPOS_ACEITOS.includes(f.type) || ['xml', 'ofx'].includes(ext)
    const tamanhoOk = f.size <= MAX_SIZE_MB * 1024 * 1024
    return tipoOk && tamanhoOk
  }

  async function processarArquivos(arquivos: File[]) {
    if (!clienteId) { setErro('Selecione um cliente antes de enviar.'); return }
    const invalidos = arquivos.filter((f) => !validarArquivo(f))
    if (invalidos.length) {
      setErro(`Arquivos rejeitados: ${invalidos.map((f) => f.name).join(', ')} (verifique tipo e tamanho máx. ${MAX_SIZE_MB}MB)`)
      return
    }

    setProcessando(true)
    setErro(null)
    const { data: { user } } = await supabase.auth.getUser()
    const criadoPor = user?.email ?? user?.id ?? 'desconhecido'

    for (const arquivo of arquivos) {
      setProgresso(`Analisando "${arquivo.name}" com Gemini...`)
      try {
        const resultado = await uploadDocumentoComIA(arquivo, clienteId, criadoPor, competencia)
        setDocs((prev) => [{
          id:              resultado.anexoId,
          nome:            arquivo.name,
          caminho:         resultado.caminho,
          dados:           resultado.dados,
          alocado:         resultado.alocado,
          alocacaoDetalhes: resultado.alocacaoDetalhes,
        }, ...prev])
      } catch (e) {
        setErro(`Erro em "${arquivo.name}": ${e instanceof Error ? e.message : 'Falha desconhecida'}`)
      }
    }

    setProgresso(null)
    setProcessando(false)
    carregarHistorico()
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    processarArquivos(Array.from(e.dataTransfer.files))
  }, [clienteId, competencia]) // eslint-disable-line react-hooks/exhaustive-deps

  async function enviarWhatsApp(doc: DocumentoProcessado) {
    setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, enviandoWpp: true } : d))
    try {
      const urlSegura = await obterUrlSegura(doc.caminho, 300)
      const mensagem  = gerarMensagemNotificacaoWhatsApp(doc.dados, urlSegura)
      const telefone  = (doc.telefonePara ?? clienteSelecionado?.telefone ?? '').replace(/\D/g, '')
      if (!telefone) throw new Error('Telefone não informado.')
      window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar link WhatsApp.')
    } finally {
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, enviandoWpp: false } : d))
    }
  }

  function atualizarTelefone(id: string, tel: string) {
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, telefonePara: tel } : d))
  }

  function removerDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  const docsFiltrados = docs.filter((d) =>
    d.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (d.dados.razao_social_ou_nome ?? '').toLowerCase().includes(busca.toLowerCase()),
  )

  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? id

  return (
    <Shell>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Cabeçalho ──────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Documentos &amp; Upload Inteligente</h1>
          <p className="text-sm text-brand-500 mt-0.5">
            Envio de lotes, triagem por OCR e alocação automática nos módulos Gerencial e Controle Mensal.
          </p>
        </div>

        {/* ── Seleção de cliente + competência ───────────────── */}
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="input-label">CLIENTE / EMPRESA</label>
              <select className="input w-full" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Selecione para habilitar o upload...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="input-label">COMPETÊNCIA</label>
              <div className="flex gap-2">
                <select
                  className="input flex-1 text-sm"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                >
                  {MESES_PT.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <input
                  type="number"
                  className="input w-20 text-sm"
                  value={ano}
                  min={2020}
                  max={2040}
                  onChange={(e) => setAno(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {clienteSelecionado?.telefone && (
            <p className="text-xs text-accent-700 flex items-center gap-1 mt-2">
              <MessageCircle size={12} /> {clienteSelecionado.telefone}
            </p>
          )}
        </div>

        {/* ── Erro ───────────────────────────────────────────── */}
        {erro && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-100 px-3 py-2.5 rounded-lg">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">{erro}</span>
            <button onClick={() => setErro(null)}><X size={14} /></button>
          </div>
        )}

        {/* ── Drag & Drop ────────────────────────────────────── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !processando && clienteId && inputRef.current?.click()}
          className={[
            'border-2 border-dashed rounded-xl p-10 text-center transition-all',
            dragging && clienteId
              ? 'border-accent-500 bg-accent-50'
              : clienteId
              ? 'border-brand-300 bg-white hover:border-brand-500 hover:bg-brand-50 cursor-pointer'
              : 'border-brand-200 bg-brand-50 opacity-50 cursor-not-allowed',
          ].join(' ')}
        >
          {processando ? (
            <div className="flex flex-col items-center gap-3 text-brand-500">
              <Loader2 size={36} className="animate-spin text-accent-500" />
              <p className="text-sm font-medium">{progresso}</p>
              <p className="text-xs text-brand-400">Classificando tipo, extraindo campos e alocando valores...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-brand-400">
              <Upload size={36} />
              <div>
                <p className="text-sm font-medium text-brand-700">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
                <p className="text-xs mt-1">PDF, JPG, PNG, WEBP, XML, OFX — até {MAX_SIZE_MB}MB por arquivo</p>
                <p className="text-xs mt-0.5 text-accent-600">
                  Competência: <strong>{MESES_PT[mes - 1]}/{ano}</strong>
                  {clienteSelecionado ? ` · Cliente: ${clienteSelecionado.nome}` : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={MIME_ACEITOS_STR}
          multiple
          className="hidden"
          onChange={(e) => processarArquivos(Array.from(e.target.files ?? []))}
        />

        {/* ── Documentos processados nesta sessão ────────────── */}
        {docs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-brand-600 uppercase tracking-wider flex-1">
                <Sparkles size={14} className="inline mr-1" />
                Processados nesta sessão ({docs.length})
              </h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input className="input pl-8 text-xs py-1.5 w-44" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>

            <ul className="space-y-3">
              {docsFiltrados.map((doc) => (
                <li key={doc.id} className="card space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText size={18} className="text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-900 truncate">{doc.nome}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="badge badge-done text-xs">
                          <CheckCircle2 size={11} className="mr-1" />
                          {doc.dados.tipo_documento}
                        </span>
                        {doc.alocado && (
                          <span className="badge text-xs bg-emerald-100 text-emerald-700">
                            <Sparkles size={10} className="mr-1" /> Alocado automaticamente
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removerDoc(doc.id)} className="p-1.5 rounded-lg hover:bg-danger-100 text-brand-300 hover:text-danger-500">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Campos extraídos */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                    {[
                      { l: 'Empresa / Nome',   v: doc.dados.razao_social_ou_nome },
                      { l: 'CNPJ / CPF',       v: doc.dados.cnpj_cpf },
                      { l: 'Competência',      v: doc.dados.competencia },
                      { l: 'Vencimento',       v: doc.dados.data_vencimento ? new Date(doc.dados.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : null },
                      { l: 'Valor',            v: doc.dados.valor != null ? `R$ ${doc.dados.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null },
                      { l: 'Chave PIX',        v: doc.dados.chave_pix },
                    ].map(({ l, v }) => v ? (
                      <div key={l}>
                        <p className="text-brand-400">{l}</p>
                        <p className="font-medium text-brand-800 truncate">{v}</p>
                      </div>
                    ) : null)}
                  </div>

                  {/* Detalhes da alocação automática */}
                  {doc.alocacaoDetalhes.length > 0 && (
                    <div className="text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 space-y-0.5">
                      <p className="font-semibold text-emerald-700 mb-1">Alocação automática realizada:</p>
                      {doc.alocacaoDetalhes.map((d, i) => (
                        <p key={i} className="text-emerald-600">✓ {d}</p>
                      ))}
                    </div>
                  )}

                  {/* WhatsApp */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-brand-100">
                    <input
                      className="input text-sm flex-1"
                      placeholder={`WhatsApp: ${clienteSelecionado?.telefone ?? '55119...'}`}
                      value={doc.telefonePara ?? clienteSelecionado?.telefone ?? ''}
                      onChange={(e) => atualizarTelefone(doc.id, e.target.value)}
                    />
                    <button onClick={() => enviarWhatsApp(doc)} disabled={doc.enviandoWpp} className="btn-accent whitespace-nowrap">
                      {doc.enviandoWpp ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                      Enviar via WhatsApp
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Histórico de Uploads ───────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-brand-600 uppercase tracking-wider flex-1">
              <Clock size={14} className="inline mr-1" />
              Histórico de Uploads Recentes
            </h2>
            <button
              onClick={carregarHistorico}
              disabled={loadingHistorico}
              className="btn-secondary py-1.5 text-xs"
            >
              {loadingHistorico
                ? <Loader2 size={12} className="animate-spin" />
                : <RefreshCw size={12} />}
              Atualizar
            </button>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-brand-100">
                  <th className="text-left px-4 py-3 text-brand-500 font-medium">ARQUIVO</th>
                  <th className="text-left px-4 py-3 text-brand-500 font-medium hidden sm:table-cell">CLIENTE</th>
                  <th className="text-left px-4 py-3 text-brand-500 font-medium hidden md:table-cell">TIPO</th>
                  <th className="text-left px-4 py-3 text-brand-500 font-medium hidden md:table-cell">COMPETÊNCIA</th>
                  <th className="text-left px-4 py-3 text-brand-500 font-medium">STATUS</th>
                  <th className="text-left px-4 py-3 text-brand-500 font-medium hidden lg:table-cell">DATA</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistorico ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-brand-400">
                      <Loader2 size={20} className="animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : historico.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-brand-400">
                      Nenhum upload encontrado.
                    </td>
                  </tr>
                ) : (
                  historico.map((h) => (
                    <tr key={h.id} className="border-b border-brand-50 hover:bg-brand-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-brand-800 truncate max-w-[180px]">{h.nome_original}</p>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell text-brand-600">
                        {nomeCliente(h.referencia_id)}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-brand-100 text-brand-600">
                          {h.tipo_documento ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-brand-500">
                        {h.competencia
                          ? `${MESES_PT[Number(h.competencia.split('-')[1]) - 1]}/${h.competencia.split('-')[0]}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLE[h.status_ia ?? ''] ?? 'bg-brand-100 text-brand-500'}`}>
                          {h.alocado && <Sparkles size={9} />}
                          {h.status_ia ?? 'Processado'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell text-brand-400">
                        {fmtData(h.criado_em)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </Shell>
  )
}
