'use client'

import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  listarProcessos, criarProcesso, atualizarProcesso, avancarEtapa,
  adicionarExigencia, sanarExigencia, removerExigencia,
  type ProcessoComCliente,
} from '@/services/processes'
import type {
  Cliente, StatusProcesso, EtapaProcesso, TipoAtoProcesso, Exigencia,
} from '@/types/database.types'
import {
  FileText, Plus, X, Search, ChevronRight, ChevronDown,
  AlertCircle, Clock, CheckCircle2, XCircle, Loader2,
  Building2, Shield, Flame, Leaf, LayoutGrid, List,
  ArrowRight, Users, Trash2, ClipboardList, Paperclip, ExternalLink,
} from 'lucide-react'
import {
  uploadERegistrar, listarAnexos, deletarAnexo, obterSignedUrl,
  BUCKET_PRINCIPAL, fmtTamanho, iconeArquivo,
  type AnexoInfo,
} from '@/services/storage'
import FileUploadModal from '@/components/common/FileUploadModal'

// ─── Constantes ───────────────────────────────────────────────

const ETAPAS: EtapaProcesso[] = [
  'Viabilidade',
  'DBE / Redesim',
  'Junta Comercial',
  'Insc. Municipal/Estadual',
  'Licenciamento',
  'Concluído',
]

const TIPOS_ATO: TipoAtoProcesso[] = [
  'Abertura', 'Alteração Contratual', 'Consolidação', 'Baixa', 'Licenciamento Isolado', 'Outro',
]

const TIPO_COR: Record<TipoAtoProcesso, string> = {
  'Abertura':             'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Alteração Contratual': 'bg-blue-100 text-blue-700 border-blue-200',
  'Consolidação':         'bg-purple-100 text-purple-700 border-purple-200',
  'Baixa':                'bg-red-100 text-red-700 border-red-200',
  'Licenciamento Isolado':'bg-amber-100 text-amber-700 border-amber-200',
  'Outro':                'bg-gray-100 text-gray-700 border-gray-200',
}

const STATUS_CFG: Record<StatusProcesso, { label: string; cor: string; icon: React.ReactNode }> = {
  'Pendente':     { label: 'Pendente',     cor: 'bg-yellow-100 text-yellow-800', icon: <Clock size={12} /> },
  'Em andamento': { label: 'Em andamento', cor: 'bg-blue-100 text-blue-800',     icon: <Loader2 size={12} /> },
  'Aguardando':   { label: 'Aguardando',   cor: 'bg-purple-100 text-purple-800', icon: <AlertCircle size={12} /> },
  'Concluído':    { label: 'Concluído',    cor: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 size={12} /> },
  'Cancelado':    { label: 'Cancelado',    cor: 'bg-red-100 text-red-800',       icon: <XCircle size={12} /> },
}

const ETAPA_COR: Record<EtapaProcesso, string> = {
  'Viabilidade':             'border-t-slate-400',
  'DBE / Redesim':           'border-t-blue-400',
  'Junta Comercial':         'border-t-purple-400',
  'Insc. Municipal/Estadual':'border-t-amber-400',
  'Licenciamento':            'border-t-rose-400',
  'Concluído':               'border-t-emerald-500',
}

// ─── Formulário ───────────────────────────────────────────────

interface FormNovo {
  cliente_id: string; tipo_ato: TipoAtoProcesso; descricao: string
  prazo: string; responsavel: string; responsaveis_txt: string; obs: string
}

const FORM_VAZIO: FormNovo = {
  cliente_id: '', tipo_ato: 'Abertura', descricao: '',
  prazo: '', responsavel: '', responsaveis_txt: '', obs: '',
}

// ─── Protocolos (labels) ──────────────────────────────────────

interface ProtocoloField { key: keyof ProcessoComCliente; label: string; icon?: React.ReactNode }

const PROTOCOLO_FIELDS: ProtocoloField[] = [
  { key: 'protocolo_viabilidade', label: 'Viabilidade (nº protocolo)' },
  { key: 'protocolo_dbe_redesim', label: 'DBE / Redesim' },
  { key: 'protocolo_junta',       label: 'Junta Comercial' },
  { key: 'inscricao_municipal',   label: 'Inscrição Municipal' },
  { key: 'inscricao_estadual',    label: 'Inscrição Estadual' },
  { key: 'protocolo_vigilancia',  label: 'Vigilância Sanitária', icon: <Shield size={12} /> },
  { key: 'protocolo_bombeiros',   label: 'Corpo de Bombeiros',   icon: <Flame size={12} /> },
  { key: 'protocolo_meio_ambiente', label: 'Meio Ambiente',      icon: <Leaf size={12} /> },
]

// ─── Helpers ──────────────────────────────────────────────────

function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function isAtrasado(prazo: string | null): boolean {
  if (!prazo) return false
  return new Date(prazo + 'T00:00:00') < new Date(new Date().toDateString())
}

// ─── Componente principal ─────────────────────────────────────

export default function ProcessosPage() {
  const [processos, setProcessos]   = useState<ProcessoComCliente[]>([])
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [loading, setLoading]       = useState(true)
  const [busca, setBusca]           = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusProcesso | 'Todos'>('Todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoAtoProcesso | 'Todos'>('Todos')
  const [view, setView]             = useState<'kanban' | 'lista'>('kanban')
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState<FormNovo>(FORM_VAZIO)
  const [salvando, setSalvando]     = useState(false)
  const [msg, setMsg]               = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [detalhe, setDetalhe]       = useState<ProcessoComCliente | null>(null)
  const [abaDetalhe, setAbaDetalhe] = useState<'protocolos' | 'exigencias' | 'docs'>('protocolos')

  // Estado inline de exigências para edição
  const [novaExig, setNovaExig] = useState({ descricao: '', data_limite: '', responsavel: '' })
  const [salvandoExig, setSalvandoExig] = useState(false)

  // Anexos do processo em detalhe
  const [anexosProcesso, setAnexosProcesso] = useState<AnexoInfo[]>([])
  const [loadingAnexos, setLoadingAnexos]   = useState(false)
  const [showUpload, setShowUpload]         = useState(false)
  const [uploadErro, setUploadErro]         = useState<string | null>(null)
  const [userId, setUserId]                 = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (abaDetalhe !== 'docs' || !detalhe) return
    setLoadingAnexos(true)
    listarAnexos('processo', detalhe.id)
      .then(setAnexosProcesso)
      .catch(() => setAnexosProcesso([]))
      .finally(() => setLoadingAnexos(false))
  }, [abaDetalhe, detalhe])

  async function handleUploadProcesso(files: File[]) {
    if (!detalhe) return
    setUploadErro(null)
    try {
      const novos: AnexoInfo[] = []
      for (const file of files) {
        const info = await uploadERegistrar({
          file,
          bucket: BUCKET_PRINCIPAL,
          pasta: `processos/${detalhe.id}`,
          referencia_tipo: 'processo',
          referencia_id: detalhe.id,
          criado_por: userId,
        })
        novos.push(info)
      }
      setAnexosProcesso(prev => [...novos, ...prev])
      setShowUpload(false)
    } catch (e) {
      setUploadErro(e instanceof Error ? e.message : 'Erro no upload')
    }
  }

  async function abrirAnexoProcesso(anexo: AnexoInfo) {
    try {
      const url = await obterSignedUrl(BUCKET_PRINCIPAL, anexo.url)
      window.open(url, '_blank')
    } catch { alert('Falha ao gerar link.') }
  }

  async function removerAnexoProcesso(anexo: AnexoInfo) {
    if (!confirm(`Remover "${anexo.nome_original}"?`)) return
    try {
      await deletarAnexo(anexo.id, anexo.url)
      setAnexosProcesso(prev => prev.filter(a => a.id !== anexo.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao remover')
    }
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [procs, { data: cData }] = await Promise.all([
        listarProcessos(),
        (supabase.from('clientes') as any).select('id,nome').order('nome'),
      ])
      setProcessos(procs)
      setClientes((cData ?? []) as Cliente[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ─── Salvar novo processo ─────────────────────────────────

  async function salvar() {
    if (!form.descricao.trim() || !form.cliente_id) return
    setSalvando(true); setMsg(null)
    try {
      await criarProcesso({
        cliente_id:            form.cliente_id,
        tipo_ato:              form.tipo_ato,
        descricao:             form.descricao.trim(),
        prazo:                 form.prazo || null,
        responsavel:           form.responsavel.trim(),
        responsaveis_conjuntos: form.responsaveis_txt
          .split(',').map(s => s.trim()).filter(Boolean),
        obs: form.obs.trim() || null,
      })
      setMsg({ tipo: 'ok', texto: 'Processo criado com sucesso!' })
      setForm(FORM_VAZIO); setShowForm(false)
      await carregar()
    } catch (e) {
      setMsg({ tipo: 'err', texto: String(e) })
    } finally {
      setSalvando(false)
    }
  }

  // ─── Avançar etapa ────────────────────────────────────────

  async function mudarEtapa(id: string, etapa: EtapaProcesso) {
    await avancarEtapa(id, etapa)
    setProcessos(prev => prev.map(p => p.id === id
      ? { ...p, etapa_atual: etapa, status: etapa === 'Concluído' ? 'Concluído' : 'Em andamento' }
      : p))
    if (detalhe?.id === id) setDetalhe(prev => prev ? { ...prev, etapa_atual: etapa } : null)
  }

  // ─── Atualizar campo de protocolo ────────────────────────

  async function salvarCampo(id: string, key: string, value: string) {
    await atualizarProcesso(id, { [key]: value || null } as never)
    setProcessos(prev => prev.map(p => p.id === id ? { ...p, [key]: value || null } : p))
    if (detalhe?.id === id) setDetalhe(prev => prev ? { ...prev, [key]: value || null } : null)
  }

  // ─── Exigências ───────────────────────────────────────────

  async function addExig() {
    if (!detalhe || !novaExig.descricao.trim()) return
    setSalvandoExig(true)
    try {
      const lista = await adicionarExigencia(detalhe, {
        descricao:   novaExig.descricao.trim(),
        data_limite: novaExig.data_limite || null,
        responsavel: novaExig.responsavel.trim() || null,
      })
      setDetalhe(prev => prev ? { ...prev, exigencias: lista } : null)
      setProcessos(prev => prev.map(p => p.id === detalhe.id ? { ...p, exigencias: lista } : p))
      setNovaExig({ descricao: '', data_limite: '', responsavel: '' })
    } finally {
      setSalvandoExig(false)
    }
  }

  async function resolverExig(exigId: string) {
    if (!detalhe) return
    const lista = await sanarExigencia(detalhe, exigId)
    setDetalhe(prev => prev ? { ...prev, exigencias: lista } : null)
    setProcessos(prev => prev.map(p => p.id === detalhe.id ? { ...p, exigencias: lista } : p))
  }

  async function deletarExig(exigId: string) {
    if (!detalhe) return
    const lista = await removerExigencia(detalhe, exigId)
    setDetalhe(prev => prev ? { ...prev, exigencias: lista } : null)
    setProcessos(prev => prev.map(p => p.id === detalhe.id ? { ...p, exigencias: lista } : p))
  }

  // ─── Filtros ──────────────────────────────────────────────

  const lista = processos.filter(p => {
    const q = busca.toLowerCase()
    const ok = !q || p.descricao?.toLowerCase().includes(q) ||
      p.clientes?.nome?.toLowerCase().includes(q) ||
      p.protocolo_viabilidade?.toLowerCase().includes(q) ||
      p.protocolo_junta?.toLowerCase().includes(q)
    return ok &&
      (filtroStatus === 'Todos' || p.status === filtroStatus) &&
      (filtroTipo === 'Todos' || p.tipo_ato === filtroTipo)
  })

  // ─── KPIs ─────────────────────────────────────────────────

  const kpis = {
    total:      processos.length,
    andamento:  processos.filter(p => p.status === 'Em andamento').length,
    aguardando: processos.filter(p => p.status === 'Aguardando').length,
    atrasados:  processos.filter(p => isAtrasado(p.prazo) && p.status !== 'Concluído' && p.status !== 'Cancelado').length,
    concluidos: processos.filter(p => p.status === 'Concluído').length,
  }

  // ─── Render: card de processo ─────────────────────────────

  function ProcessoCard({ p }: { p: ProcessoComCliente }) {
    const atrasado = isAtrasado(p.prazo) && p.status !== 'Concluído' && p.status !== 'Cancelado'
    const exigPendentes = (p.exigencias ?? []).filter(e => !e.sanado).length
    const sc = STATUS_CFG[p.status] ?? STATUS_CFG['Pendente']
    const tc = TIPO_COR[p.tipo_ato ?? 'Outro']
    return (
      <div
        className={`bg-white rounded-xl border border-brand-100 ${ETAPA_COR[p.etapa_atual ?? 'Viabilidade']} border-t-4 p-3 cursor-pointer hover:shadow-md transition-shadow`}
        onClick={() => { setDetalhe(p); setAbaDetalhe('protocolos') }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tc}`}>
            {p.tipo_ato ?? 'Abertura'}
          </span>
          <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${sc.cor}`}>
            {sc.icon} {sc.label}
          </span>
        </div>
        <p className="text-sm font-semibold text-brand-800 leading-snug line-clamp-2">{p.descricao}</p>
        {p.clientes?.nome && (
          <p className="text-xs text-brand-400 mt-1 truncate">{p.clientes.nome}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {p.prazo && (
            <span className={`text-[10px] ${atrasado ? 'text-red-500 font-semibold' : 'text-brand-400'}`}>
              {atrasado ? '⚠ ' : ''}Prazo: {fmtData(p.prazo)}
            </span>
          )}
          {exigPendentes > 0 && (
            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">
              {exigPendentes} exig.
            </span>
          )}
        </div>
        {(p.responsavel || (p.responsaveis_conjuntos ?? []).length > 0) && (
          <div className="flex items-center gap-1 mt-2">
            <Users size={11} className="text-brand-300 shrink-0" />
            <span className="text-[10px] text-brand-400 truncate">
              {[p.responsavel, ...(p.responsaveis_conjuntos ?? [])].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
      </div>
    )
  }

  // ─── Render: detalhe modal ────────────────────────────────

  function Detalhe() {
    if (!detalhe) return null
    const atrasado = isAtrasado(detalhe.prazo) && detalhe.status !== 'Concluído'
    return (
      <div
        className="fixed inset-0 z-[100] flex items-start justify-end bg-black/40 backdrop-blur-sm"
        onClick={() => setDetalhe(null)}
      >
        <div
          className="relative h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Cabeçalho */}
          <div className="sticky top-0 z-10 bg-brand-900 text-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${TIPO_COR[detalhe.tipo_ato ?? 'Outro']}`}>
                  {detalhe.tipo_ato ?? 'Abertura'}
                </span>
                <p className="font-semibold mt-1 leading-snug">{detalhe.descricao}</p>
                {detalhe.clientes?.nome && (
                  <p className="text-sm text-brand-300 mt-0.5">{detalhe.clientes.nome}</p>
                )}
              </div>
              <button onClick={() => setDetalhe(null)} className="p-1.5 hover:bg-brand-800 rounded-lg">
                <X size={16} />
              </button>
            </div>
            {/* Status + prazo */}
            <div className="flex flex-wrap gap-2 mt-3">
              {(['Pendente','Em andamento','Aguardando','Concluído','Cancelado'] as StatusProcesso[]).map(s => (
                <button
                  key={s}
                  onClick={async () => {
                    await atualizarProcesso(detalhe.id, { status: s })
                    setDetalhe(p => p ? { ...p, status: s } : null)
                    setProcessos(prev => prev.map(p => p.id === detalhe.id ? { ...p, status: s } : p))
                  }}
                  className={`text-xs px-2 py-1 rounded transition ${
                    detalhe.status === s ? 'bg-white text-brand-900 font-semibold' : 'bg-brand-800 text-brand-300 hover:bg-brand-700'
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Etapas */}
          <div className="px-5 py-4 border-b border-brand-100 bg-brand-50">
            <p className="text-xs text-brand-500 mb-2 font-medium">Etapa atual — clique para avançar</p>
            <div className="flex flex-wrap gap-2">
              {ETAPAS.map((e, i) => {
                const idxAtual = ETAPAS.indexOf(detalhe.etapa_atual ?? 'Viabilidade')
                const done = i < idxAtual; const active = i === idxAtual
                return (
                  <button
                    key={e}
                    onClick={() => mudarEtapa(detalhe.id, e)}
                    className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition ${
                      done   ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      active ? 'bg-accent-600 text-white border-accent-600 font-semibold' :
                               'bg-white text-brand-400 border-brand-200 hover:bg-brand-100'
                    }`}
                  >
                    {done && <CheckCircle2 size={11} />}
                    {active && <ArrowRight size={11} />}
                    {e}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Abas */}
          <div className="flex border-b border-brand-100">
            {([
              { key: 'protocolos', label: 'Protocolos', icon: <ClipboardList size={13} /> },
              { key: 'exigencias', label: `Exigências ${(detalhe.exigencias ?? []).filter(e => !e.sanado).length > 0 ? `(${(detalhe.exigencias ?? []).filter(e => !e.sanado).length})` : ''}`, icon: <AlertCircle size={13} /> },
              { key: 'docs', label: 'Documentos', icon: <FileText size={13} /> },
            ] as const).map(a => (
              <button
                key={a.key}
                onClick={() => setAbaDetalhe(a.key)}
                className={`flex items-center gap-1.5 flex-1 justify-center text-xs py-3 font-medium border-b-2 transition ${
                  abaDetalhe === a.key
                    ? 'border-accent-600 text-accent-700'
                    : 'border-transparent text-brand-400 hover:text-brand-600'
                }`}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* Conteúdo da aba */}
          <div className="p-5 space-y-4">

            {/* ── ABA PROTOCOLOS ── */}
            {abaDetalhe === 'protocolos' && (
              <div className="space-y-4">
                {/* Informações básicas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-brand-400">Responsável principal</p>
                    <EditableField
                      value={detalhe.responsavel ?? ''}
                      onSave={v => salvarCampo(detalhe.id, 'responsavel', v)}
                      placeholder="Nome do responsável"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-brand-400">Prazo</p>
                    <p className={`text-sm font-medium ${atrasado ? 'text-red-500' : 'text-brand-700'}`}>
                      {fmtData(detalhe.prazo)}{atrasado ? ' ⚠' : ''}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-brand-400 mb-1">Responsáveis conjuntos</p>
                    <EditableField
                      value={(detalhe.responsaveis_conjuntos ?? []).join(', ')}
                      onSave={v => salvarCampo(detalhe.id, 'responsaveis_conjuntos', v)}
                      placeholder="João, Maria, Carlos (separados por vírgula)"
                      isArray
                      onSaveArray={async (arr) => {
                        await atualizarProcesso(detalhe.id, { responsaveis_conjuntos: arr })
                        setDetalhe(p => p ? { ...p, responsaveis_conjuntos: arr } : null)
                        setProcessos(prev => prev.map(p => p.id === detalhe.id ? { ...p, responsaveis_conjuntos: arr } : p))
                      }}
                    />
                  </div>
                </div>

                <hr className="border-brand-100" />

                {/* Campos de protocolo */}
                <div>
                  <p className="text-xs font-semibold text-brand-600 mb-3 uppercase tracking-wide">Números de Protocolo</p>
                  <div className="space-y-3">
                    {PROTOCOLO_FIELDS.map(f => (
                      <div key={f.key} className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 w-48 shrink-0">
                          {f.icon && <span className="text-brand-400">{f.icon}</span>}
                          <p className="text-xs text-brand-500">{f.label}</p>
                        </div>
                        <EditableField
                          value={String((detalhe as never)[f.key] ?? '')}
                          onSave={v => salvarCampo(detalhe.id, String(f.key), v)}
                          placeholder="—"
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {detalhe.obs && (
                  <>
                    <hr className="border-brand-100" />
                    <div>
                      <p className="text-xs text-brand-400 mb-1">Observações</p>
                      <p className="text-sm text-brand-700 whitespace-pre-line">{detalhe.obs}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ABA EXIGÊNCIAS ── */}
            {abaDetalhe === 'exigencias' && (
              <div className="space-y-4">
                {/* Formulário de nova exigência */}
                <div className="bg-brand-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-brand-600">Registrar nova exigência</p>
                  <input
                    value={novaExig.descricao}
                    onChange={e => setNovaExig(n => ({ ...n, descricao: e.target.value }))}
                    placeholder="Descrição da exigência (Junta, Prefeitura, etc.)"
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-brand-400">Data limite</label>
                      <input type="date"
                        value={novaExig.data_limite}
                        onChange={e => setNovaExig(n => ({ ...n, data_limite: e.target.value }))}
                        className="w-full border border-brand-200 rounded-lg px-3 py-1.5 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-brand-400">Responsável</label>
                      <input
                        value={novaExig.responsavel}
                        onChange={e => setNovaExig(n => ({ ...n, responsavel: e.target.value }))}
                        placeholder="Quem vai sanar"
                        className="w-full border border-brand-200 rounded-lg px-3 py-1.5 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                      />
                    </div>
                  </div>
                  <button
                    onClick={addExig}
                    disabled={salvandoExig || !novaExig.descricao.trim()}
                    className="w-full text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
                  >{salvandoExig ? 'Salvando…' : '+ Registrar exigência'}</button>
                </div>

                {/* Lista de exigências */}
                {(detalhe.exigencias ?? []).length === 0 ? (
                  <p className="text-center text-brand-300 text-sm py-6">Nenhuma exigência registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {[...(detalhe.exigencias ?? [])].reverse().map(exig => (
                      <div key={exig.id} className={`border rounded-xl p-3 space-y-1 ${exig.sanado ? 'bg-emerald-50 border-emerald-200 opacity-70' : 'bg-white border-brand-100'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${exig.sanado ? 'line-through text-brand-400' : 'text-brand-800'}`}>
                            {exig.descricao}
                          </p>
                          <div className="flex gap-1 shrink-0">
                            {!exig.sanado && (
                              <button
                                onClick={() => resolverExig(exig.id)}
                                className="p-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
                                title="Marcar como sanada"
                              ><CheckCircle2 size={14} /></button>
                            )}
                            <button
                              onClick={() => deletarExig(exig.id)}
                              className="p-1 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition"
                              title="Remover"
                            ><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-brand-400">
                          {exig.responsavel && <span>Resp.: {exig.responsavel}</span>}
                          {exig.data_limite && (
                            <span className={isAtrasado(exig.data_limite) && !exig.sanado ? 'text-red-500 font-semibold' : ''}>
                              Limite: {fmtData(exig.data_limite)}
                            </span>
                          )}
                          {exig.sanado && exig.sanado_em && (
                            <span className="text-emerald-600">Sanada em {new Date(exig.sanado_em).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ABA DOCUMENTOS ── */}
            {abaDetalhe === 'docs' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">
                    Documentos Societários
                  </p>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-accent-600 text-white rounded-lg hover:bg-accent-700"
                  >
                    <Paperclip size={12} /> Anexar
                  </button>
                </div>

                {uploadErro && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadErro}</p>
                )}

                {loadingAnexos ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-brand-300" />
                  </div>
                ) : anexosProcesso.length === 0 ? (
                  <div className="text-center py-8 text-brand-400">
                    <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum arquivo anexado.</p>
                    <p className="text-xs mt-1">Clique em &quot;Anexar&quot; para adicionar documentos societários.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {anexosProcesso.map(a => (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 bg-brand-50 rounded-xl border border-brand-100">
                        <span className="text-xl flex-shrink-0">{iconeArquivo(a.tipo_mime)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-800 truncate">{a.nome_original}</p>
                          <p className="text-xs text-brand-400">
                            {fmtTamanho(a.tamanho)} · {new Date(a.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => abrirAnexoProcesso(a)}
                            title="Abrir"
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                          >
                            <ExternalLink size={14} />
                          </button>
                          <button
                            onClick={() => removerAnexoProcesso(a)}
                            title="Remover"
                            className="p-1.5 rounded hover:bg-red-100 text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    )
  }

  // ─── Render principal ─────────────────────────────────────

  return (
    <Shell>
      <div className="max-w-full mx-auto px-2 md:px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText size={24} className="text-brand-600" />
            <div>
              <h1 className="text-xl font-bold text-brand-800">Legalização & Processos Societários</h1>
              <p className="text-xs text-brand-400">Aberturas, alterações, baixas, licenciamentos e protocolos</p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Toggle view */}
            <div className="flex rounded-lg border border-brand-200 overflow-hidden">
              <button onClick={() => setView('kanban')} className={`px-3 py-2 text-xs flex items-center gap-1.5 transition ${view === 'kanban' ? 'bg-brand-700 text-white' : 'text-brand-500 hover:bg-brand-50'}`}>
                <LayoutGrid size={14} /> Kanban
              </button>
              <button onClick={() => setView('lista')} className={`px-3 py-2 text-xs flex items-center gap-1.5 transition ${view === 'lista' ? 'bg-brand-700 text-white' : 'text-brand-500 hover:bg-brand-50'}`}>
                <List size={14} /> Lista
              </button>
            </div>
            <button
              onClick={() => { setShowForm(!showForm); setMsg(null) }}
              className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Plus size={16} /> Novo Processo
            </button>
          </div>
        </div>

        {msg && (
          <div className={`text-sm rounded-lg px-4 py-2 border ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {msg.texto}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: 'Total',       valor: kpis.total,      cor: 'text-brand-700' },
            { label: 'Em andamento',valor: kpis.andamento,  cor: 'text-blue-600' },
            { label: 'Aguardando',  valor: kpis.aguardando, cor: 'text-purple-600' },
            { label: 'Atrasados',   valor: kpis.atrasados,  cor: 'text-red-600' },
            { label: 'Concluídos',  valor: kpis.concluidos, cor: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-brand-100 rounded-xl px-4 py-3 text-center">
              <p className="text-[10px] text-brand-400">{s.label}</p>
              <p className={`text-2xl font-bold ${s.cor}`}>{s.valor}</p>
            </div>
          ))}
        </div>

        {/* Formulário de novo processo */}
        {showForm && (
          <div className="bg-white border border-brand-100 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-700">Novo Processo Societário</h3>
              <button onClick={() => { setShowForm(false); setForm(FORM_VAZIO) }}><X size={16} className="text-brand-400" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-brand-500 block mb-1">Cliente *</label>
                <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400">
                  <option value="">Selecione o cliente…</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Tipo de ato *</label>
                <select value={form.tipo_ato} onChange={e => setForm(f => ({ ...f, tipo_ato: e.target.value as TipoAtoProcesso }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400">
                  {TIPOS_ATO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-brand-500 block mb-1">Descrição *</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Abertura de LTDA — Comércio de alimentos — Rua das Flores"
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400" />
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Prazo</label>
                <input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400" />
              </div>
              <div>
                <label className="text-xs text-brand-500 block mb-1">Responsável principal</label>
                <input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                  placeholder="Nome do colaborador responsável"
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-brand-500 block mb-1">
                  <Users size={12} className="inline mr-1" />Responsáveis conjuntos
                  <span className="text-brand-300 ml-1">(separar por vírgula)</span>
                </label>
                <input value={form.responsaveis_txt} onChange={e => setForm(f => ({ ...f, responsaveis_txt: e.target.value }))}
                  placeholder="João Silva, Maria Oliveira"
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-brand-500 block mb-1">Observações iniciais</label>
                <textarea rows={2} value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setForm(FORM_VAZIO) }} className="text-sm text-brand-500 px-3 py-1.5 hover:bg-brand-50 rounded-lg">Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.descricao.trim() || !form.cliente_id}
                className="text-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white font-medium px-4 py-1.5 rounded-lg">
                {salvando ? 'Salvando…' : 'Criar Processo'}
              </button>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por descrição, cliente, protocolo…"
              className="w-full border border-brand-200 rounded-lg pl-9 pr-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['Todos', 'Pendente', 'Em andamento', 'Aguardando', 'Concluído', 'Cancelado'] as const).map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                className={`text-xs px-2 py-1 rounded-full border transition ${filtroStatus === s ? 'bg-brand-700 text-white border-brand-700' : 'border-brand-200 text-brand-500 hover:bg-brand-50'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['Todos', ...TIPOS_ATO] as const).map(t => (
            <button key={t} onClick={() => setFiltroTipo(t as TipoAtoProcesso | 'Todos')}
              className={`text-xs px-2 py-1 rounded-full border transition ${filtroTipo === t ? 'bg-accent-600 text-white border-accent-600' : 'border-brand-200 text-brand-500 hover:bg-brand-50'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* ─── View Kanban ─── */}
        {!loading && view === 'kanban' && (
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex gap-3 min-w-max pb-2">
              {ETAPAS.map(etapa => {
                const cards = lista.filter(p => (p.etapa_atual ?? 'Viabilidade') === etapa)
                return (
                  <div key={etapa} className="w-64 shrink-0">
                    <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border border-b-0 border-brand-100 bg-brand-50`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          etapa === 'Concluído' ? 'bg-emerald-500' :
                          etapa === 'Licenciamento' ? 'bg-rose-400' :
                          etapa === 'Insc. Municipal/Estadual' ? 'bg-amber-400' :
                          etapa === 'Junta Comercial' ? 'bg-purple-400' :
                          etapa === 'DBE / Redesim' ? 'bg-blue-400' :
                          'bg-slate-400'
                        }`} />
                        <p className="text-xs font-semibold text-brand-700">{etapa}</p>
                      </div>
                      <span className="text-xs bg-brand-200 text-brand-600 px-1.5 py-0.5 rounded-full font-medium">{cards.length}</span>
                    </div>
                    <div className="border border-brand-100 rounded-b-xl p-2 space-y-2 bg-brand-50/50 min-h-[120px]">
                      {cards.length === 0 ? (
                        <p className="text-center text-brand-200 text-[11px] py-4">Nenhum processo</p>
                      ) : (
                        cards.map(p => <ProcessoCard key={p.id} p={p} />)
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── View Lista ─── */}
        {!loading && view === 'lista' && (
          <div className="space-y-2">
            {lista.length === 0 ? (
              <div className="py-12 text-center text-brand-300 text-sm">Nenhum processo encontrado.</div>
            ) : lista.map(p => {
              const atrasado = isAtrasado(p.prazo) && p.status !== 'Concluído' && p.status !== 'Cancelado'
              const sc = STATUS_CFG[p.status] ?? STATUS_CFG['Pendente']
              const exigPend = (p.exigencias ?? []).filter(e => !e.sanado).length
              return (
                <div key={p.id}
                  className={`bg-white border rounded-xl p-4 hover:border-brand-200 cursor-pointer transition ${atrasado ? 'border-red-200' : 'border-brand-100'}`}
                  onClick={() => { setDetalhe(p); setAbaDetalhe('protocolos') }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${TIPO_COR[p.tipo_ato ?? 'Outro']}`}>
                          {p.tipo_ato ?? 'Abertura'}
                        </span>
                        {p.clientes?.nome && <span className="text-xs text-brand-500">{p.clientes.nome}</span>}
                        {exigPend > 0 && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">{exigPend} exig.</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-brand-800">{p.descricao}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <EtapasBar etapa={p.etapa_atual ?? 'Viabilidade'} />
                        <span className="text-[10px] text-brand-400 hidden sm:inline">{p.etapa_atual ?? 'Viabilidade'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${sc.cor}`}>
                        {sc.icon} {sc.label}
                      </span>
                      {p.prazo && (
                        <span className={`text-[11px] ${atrasado ? 'text-red-500 font-semibold' : 'text-brand-400'}`}>
                          {atrasado ? '⚠ ' : ''}{fmtData(p.prazo)}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-brand-300" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {loading && <div className="py-12 text-center text-brand-300 text-sm">Carregando processos…</div>}
      </div>

      {/* Modal de detalhe */}
      <Detalhe />

      {showUpload && detalhe && (
        <FileUploadModal
          titulo="Anexar ao Processo"
          bucket={BUCKET_PRINCIPAL}
          pasta={`processos/${detalhe.id}`}
          referencia_tipo="processo"
          referencia_id={detalhe.id}
          criado_por={userId}
          onUpload={(files) => handleUploadProcesso(files)}
          onClose={() => setShowUpload(false)}
        />
      )}
    </Shell>
  )
}

// ─── Barra de etapas compacta ────────────────────────────────

function EtapasBar({ etapa }: { etapa: EtapaProcesso }) {
  const idx = ETAPAS.indexOf(etapa)
  return (
    <div className="flex items-center gap-0">
      {ETAPAS.map((_, i) => (
        <div key={i} className="flex items-center">
          <div className={`w-2 h-2 rounded-full border-2 shrink-0 ${
            i < idx  ? 'bg-emerald-500 border-emerald-500' :
            i === idx ? 'bg-accent-500 border-accent-500' :
                        'bg-white border-brand-200'
          }`} />
          {i < ETAPAS.length - 1 && (
            <div className={`h-0.5 w-4 ${i < idx ? 'bg-emerald-400' : 'bg-brand-100'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Campo editável inline ───────────────────────────────────

interface EditableFieldProps {
  value: string
  onSave: (v: string) => Promise<void>
  placeholder?: string
  compact?: boolean
  isArray?: boolean
  onSaveArray?: (arr: string[]) => Promise<void>
}

function EditableField({ value, onSave, placeholder, compact, isArray, onSaveArray }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value)
  const [saving, setSaving]   = useState(false)

  useEffect(() => { setVal(value) }, [value])

  async function confirmar() {
    setSaving(true)
    try {
      if (isArray && onSaveArray) {
        await onSaveArray(val.split(',').map(s => s.trim()).filter(Boolean))
      } else {
        await onSave(val)
      }
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex gap-1 flex-1 min-w-0">
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditing(false) }}
          className={`flex-1 border border-accent-400 rounded px-2 py-1 text-sm text-brand-800 focus:outline-none min-w-0 ${compact ? 'text-xs' : ''}`}
        />
        <button onClick={confirmar} disabled={saving}
          className="text-emerald-600 hover:text-emerald-700 px-1">
          <CheckCircle2 size={16} />
        </button>
        <button onClick={() => { setEditing(false); setVal(value) }}
          className="text-brand-400 hover:text-brand-600 px-1">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`flex-1 text-left px-2 py-1 rounded hover:bg-brand-50 transition group ${compact ? 'text-xs' : 'text-sm'} ${value ? 'text-brand-800 font-medium' : 'text-brand-300 italic'}`}
    >
      {value || placeholder}
      <span className="ml-1 opacity-0 group-hover:opacity-100 text-brand-300 text-[10px]">editar</span>
    </button>
  )
}
