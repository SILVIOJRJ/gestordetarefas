'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Paperclip, X, Upload, Loader2, CheckCircle2, AlertTriangle,
  Link2, Plus, Archive, Sparkles, ChevronRight, FileText,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadDocumentoComIA } from '@/services/documents'
import type { DadosDocumentoExtraidos } from '@/lib/gemini'

// ─── Tipos ────────────────────────────────────────────────────

type Etapa = 'idle' | 'processando' | 'decisao' | 'concluido'

interface TarefaAberta {
  id: string
  titulo: string
  setor: string
  status: string
}

interface ClienteMatch {
  id: string
  nome: string
  telefone?: string | null
}

interface ResultadoIA {
  anexoId: string
  caminho: string
  nomeArquivo: string
  dados: DadosDocumentoExtraidos
  alocado: boolean
  alocacaoDetalhes: string[]
  clienteSugerido: ClienteMatch | null
  tarefasAbertas: TarefaAberta[]
}

interface Props {
  open: boolean
  onClose: () => void
}

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtCompetencia(c: string | null) {
  if (!c) return null
  const [mm, yyyy] = c.split('/')
  const m = parseInt(mm)
  return `${MESES_PT[(m - 1)] ?? mm}/${yyyy}`
}

// ─── Componente ───────────────────────────────────────────────

export default function SmartUploadPanel({ open, onClose }: Props) {
  const [etapa, setEtapa]             = useState<Etapa>('idle')
  const [progresso, setProgresso]     = useState('')
  const [dragging, setDragging]       = useState(false)
  const [erro, setErro]               = useState<string | null>(null)
  const [resultado, setResultado]     = useState<ResultadoIA | null>(null)
  // Decisão do usuário
  const [clienteId, setClienteId]     = useState('')
  const [tarefaId, setTarefaId]       = useState('')
  const [mes, setMes]                 = useState(() => new Date().getMonth() + 1)
  const [ano, setAno]                 = useState(() => new Date().getFullYear())
  const [clientes, setClientes]       = useState<ClienteMatch[]>([])
  const [tarefasDoPainel, setTarefas] = useState<TarefaAberta[]>([])
  const [salvando, setSalvando]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const competencia = `${ano}-${String(mes).padStart(2, '0')}`

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from('clientes') as any).select('id, nome, telefone').order('nome').then(
      ({ data }: { data: ClienteMatch[] | null }) => setClientes(data ?? []),
    )
  }, [open])

  // Quando cliente muda, carrega tarefas abertas
  useEffect(() => {
    if (!clienteId) { setTarefas([]); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from('tarefas') as any)
      .select('id, titulo, setor, status')
      .eq('cliente_id', clienteId)
      .neq('status', 'Concluída')
      .order('titulo')
      .then(({ data }: { data: TarefaAberta[] | null }) => setTarefas(data ?? []))
  }, [clienteId])

  async function processarArquivo(arquivo: File) {
    if (arquivo.size > 20 * 1024 * 1024) {
      setErro('Arquivo muito grande — máximo 20 MB.')
      return
    }
    setEtapa('processando')
    setErro(null)
    setProgresso('Enviando para o Gemini...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const criadoPor = user?.email ?? user?.id ?? 'desconhecido'

      // Upload + análise IA (competência opcional — usuário decide depois)
      const r = await uploadDocumentoComIA(arquivo, clienteId || '__sem_cliente__', criadoPor, competencia)

      // Tenta encontrar cliente pela razão social ou CNPJ extraído pela IA
      let clienteSugerido: ClienteMatch | null = null
      const cnpj = r.dados.cnpj_cpf?.replace(/\D/g, '')
      const nome  = (r.dados.razao_social_ou_nome ?? '').toLowerCase()

      if (cnpj || nome) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: found } = await (supabase.from('clientes') as any)
          .select('id, nome, telefone')
          .or(cnpj ? `cnpj_cpf.ilike.%${cnpj}%` : `nome.ilike.%${nome}%`)
          .limit(1)
          .single()
        if (found) clienteSugerido = found as ClienteMatch
      }

      // Tarefas abertas para o cliente sugerido (ou selecionado)
      const cidParaTarefas = clienteId || clienteSugerido?.id
      let tarefasAbertas: TarefaAberta[] = []
      if (cidParaTarefas) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: t } = await (supabase.from('tarefas') as any)
          .select('id, titulo, setor, status')
          .eq('cliente_id', cidParaTarefas)
          .neq('status', 'Concluída')
          .order('titulo')
        tarefasAbertas = (t ?? []) as TarefaAberta[]
      }

      setResultado({ ...r, nomeArquivo: arquivo.name, clienteSugerido, tarefasAbertas })

      // Pré-seleciona cliente sugerido se não havia seleção manual
      if (!clienteId && clienteSugerido) setClienteId(clienteSugerido.id)
      setTarefas(tarefasAbertas)
      setEtapa('decisao')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar documento.')
      setEtapa('idle')
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processarArquivo(f)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, competencia])

  async function confirmarDecisao(acao: 'vincular' | 'criar_tarefa' | 'arquivar') {
    if (!resultado) return
    setSalvando(true)

    try {
      if (acao === 'vincular' && tarefaId) {
        // Vincula o anexo à tarefa selecionada
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('anexos') as any)
          .update({ referencia_tipo: 'tarefa', referencia_id: tarefaId })
          .eq('id', resultado.anexoId)
      }

      if (acao === 'criar_tarefa') {
        const d = resultado.dados
        const titulo = [
          d.tipo_documento !== 'OUTRO' ? `[${d.tipo_documento}]` : null,
          d.razao_social_ou_nome ?? 'Documento',
          d.competencia ? `— ${d.competencia}` : null,
          d.valor != null ? `R$ ${d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null,
        ].filter(Boolean).join(' ')

        const prazo = d.data_vencimento ?? null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: nova } = await (supabase.from('tarefas') as any)
          .insert({
            titulo,
            cliente_id:  clienteId || null,
            setor:       'FISCAL',
            prioridade:  'Alta',
            status:      'Pendente',
            prazo,
            descricao: resultado.alocacaoDetalhes.length
              ? `Gerado automaticamente por upload.\n${resultado.alocacaoDetalhes.join('\n')}`
              : 'Gerado automaticamente por upload via Upload Inteligente.',
          })
          .select('id').single()

        if (nova?.id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('anexos') as any)
            .update({ referencia_tipo: 'tarefa', referencia_id: nova.id })
            .eq('id', resultado.anexoId)
        }
      }

      // Atualiza cliente vinculado se foi selecionado/confirmado
      if (clienteId && clienteId !== '__sem_cliente__') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('anexos') as any)
          .update({ referencia_tipo: 'cliente', referencia_id: clienteId })
          .eq('id', resultado.anexoId)
      }

      setEtapa('concluido')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar.')
    } finally {
      setSalvando(false)
    }
  }

  function fecharEReset() {
    setEtapa('idle')
    setErro(null)
    setResultado(null)
    setClienteId('')
    setTarefaId('')
    onClose()
  }

  if (!open) return null

  const d = resultado?.dados

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm"
        onClick={fecharEReset}
      />

      {/* Painel lateral direito */}
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-brand-100">
          <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center">
            <Paperclip size={16} className="text-accent-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-brand-900 text-sm">Upload Inteligente</p>
            <p className="text-xs text-brand-400">OCR + alocação automática</p>
          </div>
          <button onClick={fecharEReset} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-400">
            <X size={18} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── ETAPA: idle ─────────────────────────────── */}
          {etapa === 'idle' && (
            <>
              {/* Competência + Cliente (opcional antes do upload) */}
              <div className="space-y-3">
                <div>
                  <label className="input-label">CLIENTE (opcional — IA tenta detectar)</label>
                  <select className="input w-full text-sm" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                    <option value="">Detectar automaticamente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">COMPETÊNCIA</label>
                  <div className="flex gap-2">
                    <select className="input flex-1 text-sm" value={mes} onChange={e => setMes(Number(e.target.value))}>
                      {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
                        .map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                    </select>
                    <input type="number" className="input w-20 text-sm" value={ano} min={2020} max={2040}
                      onChange={e => setAno(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* Drag & Drop */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                  dragging ? 'border-accent-500 bg-accent-50' : 'border-brand-200 hover:border-brand-400 hover:bg-brand-50',
                ].join(' ')}
              >
                <Upload size={28} className="mx-auto mb-3 text-brand-400" />
                <p className="text-sm font-medium text-brand-700">Solte o arquivo aqui</p>
                <p className="text-xs text-brand-400 mt-1">ou clique para selecionar</p>
                <p className="text-xs text-brand-300 mt-2">PDF · JPG · PNG · XML · OFX — até 20 MB</p>
              </div>
              <input ref={inputRef} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xml,.ofx"
                onChange={e => { const f = e.target.files?.[0]; if (f) processarArquivo(f) }} />

              {erro && (
                <div className="flex gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}
            </>
          )}

          {/* ── ETAPA: processando ──────────────────────── */}
          {etapa === 'processando' && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-accent-50 flex items-center justify-center">
                  <Sparkles size={28} className="text-accent-500" />
                </div>
                <Loader2 size={18} className="animate-spin text-accent-500 absolute -bottom-1 -right-1" />
              </div>
              <div>
                <p className="font-medium text-brand-800">{progresso}</p>
                <p className="text-xs text-brand-400 mt-1">
                  Gemini analisando tipo, empresa, vencimento e valores...
                </p>
              </div>
            </div>
          )}

          {/* ── ETAPA: decisao ──────────────────────────── */}
          {etapa === 'decisao' && resultado && d && (
            <div className="space-y-4">

              {/* Card resultado IA */}
              <div className="rounded-xl border border-brand-200 overflow-hidden">
                <div className="bg-brand-50 px-4 py-3 flex items-center gap-2">
                  <FileText size={15} className="text-brand-500" />
                  <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide truncate flex-1">{resultado.nomeArquivo}</p>
                  <span className="text-xs bg-accent-100 text-accent-700 px-2 py-0.5 rounded-full font-medium">
                    {d.tipo_documento}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-xs">
                  {[
                    { l: 'Empresa',     v: d.razao_social_ou_nome },
                    { l: 'CNPJ/CPF',    v: d.cnpj_cpf },
                    { l: 'Competência', v: fmtCompetencia(d.competencia) },
                    { l: 'Vencimento',  v: d.data_vencimento ? new Date(d.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : null },
                    { l: 'Valor',       v: d.valor != null ? `R$ ${d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null },
                    { l: 'Chave PIX',   v: d.chave_pix },
                  ].filter(x => x.v).map(({ l, v }) => (
                    <div key={l}>
                      <p className="text-brand-400">{l}</p>
                      <p className="font-medium text-brand-800">{v}</p>
                    </div>
                  ))}
                </div>
                {resultado.alocado && (
                  <div className="border-t border-brand-100 px-4 py-2 bg-emerald-50 space-y-0.5">
                    <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Alocado automaticamente
                    </p>
                    {resultado.alocacaoDetalhes.map((det, i) => (
                      <p key={i} className="text-xs text-emerald-600">✓ {det}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmar / corrigir cliente */}
              <div>
                <label className="input-label">
                  CLIENTE VINCULADO
                  {resultado.clienteSugerido && (
                    <span className="ml-2 text-accent-600 font-normal normal-case">
                      — IA detectou: {resultado.clienteSugerido.nome}
                    </span>
                  )}
                </label>
                <select className="input w-full text-sm" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                  <option value="">Sem vínculo</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {/* Vincular à tarefa existente */}
              {tarefasDoPainel.length > 0 && (
                <div>
                  <label className="input-label">VINCULAR À TAREFA EXISTENTE (opcional)</label>
                  <select className="input w-full text-sm" value={tarefaId} onChange={e => setTarefaId(e.target.value)}>
                    <option value="">— Não vincular —</option>
                    {tarefasDoPainel.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.setor}] {t.titulo} · {t.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ações */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">O que deseja fazer?</p>

                {tarefaId && (
                  <button
                    onClick={() => confirmarDecisao('vincular')}
                    disabled={salvando}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-accent-300 bg-accent-50 hover:bg-accent-100 transition-colors text-left"
                  >
                    <Link2 size={18} className="text-accent-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-accent-800">Vincular à tarefa selecionada</p>
                      <p className="text-xs text-accent-600">Anexa o documento à tarefa e atualiza o status</p>
                    </div>
                    {salvando ? <Loader2 size={14} className="animate-spin text-accent-500" /> : <ChevronRight size={14} className="text-accent-400" />}
                  </button>
                )}

                <button
                  onClick={() => confirmarDecisao('criar_tarefa')}
                  disabled={salvando}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-200 hover:border-brand-400 hover:bg-brand-50 transition-colors text-left"
                >
                  <Plus size={18} className="text-brand-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-800">Criar tarefa automaticamente</p>
                    <p className="text-xs text-brand-400">Gera tarefa FISCAL com os dados extraídos e anexa</p>
                  </div>
                  {salvando ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} className="text-brand-300" />}
                </button>

                <button
                  onClick={() => confirmarDecisao('arquivar')}
                  disabled={salvando}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-100 hover:bg-brand-50 transition-colors text-left"
                >
                  <Archive size={18} className="text-brand-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-700">Apenas arquivar</p>
                    <p className="text-xs text-brand-400">Mantém no Storage vinculado ao cliente</p>
                  </div>
                  <ChevronRight size={14} className="text-brand-200" />
                </button>
              </div>

              {erro && (
                <div className="flex gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}
            </div>
          )}

          {/* ── ETAPA: concluido ────────────────────────── */}
          {etapa === 'concluido' && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-brand-900">Documento processado!</p>
                <p className="text-xs text-brand-400 mt-1">
                  Arquivo salvo, dados extraídos e ação aplicada.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setEtapa('idle'); setResultado(null); setTarefaId('') }}
                  className="btn-secondary text-sm"
                >
                  Enviar outro
                </button>
                <button onClick={fecharEReset} className="btn-primary text-sm">
                  Fechar
                </button>
              </div>
            </div>
          )}

        </div>
      </aside>
    </>
  )
}
