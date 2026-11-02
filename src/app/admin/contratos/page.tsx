'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import { gerarMinutaHtml, imprimirMinuta } from '@/services/reports'
import type { ModalidadeContrato, IndiceReajuste, DadosSCP, ClausulaContrato } from '@/services/reports'
import {
  FileSignature, Plus, Loader2, Save, X, Trash2, Printer,
  ChevronDown, ChevronUp, Shield, Paperclip, Upload, ExternalLink,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────

interface ClienteOpt { id: string; nome: string }

interface AnexoContrato {
  id: string
  nome_arquivo: string
  url_storage: string
  created_at: string
  tamanho_bytes?: number | null
}

interface ContratoAdmin {
  id: string
  cliente_id: string
  titulo: string
  modalidade: ModalidadeContrato | null
  valor_mensal: number | null
  dia_vencimento: number | null
  inicio: string
  termino: string | null
  renovacao_auto: boolean
  status: string
  servicos_inclusos: string[]
  servicos_extras: string[]
  indice_reajuste: IndiceReajuste | null
  percentual_fixo: number | null
  limite_notas_mensais: number | null
  multa_atraso: number | null
  foro_comarca: string | null
  clausulas: ClausulaContrato | null
  scp_dados: DadosSCP | null
  clientes?: { nome: string } | null
}

type FormState = Omit<ContratoAdmin, 'id' | 'clientes'>

const MODALIDADES: ModalidadeContrato[] = [
  'Prestação de Serviços Contábeis',
  'Assessoria e Consultoria',
  'Sociedade em Conta de Participação (SCP)',
]

const INDICES: IndiceReajuste[] = ['IPCA', 'IGPM', 'Fixo']

const SERVICOS_PADRAO = [
  'Escrituração Fiscal', 'Folha de Pagamento', 'Contabilidade',
  'FGTS/GPS', 'DCTF/SPED', 'Declaração IR PF', 'Legalização',
]

const CLAUSULAS_PADRAO: ClausulaContrato = {
  objeto: true,
  limiteDocumentos: false,
  multaClienteAtraso: false,
  reajusteAnual: true,
  vigencia: true,
  foro: true,
}

const CLAUSULA_LABELS: Record<keyof ClausulaContrato, string> = {
  objeto: 'Objeto do Contrato (padrão)',
  limiteDocumentos: 'Limite de documentos/mês',
  multaClienteAtraso: 'Multa por atraso do cliente (2% + SELIC)',
  reajusteAnual: 'Reajuste anual pelo índice selecionado',
  vigencia: 'Vigência indeterminada',
  foro: 'Foro eleito',
}

function emptyForm(): FormState {
  return {
    cliente_id: '',
    titulo: 'Contrato de Prestação de Serviços Contábeis',
    modalidade: 'Prestação de Serviços Contábeis',
    valor_mensal: null,
    dia_vencimento: 10,
    inicio: new Date().toISOString().slice(0, 10),
    termino: null,
    renovacao_auto: true,
    status: 'ativo',
    servicos_inclusos: [],
    servicos_extras: [],
    indice_reajuste: 'IPCA',
    percentual_fixo: null,
    limite_notas_mensais: 50,
    multa_atraso: 2,
    foro_comarca: 'Jacarezinho/PR',
    clausulas: { ...CLAUSULAS_PADRAO },
    scp_dados: null,
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminContratosPage() {
  const [autorizado, setAutorizado]   = useState<boolean | null>(null)
  const [contratos, setContratos]     = useState<ContratoAdmin[]>([])
  const [clientes, setClientes]       = useState<ClienteOpt[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editando, setEditando]       = useState<ContratoAdmin | null>(null)
  const [form, setForm]               = useState<FormState>(emptyForm())
  const [novoServico, setNovoServico] = useState('')
  const [novoExtra, setNovoExtra]     = useState('')
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState<string | null>(null)
  const [expandido, setExpandido]     = useState<string | null>(null)
  const [anexos, setAnexos]           = useState<Record<string, AnexoContrato[]>>({})
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [erroAnexo, setErroAnexo]     = useState<string | null>(null)

  // Verificação de acesso admin
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setAutorizado(false); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(supabase.from('perfis_usuarios') as any)
        .select('role, permissoes_modulos')
        .eq('id', user.id)
        .single()
        .then(({ data }: { data: { role: string; permissoes_modulos: Record<string, boolean> | null } | null }) => {
          const isAdmin = data?.role === 'admin'
          const temPermissao = data?.permissoes_modulos?.modulo_gestao_contratos === true
          setAutorizado(isAdmin || temPermissao)
        })
    })
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: ct }, { data: cl }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('contratos') as any)
          .select('*, clientes(nome)')
          .order('created_at', { ascending: false }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('clientes') as any).select('id, nome').order('nome'),
      ])
      setContratos((ct ?? []) as ContratoAdmin[])
      setClientes((cl ?? []) as ClienteOpt[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (autorizado) carregar() }, [autorizado, carregar])

  function abrirNovo() {
    setEditando(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function abrirEditar(c: ContratoAdmin) {
    setEditando(c)
    setForm({
      cliente_id: c.cliente_id,
      titulo: c.titulo,
      modalidade: c.modalidade,
      valor_mensal: c.valor_mensal,
      dia_vencimento: c.dia_vencimento,
      inicio: c.inicio,
      termino: c.termino,
      renovacao_auto: c.renovacao_auto,
      status: c.status,
      servicos_inclusos: c.servicos_inclusos ?? [],
      servicos_extras: c.servicos_extras ?? [],
      indice_reajuste: c.indice_reajuste,
      percentual_fixo: c.percentual_fixo,
      limite_notas_mensais: c.limite_notas_mensais,
      multa_atraso: c.multa_atraso,
      foro_comarca: c.foro_comarca,
      clausulas: c.clausulas ?? { ...CLAUSULAS_PADRAO },
      scp_dados: c.scp_dados,
    })
    setShowForm(true)
  }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleClausula(k: keyof ClausulaContrato) {
    setForm(f => ({ ...f, clausulas: { ...(f.clausulas ?? CLAUSULAS_PADRAO), [k]: !f.clausulas?.[k] } }))
  }

  function addServico(lista: 'servicos_inclusos' | 'servicos_extras', val: string) {
    if (!val.trim()) return
    setF(lista, [...form[lista], val.trim()])
    lista === 'servicos_inclusos' ? setNovoServico('') : setNovoExtra('')
  }

  function removeServico(lista: 'servicos_inclusos' | 'servicos_extras', idx: number) {
    setF(lista, form[lista].filter((_, i) => i !== idx))
  }

  async function salvar() {
    if (!form.cliente_id) { setErro('Selecione a empresa.'); return }
    setSaving(true); setErro(null)
    try {
      const payload = {
        cliente_id:           form.cliente_id,
        titulo:               form.titulo.trim(),
        modalidade:           form.modalidade,
        valor_mensal:         form.valor_mensal,
        dia_vencimento:       form.dia_vencimento,
        inicio:               form.inicio,
        termino:              form.termino || null,
        renovacao_auto:       form.renovacao_auto,
        status:               form.status,
        servicos_inclusos:    form.servicos_inclusos,
        servicos_extras:      form.servicos_extras,
        indice_reajuste:      form.indice_reajuste,
        percentual_fixo:      form.indice_reajuste === 'Fixo' ? form.percentual_fixo : null,
        limite_notas_mensais: form.limite_notas_mensais,
        multa_atraso:         form.multa_atraso,
        foro_comarca:         form.foro_comarca,
        clausulas:            form.clausulas,
        scp_dados:            form.modalidade === 'Sociedade em Conta de Participação (SCP)' ? form.scp_dados : null,
        descricao:            null,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = editando
        ? (supabase.from('contratos') as any).update(payload).eq('id', editando.id).select('id').single()
        : (supabase.from('contratos') as any).insert(payload).select('id').single()
      const { error } = await q
      if (error) throw error
      setShowForm(false)
      carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function carregarAnexos(contratoId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('anexos') as any)
      .select('id, nome_arquivo, url_storage, created_at, tamanho_bytes')
      .eq('referencia_tipo', 'contrato')
      .eq('referencia_id', contratoId)
      .order('created_at', { ascending: false })
    setAnexos(prev => ({ ...prev, [contratoId]: (data ?? []) as AnexoContrato[] }))
  }

  async function uploadAnexo(contratoId: string, file: File) {
    setUploadingId(contratoId); setErroAnexo(null)
    try {
      const ext = file.name.split('.').pop() ?? 'pdf'
      const path = `contratos/${contratoId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from('documentos-empresa')
        .upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage
        .from('documentos-empresa')
        .getPublicUrl(path)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbErr } = await (supabase.from('anexos') as any).insert({
        referencia_tipo: 'contrato',
        referencia_id:   contratoId,
        nome_arquivo:    file.name,
        url_storage:     path,
        tamanho_bytes:   file.size,
        mime_type:       file.type,
      })
      if (dbErr) throw dbErr
      void urlData
      void ext
      await carregarAnexos(contratoId)
    } catch (e) {
      setErroAnexo(e instanceof Error ? e.message : 'Erro no upload.')
    } finally {
      setUploadingId(null)
    }
  }

  async function getSignedUrl(urlStorage: string): Promise<string> {
    const { data } = await supabase.storage
      .from('documentos-empresa')
      .createSignedUrl(urlStorage, 300)
    return data?.signedUrl ?? '#'
  }

  async function excluirAnexo(contratoId: string, anexoId: string, urlStorage: string) {
    if (!confirm('Excluir este anexo?')) return
    await supabase.storage.from('documentos-empresa').remove([urlStorage])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('anexos') as any).delete().eq('id', anexoId)
    await carregarAnexos(contratoId)
  }

  function gerarMinuta() {
    const clienteNome = clientes.find(c => c.id === form.cliente_id)?.nome ?? 'Cliente'
    const html = gerarMinutaHtml(
      {
        modalidade:         form.modalidade ?? 'Prestação de Serviços Contábeis',
        dataAssinatura:     new Date().toISOString().slice(0, 10),
        vigenciaInicio:     form.inicio,
        vigenciaFim:        form.termino ?? '',
        valorMensal:        form.valor_mensal ?? 0,
        diaVencimento:      form.dia_vencimento ?? 10,
        indiceReajuste:     form.indice_reajuste ?? 'IPCA',
        percentualFixo:     form.percentual_fixo ?? undefined,
        limiteNotasMensais: form.limite_notas_mensais ?? 50,
        multaAtraso:        form.multa_atraso ?? 2,
        foroComarca:        form.foro_comarca ?? 'Jacarezinho/PR',
        clausulas:          form.clausulas ?? CLAUSULAS_PADRAO,
        scp:                form.scp_dados ?? undefined,
      },
      { nome: clienteNome },
    )
    imprimirMinuta(html)
  }

  // ─── Acesso Restrito ──────────────────────────────────────────

  if (autorizado === null) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={28} className="animate-spin text-brand-300" />
        </div>
      </Shell>
    )
  }

  if (autorizado === false) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <Shield size={40} className="text-danger-400" />
          <h2 className="text-lg font-bold text-brand-800">Acesso Restrito</h2>
          <p className="text-sm text-brand-500 max-w-xs">
            Você não tem permissão para acessar a Gestão Contratual. Solicite acesso ao administrador.
          </p>
        </div>
      </Shell>
    )
  }

  // ─── UI Principal ─────────────────────────────────────────────

  const isSCP = form.modalidade === 'Sociedade em Conta de Participação (SCP)'

  return (
    <Shell>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSignature size={22} className="text-brand-700" />
            <div>
              <h1 className="text-xl font-bold text-brand-900">Gestão Contratual</h1>
              <p className="text-xs text-brand-400">Área administrativa — contratos, SCP e minutas</p>
            </div>
          </div>
          <button onClick={abrirNovo} className="btn-primary self-start sm:self-auto">
            <Plus size={14} /> Novo Contrato
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="card border-2 border-brand-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-brand-800">{editando ? 'Editar Contrato' : 'Novo Contrato'}</h2>
              <button onClick={() => setShowForm(false)} className="text-brand-400 hover:text-brand-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Empresa */}
              <div className="sm:col-span-2">
                <label className="input-label">Empresa *</label>
                <select className="input" value={form.cliente_id} onChange={e => setF('cliente_id', e.target.value)}>
                  <option value="">Selecione...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {/* Modalidade */}
              <div className="sm:col-span-2">
                <label className="input-label">Modalidade Contratual</label>
                <select className="input" value={form.modalidade ?? ''} onChange={e => {
                  const m = e.target.value as ModalidadeContrato
                  setF('modalidade', m)
                  if (m === 'Sociedade em Conta de Participação (SCP)' && !form.scp_dados) {
                    setF('scp_dados', {
                      socioOstensivo: 'Nascente Contábil Ltda',
                      socioParticipante: '',
                      percentualResultados: 50,
                      capitalizacaoOstensivo: 0,
                      capitalizacaoParticipante: 0,
                    })
                  }
                }}>
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Título */}
              <div className="sm:col-span-2">
                <label className="input-label">Título do Contrato</label>
                <input className="input" value={form.titulo} onChange={e => setF('titulo', e.target.value)} />
              </div>

              {/* Valor + Vencimento */}
              <div>
                <label className="input-label">Honorários Mensais (R$)</label>
                <input type="number" min={0} step={0.01} className="input"
                  value={form.valor_mensal ?? ''}
                  onChange={e => setF('valor_mensal', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label className="input-label">Dia de Vencimento</label>
                <input type="number" min={1} max={28} className="input"
                  value={form.dia_vencimento ?? 10}
                  onChange={e => setF('dia_vencimento', Number(e.target.value))} />
              </div>

              {/* Datas */}
              <div>
                <label className="input-label">Início</label>
                <input type="date" className="input" value={form.inicio} onChange={e => setF('inicio', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Término (em branco = indeterminado)</label>
                <input type="date" className="input" value={form.termino ?? ''} onChange={e => setF('termino', e.target.value || null)} />
              </div>

              {/* Status + Renovação */}
              <div>
                <label className="input-label">Status</label>
                <select className="input" value={form.status} onChange={e => setF('status', e.target.value)}>
                  {['ativo', 'suspenso', 'encerrado'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="renov" checked={form.renovacao_auto}
                  onChange={e => setF('renovacao_auto', e.target.checked)}
                  className="w-4 h-4 accent-accent-500" />
                <label htmlFor="renov" className="text-sm text-brand-700">Renovação automática</label>
              </div>

              {/* Limites */}
              <div>
                <label className="input-label">Limite de NF-e / mês</label>
                <input type="number" min={0} className="input"
                  value={form.limite_notas_mensais ?? 50}
                  onChange={e => setF('limite_notas_mensais', Number(e.target.value))} />
              </div>
              <div>
                <label className="input-label">Multa por Atraso do Cliente (%)</label>
                <input type="number" min={0} step={0.1} className="input"
                  value={form.multa_atraso ?? 2}
                  onChange={e => setF('multa_atraso', Number(e.target.value))} />
              </div>

              {/* Reajuste */}
              <div>
                <label className="input-label">Índice de Reajuste Anual</label>
                <select className="input" value={form.indice_reajuste ?? 'IPCA'}
                  onChange={e => setF('indice_reajuste', e.target.value as IndiceReajuste)}>
                  {INDICES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              {form.indice_reajuste === 'Fixo' && (
                <div>
                  <label className="input-label">Percentual Fixo (%)</label>
                  <input type="number" min={0} step={0.1} className="input"
                    value={form.percentual_fixo ?? ''}
                    onChange={e => setF('percentual_fixo', e.target.value ? Number(e.target.value) : null)} />
                </div>
              )}

              {/* Foro */}
              <div>
                <label className="input-label">Foro da Comarca</label>
                <input className="input" value={form.foro_comarca ?? ''} onChange={e => setF('foro_comarca', e.target.value)} />
              </div>
            </div>

            {/* Serviços inclusos */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-2">Serviços Inclusos</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {SERVICOS_PADRAO.filter(s => !form.servicos_inclusos.includes(s)).map(s => (
                  <button key={s} onClick={() => setF('servicos_inclusos', [...form.servicos_inclusos, s])}
                    className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-600 hover:bg-brand-200">
                    + {s}
                  </button>
                ))}
              </div>
              <ul className="space-y-1 mb-2">
                {form.servicos_inclusos.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-brand-800 bg-accent-50 px-3 py-1 rounded-lg">
                    <span className="flex-1">{s}</span>
                    <button onClick={() => removeServico('servicos_inclusos', i)}><Trash2 size={13} className="text-brand-400 hover:text-danger-500" /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" placeholder="Adicionar serviço..."
                  value={novoServico} onChange={e => setNovoServico(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addServico('servicos_inclusos', novoServico) }} />
                <button onClick={() => addServico('servicos_inclusos', novoServico)} className="btn-secondary px-3"><Plus size={14} /></button>
              </div>
            </div>

            {/* Serviços extras */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-2">Serviços Adicionais Cobráveis</p>
              <ul className="space-y-1 mb-2">
                {form.servicos_extras.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-brand-800 bg-warning-100 px-3 py-1 rounded-lg">
                    <span className="flex-1">{s}</span>
                    <button onClick={() => removeServico('servicos_extras', i)}><Trash2 size={13} className="text-brand-400 hover:text-danger-500" /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" placeholder="Ex: Recálculo de guia em atraso (R$150)"
                  value={novoExtra} onChange={e => setNovoExtra(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addServico('servicos_extras', novoExtra) }} />
                <button onClick={() => addServico('servicos_extras', novoExtra)} className="btn-secondary px-3"><Plus size={14} /></button>
              </div>
            </div>

            {/* Cláusulas */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-2">Cláusulas Parametrizáveis</p>
              <div className="space-y-1.5">
                {(Object.keys(CLAUSULA_LABELS) as (keyof ClausulaContrato)[]).map(k => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.clausulas?.[k] ?? false}
                      onChange={() => toggleClausula(k)}
                      className="w-4 h-4 accent-accent-500" />
                    <span className="text-sm text-brand-700">{CLAUSULA_LABELS[k]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* SCP Condicional */}
            {isSCP && form.scp_dados && (
              <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-3">
                  Sociedade em Conta de Participação (SCP)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Sócio Ostensivo</label>
                    <input className="input" value={form.scp_dados.socioOstensivo}
                      onChange={e => setF('scp_dados', { ...form.scp_dados!, socioOstensivo: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Sócio Participante</label>
                    <input className="input" placeholder="Nome do empresário/cliente"
                      value={form.scp_dados.socioParticipante}
                      onChange={e => setF('scp_dados', { ...form.scp_dados!, socioParticipante: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">% Participação nos Resultados</label>
                    <input type="number" min={0} max={100} step={0.01} className="input"
                      value={form.scp_dados.percentualResultados}
                      onChange={e => setF('scp_dados', { ...form.scp_dados!, percentualResultados: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="input-label">Capitalização Sócio Ostensivo (R$)</label>
                    <input type="number" min={0} step={0.01} className="input"
                      value={form.scp_dados.capitalizacaoOstensivo}
                      onChange={e => setF('scp_dados', { ...form.scp_dados!, capitalizacaoOstensivo: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="input-label">Capitalização Sócio Participante (R$)</label>
                    <input type="number" min={0} step={0.01} className="input"
                      value={form.scp_dados.capitalizacaoParticipante}
                      onChange={e => setF('scp_dados', { ...form.scp_dados!, capitalizacaoParticipante: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            )}

            {erro && <p className="text-sm text-danger-600 mt-3">{erro}</p>}

            <div className="flex flex-wrap gap-2 pt-4">
              <button onClick={salvar} disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editando ? 'Salvar Alterações' : 'Criar Contrato'}
              </button>
              <button onClick={gerarMinuta} className="btn-secondary">
                <Printer size={14} /> Gerar Minuta Timbrada
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de Contratos */}
        <div className="card">
          <h2 className="text-sm font-semibold text-brand-700 mb-4">
            Contratos Cadastrados ({contratos.length})
          </h2>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-brand-300" /></div>
          ) : contratos.length === 0 ? (
            <p className="text-center py-10 text-sm text-brand-300">Nenhum contrato cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {contratos.map(c => {
                const isOpen = expandido === c.id
                return (
                  <div key={c.id} className="border border-brand-100 rounded-xl overflow-hidden">
                    <button
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-brand-50/40 transition"
                      onClick={() => {
                        const next = isOpen ? null : c.id
                        setExpandido(next)
                        if (next && !anexos[next]) carregarAnexos(next)
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-brand-800 text-sm">{c.clientes?.nome ?? '—'}</span>
                          {c.modalidade && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              c.modalidade.includes('SCP') ? 'bg-purple-100 text-purple-700'
                                : c.modalidade.includes('Assessoria') ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>{c.modalidade}</span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            c.status === 'ativo' ? 'bg-accent-100 text-accent-700'
                              : c.status === 'suspenso' ? 'bg-warning-100 text-warning-700'
                              : 'bg-danger-100 text-danger-700'
                          }`}>{c.status}</span>
                        </div>
                        <p className="text-xs text-brand-500 mt-0.5">{c.titulo}</p>
                      </div>
                      <span className="text-sm font-semibold text-brand-700 whitespace-nowrap">
                        {c.valor_mensal != null
                          ? c.valor_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : '—'}
                      </span>
                      {isOpen ? <ChevronUp size={15} className="text-brand-400" /> : <ChevronDown size={15} className="text-brand-400" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-brand-50 pt-3 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-brand-600">
                          <div><span className="text-brand-400">Início:</span> {c.inicio}</div>
                          <div><span className="text-brand-400">Término:</span> {c.termino ?? 'Indeterminado'}</div>
                          <div><span className="text-brand-400">Vencimento:</span> Dia {c.dia_vencimento}</div>
                          <div><span className="text-brand-400">Reajuste:</span> {c.indice_reajuste ?? '—'}</div>
                        </div>
                        {c.scp_dados && (
                          <div className="text-xs text-purple-700 bg-purple-50 rounded-lg p-2">
                            <strong>SCP:</strong> Ostensivo {c.scp_dados.socioOstensivo} / Participante {c.scp_dados.socioParticipante} — {c.scp_dados.percentualResultados}% resultados
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => abrirEditar(c)} className="btn-secondary text-xs">Editar</button>
                        </div>

                        {/* Anexos PDF do Contrato */}
                        <div className="mt-3 pt-3 border-t border-brand-100">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-brand-600 flex items-center gap-1.5">
                              <Paperclip size={13} /> Documentos Anexados
                            </p>
                            <label className={`btn-secondary text-xs cursor-pointer ${uploadingId === c.id ? 'opacity-50 pointer-events-none' : ''}`}>
                              {uploadingId === c.id
                                ? <><Loader2 size={12} className="animate-spin" /> Enviando...</>
                                : <><Upload size={12} /> Anexar PDF</>}
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.png,.jpg"
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0]
                                  if (f) uploadAnexo(c.id, f)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                          </div>
                          {erroAnexo && <p className="text-xs text-danger-600 mb-2">{erroAnexo}</p>}
                          {(anexos[c.id] ?? []).length === 0 ? (
                            <p className="text-xs text-brand-400 italic">Nenhum documento anexado.</p>
                          ) : (
                            <ul className="space-y-1">
                              {(anexos[c.id] ?? []).map(a => (
                                <li key={a.id} className="flex items-center gap-2 text-xs bg-brand-50 px-3 py-1.5 rounded-lg">
                                  <Paperclip size={11} className="text-brand-400 flex-shrink-0" />
                                  <span className="flex-1 truncate text-brand-700">{a.nome_arquivo}</span>
                                  <span className="text-brand-400 text-[10px] whitespace-nowrap">
                                    {new Date(a.created_at).toLocaleDateString('pt-BR')}
                                  </span>
                                  <button
                                    onClick={async () => {
                                      const url = await getSignedUrl(a.url_storage)
                                      window.open(url, '_blank')
                                    }}
                                    className="text-brand-400 hover:text-brand-700"
                                    title="Abrir"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                  <button
                                    onClick={() => excluirAnexo(c.id, a.id, a.url_storage)}
                                    className="text-brand-300 hover:text-danger-500"
                                    title="Excluir"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
