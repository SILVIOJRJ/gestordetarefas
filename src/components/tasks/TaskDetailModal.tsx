'use client'

import { useState, useEffect } from 'react'
import {
  X, Clock, User, Tag, FileText, Send,
  CheckCircle2, Circle, AlertCircle, Loader2,
  Paperclip, Trash2, ExternalLink,
} from 'lucide-react'
import type { Tarefa, StatusTarefa, TipoEventoTarefa } from '@/types/database.types'
import { atualizarStatus, registrarEvento, listarEventos } from '@/services/tasks'
import {
  uploadERegistrar, listarAnexos, deletarAnexo, obterSignedUrl,
  BUCKET_PRINCIPAL, fmtTamanho, iconeArquivo,
  type AnexoInfo,
} from '@/services/storage'
import FileUploadModal from '@/components/common/FileUploadModal'
import { supabase } from '@/lib/supabase'

interface Evento {
  id: string
  tipo: TipoEventoTarefa
  titulo: string | null
  protocolo: string | null
  situacao: string | null
  descricao: string | null
  autor: string | null
  created_at: string
}

interface Props {
  tarefa: Tarefa & { clientes?: { nome: string } | null }
  onClose: () => void
  onUpdate: () => void
}

type Tab = 'historico' | 'anexos'

const STATUS_OPTIONS: StatusTarefa[] = ['Pendente', 'Em andamento', 'Aguardando', 'Concluída', 'Cancelada']

const STATUS_COLOR: Record<StatusTarefa, string> = {
  'Pendente':     'bg-warning-100 text-warning-600',
  'Em andamento': 'bg-blue-100 text-blue-700',
  'Aguardando':   'bg-brand-100 text-brand-600',
  'Concluída':    'bg-accent-100 text-accent-700',
  'Cancelada':    'bg-danger-100 text-danger-600',
}

const TIPO_ICON: Record<TipoEventoTarefa, React.ReactNode> = {
  abertura:   <Circle size={14} className="text-brand-400" />,
  progresso:  <Clock size={14} className="text-blue-500" />,
  protocolo:  <Tag size={14} className="text-accent-600" />,
  situacao:   <AlertCircle size={14} className="text-warning-600" />,
  conclusao:  <CheckCircle2 size={14} className="text-accent-600" />,
}

export default function TaskDetailModal({ tarefa, onClose, onUpdate }: Props) {
  const [tab, setTab]                 = useState<Tab>('historico')
  const [eventos, setEventos]         = useState<Evento[]>([])
  const [loadingEvt, setLoadingEvt]   = useState(true)
  const [novoStatus, setNovoStatus]   = useState<StatusTarefa>(tarefa.status)
  const [obs, setObs]                 = useState('')
  const [saving, setSaving]           = useState(false)
  const [autorNome, setAutorNome]     = useState('Usuário')
  const [userId, setUserId]           = useState('')

  // Anexos
  const [anexos, setAnexos]           = useState<AnexoInfo[]>([])
  const [loadingAnexos, setLoadingAnexos] = useState(false)
  const [showUpload, setShowUpload]   = useState(false)
  const [uploadErro, setUploadErro]   = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setAutorNome(data.user.email)
      if (data.user?.id)    setUserId(data.user.id)
    })
    listarEventos(tarefa.id).then((data) => {
      setEventos(data as Evento[])
      setLoadingEvt(false)
    })
  }, [tarefa.id])

  useEffect(() => {
    if (tab !== 'anexos') return
    setLoadingAnexos(true)
    listarAnexos('tarefa', tarefa.id)
      .then(setAnexos)
      .finally(() => setLoadingAnexos(false))
  }, [tab, tarefa.id])

  async function salvarStatus() {
    if (novoStatus === tarefa.status && !obs.trim()) return
    setSaving(true)
    try {
      if (novoStatus !== tarefa.status) {
        await atualizarStatus(tarefa.id, novoStatus, autorNome, obs.trim() || undefined)
      } else if (obs.trim()) {
        await registrarEvento(tarefa.id, 'progresso', obs.trim(), null, null, null, autorNome)
      }
      const updated = await listarEventos(tarefa.id)
      setEventos(updated as Evento[])
      setObs('')
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(files: File[]) {
    setUploadErro(null)
    try {
      const novos: AnexoInfo[] = []
      for (const file of files) {
        const info = await uploadERegistrar({
          file,
          bucket: BUCKET_PRINCIPAL,
          pasta: `tarefas/${tarefa.id}`,
          referencia_tipo: 'tarefa',
          referencia_id: tarefa.id,
          criado_por: userId || autorNome,
        })
        novos.push(info)
      }
      setAnexos(prev => [...novos, ...prev])
      setShowUpload(false)
    } catch (e) {
      setUploadErro(e instanceof Error ? e.message : 'Erro no upload')
    }
  }

  async function abrirAnexo(anexo: AnexoInfo) {
    try {
      const url = await obterSignedUrl(BUCKET_PRINCIPAL, anexo.url)
      window.open(url, '_blank')
    } catch {
      alert('Falha ao gerar link de acesso.')
    }
  }

  async function removerAnexo(anexo: AnexoInfo) {
    if (!confirm(`Remover "${anexo.nome_original}"?`)) return
    try {
      await deletarAnexo(anexo.id, anexo.url)
      setAnexos(prev => prev.filter(a => a.id !== anexo.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao remover')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">

          {/* Header */}
          <div className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-brand-200">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-brand-500 mb-0.5">
                {tarefa.clientes?.nome ?? '—'} · {tarefa.setor ?? '—'}
              </p>
              <h2 className="text-base font-bold text-brand-900 leading-snug">{tarefa.titulo}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-400 flex-shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-brand-100 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[tarefa.status]}`}>
              {tarefa.status}
            </span>
            <span className="flex items-center gap-1 text-brand-500">
              <User size={12} /> {tarefa.responsavel ?? 'Sem responsável'}
            </span>
            {tarefa.prazo && (
              <span className="flex items-center gap-1 text-brand-500">
                <Clock size={12} /> {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}
              </span>
            )}
            {tarefa.descricao && (
              <span className="flex items-center gap-1 text-brand-500 w-full">
                <FileText size={12} /> {tarefa.descricao}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-brand-200 px-5">
            {(['historico', 'anexos'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-brand-500 hover:text-brand-800'
                }`}
              >
                {t === 'historico' ? '📋 Histórico' : `📎 Anexos${anexos.length > 0 ? ` (${anexos.length})` : ''}`}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === 'historico' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">Histórico</p>
                {loadingEvt ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-brand-300" />
                  </div>
                ) : eventos.length === 0 ? (
                  <p className="text-xs text-brand-400 text-center py-4">Nenhum evento registrado.</p>
                ) : (
                  <ol className="relative border-l border-brand-200 ml-2 space-y-4">
                    {eventos.map((evt) => (
                      <li key={evt.id} className="ml-4">
                        <span className="absolute -left-1.5 mt-0.5 flex items-center justify-center w-3 h-3 bg-white rounded-full">
                          {TIPO_ICON[evt.tipo]}
                        </span>
                        <div className="bg-brand-50 rounded-lg px-3 py-2">
                          {evt.titulo && <p className="text-xs font-semibold text-brand-800">{evt.titulo}</p>}
                          {evt.descricao && <p className="text-xs text-brand-600 mt-0.5">{evt.descricao}</p>}
                          <p className="text-[10px] text-brand-400 mt-1">
                            {evt.autor} · {new Date(evt.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {tab === 'anexos' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">Documentos Anexados</p>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Paperclip size={12} /> Anexar arquivo
                  </button>
                </div>

                {uploadErro && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadErro}</p>
                )}

                {loadingAnexos ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-brand-300" />
                  </div>
                ) : anexos.length === 0 ? (
                  <div className="text-center py-8 text-brand-400">
                    <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum arquivo anexado.</p>
                    <p className="text-xs mt-1">Clique em &quot;Anexar arquivo&quot; para adicionar.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {anexos.map(a => (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 bg-brand-50 rounded-lg border border-brand-100">
                        <span className="text-xl flex-shrink-0">{iconeArquivo(a.tipo_mime)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-800 truncate">{a.nome_original}</p>
                          <p className="text-xs text-brand-400">
                            {fmtTamanho(a.tamanho)} · {new Date(a.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => abrirAnexo(a)}
                            title="Abrir"
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                          >
                            <ExternalLink size={14} />
                          </button>
                          <button
                            onClick={() => removerAnexo(a)}
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

          {/* Ações (apenas na aba histórico) */}
          {tab === 'historico' && (
            <div className="border-t border-brand-200 px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={novoStatus}
                  onChange={(e) => setNovoStatus(e.target.value as StatusTarefa)}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Observação ou progresso (opcional)..."
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarStatus() }}
                />
                <button onClick={salvarStatus} disabled={saving} className="btn-primary px-4">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <FileUploadModal
          titulo="Anexar à Tarefa"
          bucket={BUCKET_PRINCIPAL}
          pasta={`tarefas/${tarefa.id}`}
          referencia_tipo="tarefa"
          referencia_id={tarefa.id}
          criado_por={userId || autorNome}
          onUpload={(files) => handleUpload(files)}
          onClose={() => setShowUpload(false)}
        />
      )}
    </>
  )
}
