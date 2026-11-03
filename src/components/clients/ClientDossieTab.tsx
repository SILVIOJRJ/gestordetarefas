'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Folder, FolderOpen, Upload, FileText, ExternalLink, Trash2,
  Loader2, AlertTriangle, Sparkles, CheckCircle2, Building2,
  ClipboardList, Scale, CreditCard, BarChart2, FileSearch,
  Receipt, Info, Briefcase, ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BUCKET_PRINCIPAL, obterSignedUrl, deletarAnexo, fmtTamanho } from '@/services/storage'
import { uploadDocumentoComIA } from '@/services/documents'
import type { DadosDocumentoExtraidos } from '@/lib/gemini'
import type { Cliente } from '@/types/database.types'

// ─── Tipos ────────────────────────────────────────────────────

type CategoriaSlug = 'SOCIETARIO' | 'CONTABIL' | 'PESSOAL' | 'FINANCEIRO'

interface Pasta {
  slug: CategoriaSlug
  label: string
  descricao: string
  icon: React.ElementType
  tipos: string[] // tipos_documento esperados nesta pasta
}

interface AnexoDoc {
  id: string
  nome_original: string
  url: string
  tipo_mime: string | null
  tamanho: number | null
  criado_em: string
  tipo_documento: string | null
  status_ia: string | null
  alocado: boolean | null
  categoria_pasta: string | null
  competencia: string | null
}

interface AtalhoDoc {
  id: string
  label: string
  icon: React.ElementType
  categoria: CategoriaSlug
  tiposMatch: string[]  // tipo_documento que corresponde
  dataFn?: (c: Cliente) => string | null // para atalhos baseados em dados
}

interface GerencialResumo {
  receita_servicos: number | null
  receita_vendas: number | null
  das: number | null
  caixa_atual: number | null
  competencia: string | null
}

// ─── Constantes ───────────────────────────────────────────────

const PASTAS: Pasta[] = [
  {
    slug: 'SOCIETARIO',
    label: 'Societário / Legalização',
    descricao: 'Contrato social, alterações, licenças, alvarás, certidões',
    icon: Building2,
    tipos: ['CONTRATO_SOCIAL', 'OUTRO'],
  },
  {
    slug: 'CONTABIL',
    label: 'Contábil & Fiscal',
    descricao: 'Balanços, balancetes, DRE, guias DAS/DARF, notas fiscais',
    icon: BarChart2,
    tipos: ['DAS', 'DARF', 'NOTA_FISCAL', 'NFe', 'BALANCETE'],
  },
  {
    slug: 'PESSOAL',
    label: 'Departamento Pessoal',
    descricao: 'Holerites, folhas de pagamento, GFIP, INSS, FGTS',
    icon: Briefcase,
    tipos: ['HOLERITE', 'GUIA_FGTS', 'GUIA_INSS'],
  },
  {
    slug: 'FINANCEIRO',
    label: 'Financeiro',
    descricao: 'Boletos de honorários, extratos bancários OFX, faturas',
    icon: CreditCard,
    tipos: ['FATURA', 'EXTRATO_BANCARIO'],
  },
]

const ATALHOS: AtalhoDoc[] = [
  { id: 'cartao_cnpj',   label: 'Cartão CNPJ',               icon: CreditCard,    categoria: 'SOCIETARIO', tiposMatch: [] },
  { id: 'contrato',      label: 'Contrato Social',            icon: FileText,      categoria: 'SOCIETARIO', tiposMatch: ['CONTRATO_SOCIAL'] },
  { id: 'alteracao',     label: 'Última Alteração Contratual',icon: ClipboardList, categoria: 'SOCIETARIO', tiposMatch: [] },
  { id: 'licencas',      label: 'Licenças & Alvarás',         icon: Scale,         categoria: 'SOCIETARIO', tiposMatch: [] },
  { id: 'balancete',     label: 'Último Balanço Anexado',     icon: BarChart2,     categoria: 'CONTABIL',   tiposMatch: ['BALANCETE'] },
  { id: 'certidoes',     label: 'Certidões Negativas',        icon: FileSearch,    categoria: 'SOCIETARIO', tiposMatch: [] },
  { id: 'debitos',       label: 'Débitos & Parcelamentos',    icon: Receipt,       categoria: 'FINANCEIRO', tiposMatch: [] },
  { id: 'tributario',    label: 'Informações Tributárias',    icon: Info,          categoria: 'CONTABIL',   tiposMatch: [],
    dataFn: (c) => [c.cnae ? `CNAE: ${c.cnae}` : null, (c as any).fator_r ? 'Fator R ativo' : null].filter(Boolean).join(' · ') || null,
  },
  { id: 'honorarios',    label: 'Contrato Contábil',          icon: Briefcase,     categoria: 'FINANCEIRO', tiposMatch: [],
    dataFn: (c) => [c.limite_nfe != null ? `Limite NF: ${c.limite_nfe}` : null, c.taxa_recalculo != null ? `Taxa: ${c.taxa_recalculo}%` : null].filter(Boolean).join(' · ') || null,
  },
  { id: 'caixa',         label: 'Caixa & Faturamento',        icon: BarChart2,     categoria: 'CONTABIL',   tiposMatch: [] },
]

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtComp(competencia: string | null) {
  if (!competencia) return null
  const [ano, mm] = competencia.split('-')
  return `${MESES_PT[parseInt(mm) - 1]}/${ano}`
}

// ─── Componente ───────────────────────────────────────────────

export default function ClientDossieTab({ cliente }: { cliente: Cliente }) {
  const [pastaAtiva, setPastaAtiva]       = useState<CategoriaSlug>('SOCIETARIO')
  const [arquivos, setArquivos]           = useState<AnexoDoc[]>([])
  const [loading, setLoading]             = useState(false)
  const [uploadando, setUploadando]       = useState(false)
  const [progressoMsg, setProgressoMsg]   = useState('')
  const [erro, setErro]                   = useState<string | null>(null)
  const [gerencial, setGerencial]         = useState<GerencialResumo | null>(null)
  const [expandido, setExpandido]         = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('anexos') as any)
      .select('id, nome_original, url, tipo_mime, tamanho, criado_em, tipo_documento, status_ia, alocado, categoria_pasta, competencia')
      .eq('referencia_tipo', 'cliente')
      .eq('referencia_id', cliente.id)
      .order('criado_em', { ascending: false })
    setArquivos((data ?? []) as AnexoDoc[])
    setLoading(false)
  }, [cliente.id])

  useEffect(() => {
    carregar()
    // Busca último gerencial para o atalho de Caixa
    const now = new Date()
    const comp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from('gerencial_mensal') as any)
      .select('receita_servicos, receita_vendas, das, caixa_atual, competencia')
      .eq('cliente_id', cliente.id)
      .order('competencia', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }: { data: GerencialResumo | null }) => setGerencial(data))
  }, [carregar, cliente.id])

  const arquivosDaPasta = arquivos.filter(a =>
    (a.categoria_pasta ?? 'SOCIETARIO') === pastaAtiva,
  )

  async function uploadNaPasta(file: File) {
    setUploadando(true)
    setErro(null)
    setProgressoMsg(`Enviando "${file.name}" para análise...`)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const criadoPor = user?.email ?? user?.id ?? 'desconhecido'
      const now = new Date()
      const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      // Upload + IA via motor central
      const resultado = await uploadDocumentoComIA(file, cliente.id, criadoPor, competencia)

      // Atualiza categoria_pasta no registro criado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('anexos') as any)
        .update({ categoria_pasta: pastaAtiva })
        .eq('id', resultado.anexoId)

      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro no upload.')
    } finally {
      setUploadando(false)
      setProgressoMsg('')
    }
  }

  async function abrirArquivo(url: string) {
    try {
      const signed = await obterSignedUrl(BUCKET_PRINCIPAL, url, 300)
      window.open(signed, '_blank', 'noopener,noreferrer')
    } catch {
      setErro('Falha ao gerar link seguro.')
    }
  }

  async function remover(a: AnexoDoc) {
    if (!confirm(`Remover "${a.nome_original}"?`)) return
    try {
      await deletarAnexo(a.id, a.url)
      setArquivos(prev => prev.filter(x => x.id !== a.id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  // Acha o arquivo mais recente de um atalho
  function ultimoArquivoDoAtalho(a: AtalhoDoc): AnexoDoc | null {
    if (a.tiposMatch.length === 0) return null
    return arquivos.find(f => a.tiposMatch.includes(f.tipo_documento ?? '')) ?? null
  }

  const brl = (v: number | null) => v == null ? '—'
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-4">

      {/* ── Atalhos Rápidos ─────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-2.5">
          Acesso Rápido — Documentos Chave
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ATALHOS.map(a => {
            const arquivo = ultimoArquivoDoAtalho(a)
            const dadosDiretos = a.dataFn ? a.dataFn(cliente) : null
            const isCaixa = a.id === 'caixa'
            const aberto = expandido === a.id

            return (
              <div
                key={a.id}
                className={[
                  'rounded-xl border transition-all text-left',
                  aberto
                    ? 'border-accent-300 bg-accent-50 col-span-2'
                    : arquivo || dadosDiretos || isCaixa
                    ? 'border-emerald-200 bg-emerald-50 cursor-pointer hover:border-emerald-400'
                    : 'border-brand-150 bg-brand-50 cursor-pointer hover:border-brand-300',
                ].join(' ')}
                onClick={() => setExpandido(aberto ? null : a.id)}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <a.icon size={14} className={arquivo || dadosDiretos || isCaixa ? 'text-emerald-600' : 'text-brand-300'} />
                  <span className="text-xs font-medium text-brand-700 flex-1 leading-tight">{a.label}</span>
                  {(arquivo || dadosDiretos || isCaixa) && (
                    <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                  )}
                  <ChevronDown size={11} className={`text-brand-300 flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                </div>

                {aberto && (
                  <div className="px-3 pb-3 pt-0 border-t border-accent-200 mt-0">
                    {isCaixa ? (
                      gerencial ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                          <div><p className="text-brand-400">Receita Serviços</p><p className="font-medium">{brl(gerencial.receita_servicos)}</p></div>
                          <div><p className="text-brand-400">Receita Vendas</p><p className="font-medium">{brl(gerencial.receita_vendas)}</p></div>
                          <div><p className="text-brand-400">DAS</p><p className="font-medium">{brl(gerencial.das)}</p></div>
                          <div><p className="text-brand-400">Caixa Atual</p><p className="font-medium">{brl(gerencial.caixa_atual)}</p></div>
                          {gerencial.competencia && (
                            <div className="col-span-2"><p className="text-brand-300 text-[10px]">Competência: {fmtComp(gerencial.competencia)}</p></div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-brand-400 mt-2">Sem dados gerenciais cadastrados.</p>
                      )
                    ) : dadosDiretos ? (
                      <p className="text-xs text-brand-600 mt-2">{dadosDiretos}</p>
                    ) : arquivo ? (
                      <div className="flex items-center gap-2 mt-2">
                        <FileText size={13} className="text-brand-400 flex-shrink-0" />
                        <p className="text-xs text-brand-700 flex-1 truncate">{arquivo.nome_original}</p>
                        <button onClick={(e) => { e.stopPropagation(); abrirArquivo(arquivo.url) }}
                          className="text-accent-600 hover:underline text-xs flex items-center gap-0.5">
                          <ExternalLink size={11} /> Abrir
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <p className="text-xs text-brand-400 mb-1.5">Nenhum documento anexado.</p>
                        <button
                          onClick={e => { e.stopPropagation(); setPastaAtiva(a.categoria); inputRef.current?.click() }}
                          className="text-xs text-accent-600 hover:underline flex items-center gap-1"
                        >
                          <Upload size={11} /> Enviar agora
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Arquivo Digital ─────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-2.5">
          Arquivo Digital
        </p>

        {/* Abas de pasta */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {PASTAS.map(p => {
            const count = arquivos.filter(a => (a.categoria_pasta ?? 'SOCIETARIO') === p.slug).length
            const ativa = pastaAtiva === p.slug
            return (
              <button
                key={p.slug}
                onClick={() => setPastaAtiva(p.slug)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
                  ativa
                    ? 'bg-brand-800 text-white shadow-sm'
                    : 'bg-brand-100 text-brand-500 hover:bg-brand-200',
                ].join(' ')}
              >
                {ativa ? <FolderOpen size={13} /> : <Folder size={13} />}
                {p.label.split(' / ')[0]}
                {count > 0 && (
                  <span className={`px-1.5 py-0 rounded-full text-[10px] font-bold ${ativa ? 'bg-white/20' : 'bg-brand-300 text-white'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Descrição da pasta */}
        <p className="text-[11px] text-brand-400 mt-1.5 mb-3">
          {PASTAS.find(p => p.slug === pastaAtiva)?.descricao}
        </p>

        {/* Botão upload */}
        <div
          onClick={() => !uploadando && inputRef.current?.click()}
          className={[
            'border-2 border-dashed rounded-xl p-5 text-center transition-all',
            uploadando
              ? 'border-accent-300 bg-accent-50 cursor-default'
              : 'border-brand-200 hover:border-brand-400 hover:bg-brand-50 cursor-pointer',
          ].join(' ')}
        >
          {uploadando ? (
            <div className="flex items-center justify-center gap-3 text-brand-500">
              <Loader2 size={18} className="animate-spin text-accent-500" />
              <div className="text-left">
                <p className="text-xs font-medium">{progressoMsg}</p>
                <p className="text-[11px] text-brand-400">Gemini classificando e extraindo dados...</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-brand-400">
              <Sparkles size={16} className="text-accent-400" />
              <span className="text-xs">
                <span className="font-medium text-brand-600">Enviar para esta pasta</span>
                {' '}— IA classifica e arquiva automaticamente
              </span>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xml,.ofx"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadNaPasta(f); e.target.value = '' }}
        />

        {/* Erro */}
        {erro && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span className="flex-1">{erro}</span>
            <button onClick={() => setErro(null)}>✕</button>
          </div>
        )}

        {/* Lista de arquivos */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-brand-300" />
          </div>
        ) : arquivosDaPasta.length === 0 ? (
          <div className="text-center py-6 text-brand-300">
            <Folder size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Nenhum arquivo nesta pasta.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {arquivosDaPasta.map(a => (
              <li key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white border border-brand-100 hover:border-brand-200 transition-colors group">
                <FileText size={15} className="text-brand-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-brand-800 truncate">{a.nome_original}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {a.tipo_documento && (
                      <span className="text-[10px] px-1.5 py-0 rounded bg-brand-100 text-brand-500">{a.tipo_documento}</span>
                    )}
                    {a.alocado && (
                      <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                        <Sparkles size={9} /> Alocado
                      </span>
                    )}
                    {a.competencia && (
                      <span className="text-[10px] text-brand-400">{fmtComp(a.competencia)}</span>
                    )}
                    <span className="text-[10px] text-brand-300">{fmtTamanho(a.tamanho)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => abrirArquivo(a.url)}
                    className="p-1.5 rounded hover:bg-brand-100 text-brand-400 hover:text-brand-700"
                    title="Abrir"
                  >
                    <ExternalLink size={13} />
                  </button>
                  <button
                    onClick={() => remover(a)}
                    className="p-1.5 rounded hover:bg-red-100 text-brand-300 hover:text-red-500"
                    title="Remover"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
