'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Shell from '@/components/layout/Shell'
import { uploadDocumentoComIA, obterUrlSegura } from '@/services/documents'
import { gerarMensagemNotificacaoWhatsApp } from '@/lib/gemini'
import type { DadosDocumentoExtraidos } from '@/lib/gemini'
import { supabase } from '@/lib/supabase'
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  MessageCircle, ExternalLink, Trash2, X, Search,
} from 'lucide-react'

interface DocumentoProcessado {
  id: string           // anexoId
  nome: string
  caminho: string
  dados: DadosDocumentoExtraidos
  telefonePara?: string
  enviandoWpp?: boolean
}

const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB   = 20

export default function DocumentosPage() {
  const [clienteId, setClienteId]       = useState('')
  const [clientes, setClientes]         = useState<Array<{ id: string; nome: string; telefone: string | null }>>([])
  const [dragging, setDragging]         = useState(false)
  const [processando, setProcessando]   = useState(false)
  const [progresso, setProgresso]       = useState<string | null>(null)
  const [erro, setErro]                 = useState<string | null>(null)
  const [docs, setDocs]                 = useState<DocumentoProcessado[]>([])
  const [busca, setBusca]               = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('clientes').select('id, nome, telefone').order('nome').then(({ data }) => {
      setClientes(data ?? [])
    })
  }, [])

  const clienteSelecionado = clientes.find((c) => c.id === clienteId)

  async function processarArquivos(arquivos: File[]) {
    if (!clienteId) { setErro('Selecione um cliente antes de enviar.'); return }
    const invalidos = arquivos.filter(
      (f) => !TIPOS_ACEITOS.includes(f.type) || f.size > MAX_SIZE_MB * 1024 * 1024,
    )
    if (invalidos.length) {
      setErro(`Arquivos rejeitados: ${invalidos.map((f) => f.name).join(', ')} (verifique tipo e tamanho máx. ${MAX_SIZE_MB}MB)`)
      return
    }

    setProcessando(true)
    setErro(null)
    const { data: { user } } = await supabase.auth.getUser()
    const criadoPor = user?.email ?? user?.id ?? 'desconhecido'

    for (const arquivo of arquivos) {
      setProgresso(`Processando "${arquivo.name}" com IA...`)
      try {
        const resultado = await uploadDocumentoComIA(arquivo, clienteId, criadoPor)
        setDocs((prev) => [
          {
            id:      resultado.anexoId,
            nome:    arquivo.name,
            caminho: resultado.caminho,
            dados:   resultado.dados,
          },
          ...prev,
        ])
      } catch (e) {
        setErro(`Erro em "${arquivo.name}": ${e instanceof Error ? e.message : 'Falha desconhecida'}`)
      }
    }

    setProgresso(null)
    setProcessando(false)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    processarArquivos(Array.from(e.dataTransfer.files))
  }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function enviarWhatsApp(doc: DocumentoProcessado) {
    setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, enviandoWpp: true } : d))
    try {
      const urlSegura = await obterUrlSegura(doc.caminho, 300)
      const mensagem  = gerarMensagemNotificacaoWhatsApp(doc.dados, urlSegura)
      const telefone  = (doc.telefonePara ?? clienteSelecionado?.telefone ?? '').replace(/\D/g, '')
      if (!telefone) throw new Error('Telefone não informado.')
      const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
      window.open(url, '_blank', 'noopener,noreferrer')
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

  return (
    <Shell>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Documentos</h1>
          <p className="text-sm text-brand-500 mt-0.5">
            Upload com análise automática por IA e envio direto via WhatsApp.
          </p>
        </div>

        {/* Seleção de cliente */}
        <div className="card flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1">
            <label className="input-label">Cliente / Empresa</label>
            <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Selecione para habilitar o upload...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {clienteSelecionado?.telefone && (
            <p className="text-xs text-accent-700 flex items-center gap-1 pb-1">
              <MessageCircle size={12} /> {clienteSelecionado.telefone}
            </p>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-100 px-3 py-2.5 rounded-lg">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">{erro}</span>
            <button onClick={() => setErro(null)}><X size={14} /></button>
          </div>
        )}

        {/* Área de Drag & Drop */}
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
              <p className="text-xs">Analisando com IA Gemini 2.5 Flash...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-brand-400">
              <Upload size={36} />
              <div>
                <p className="text-sm font-medium text-brand-700">
                  Arraste arquivos aqui ou clique para selecionar
                </p>
                <p className="text-xs mt-1">PDF, JPG, PNG, WEBP — até {MAX_SIZE_MB}MB por arquivo</p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={TIPOS_ACEITOS.join(',')}
          multiple
          className="hidden"
          onChange={(e) => processarArquivos(Array.from(e.target.files ?? []))}
        />

        {/* Lista de documentos processados */}
        {docs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-brand-600 uppercase tracking-wider flex-1">
                Documentos Processados ({docs.length})
              </h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input className="input pl-8 text-xs py-1.5 w-48" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
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
                      <span className="badge badge-done text-xs mt-0.5">
                        <CheckCircle2 size={11} className="mr-1" />
                        {doc.dados.tipo_documento}
                      </span>
                    </div>
                    <button onClick={() => removerDoc(doc.id)} className="p-1.5 rounded-lg hover:bg-danger-100 text-brand-300 hover:text-danger-500">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Dados extraídos pela IA */}
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

                  {/* Ação WhatsApp */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-brand-100">
                    <input
                      className="input text-sm flex-1"
                      placeholder={`Telefone WhatsApp: ${clienteSelecionado?.telefone ?? '55119...'}` }
                      value={doc.telefonePara ?? clienteSelecionado?.telefone ?? ''}
                      onChange={(e) => atualizarTelefone(doc.id, e.target.value)}
                    />
                    <button
                      onClick={() => enviarWhatsApp(doc)}
                      disabled={doc.enviandoWpp}
                      className="btn-accent whitespace-nowrap"
                    >
                      {doc.enviandoWpp
                        ? <Loader2 size={15} className="animate-spin" />
                        : <MessageCircle size={15} />}
                      Enviar via WhatsApp
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  )
}
