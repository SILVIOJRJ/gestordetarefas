'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  Plus, Search, Paperclip, Pencil, Trash2, Loader2,
  X, Save, CheckSquare, Square, ChevronDown,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

type TipoProcesso =
  | 'Abertura de Empresa'
  | 'Alteração'
  | 'Encerramento'
  | 'Alvará'
  | 'Licença'
  | 'Certificado Digital'
  | 'Regularização'
  | 'Outro'

type StatusProcesso =
  | 'Em andamento'
  | 'Concluído'
  | 'Pendente'
  | 'Aguardando documentos'
  | 'Cancelado'

interface Processo {
  id: string
  cliente_id: string | null
  cliente_nome?: string | null
  tipo: TipoProcesso
  descricao: string | null
  status: StatusProcesso
  data_abertura: string | null
  data_previsao: string | null
  data_renovacao: string | null
  responsavel: string | null
  lembrar_antes_dias: number | null
  retorno_confirmado: boolean
  observacao: string | null
}

interface TarefaSetor {
  id: string
  titulo: string
  status: string
  prazo: string | null
  responsavel: string | null
  cliente_id: string | null
  cliente_nome?: string | null
}

interface ClienteOpt {
  id: string
  nome: string
}

// ─── Constantes ───────────────────────────────────────────────

const TIPOS: TipoProcesso[] = [
  'Abertura de Empresa', 'Alteração', 'Encerramento', 'Alvará',
  'Licença', 'Certificado Digital', 'Regularização', 'Outro',
]

const STATUS_LIST: StatusProcesso[] = [
  'Em andamento', 'Concluído', 'Pendente', 'Aguardando documentos', 'Cancelado',
]

const STATUS_BADGE: Record<StatusProcesso, string> = {
  'Em andamento':         'bg-blue-100 text-blue-700 border-blue-200',
  'Concluído':            'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Pendente':             'bg-amber-100 text-amber-700 border-amber-200',
  'Aguardando documentos':'bg-purple-100 text-purple-700 border-purple-200',
  'Cancelado':            'bg-red-100 text-red-700 border-red-200',
}

const TAREFA_STATUS_BADGE: Record<string, string> = {
  'Pendente':     'bg-amber-100 text-amber-700',
  'Em andamento': 'bg-blue-100 text-blue-700',
  'Concluída':    'bg-emerald-100 text-emerald-700',
  'Cancelada':    'bg-red-100 text-red-700',
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

const VAZIO_PROCESSO = (): Omit<Processo, 'id'> => ({
  cliente_id: null,
  tipo: 'Abertura de Empresa',
  descricao: null,
  status: 'Em andamento',
  data_abertura: new Date().toISOString().slice(0, 10),
  data_previsao: null,
  data_renovacao: null,
  responsavel: null,
  lembrar_antes_dias: 30,
  retorno_confirmado: false,
  observacao: null,
})

// ─── Componente principal ─────────────────────────────────────

export default function LegalizacaoPage() {
  const [processos, setProcessos]     = useState<Processo[]>([])
  const [tarefas, setTarefas]         = useState<TarefaSetor[]>([])
  const [clientes, setClientes]       = useState<ClienteOpt[]>([])
  const [loading, setLoading]         = useState(true)

  const [busca, setBusca]             = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroTipo, setFiltroTipo]   = useState('')

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]       = useState<Processo | null>(null)
  const [form, setForm]               = useState(VAZIO_PROCESSO())
  const [saving, setSaving]           = useState(false)
  const [erroSalvar, setErroSalvar]   = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)

    // Clientes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cData } = await (supabase.from('clientes') as any)
      .select('id, nome').order('nome')
    setClientes((cData ?? []) as ClienteOpt[])

    // Processos com join no nome do cliente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pData } = await (supabase.from('processos_legalizacao') as any)
      .select('id, cliente_id, tipo, descricao, status, data_abertura, data_previsao, data_renovacao, responsavel, lembrar_antes_dias, retorno_confirmado, observacao, clientes(nome)')
      .order('created_at', { ascending: false })

    const procs: Processo[] = ((pData ?? []) as Record<string, unknown>[]).map(p => ({
      id:                  p.id as string,
      cliente_id:          p.cliente_id as string | null,
      cliente_nome:        (p.clientes as { nome?: string } | null)?.nome ?? null,
      tipo:                (p.tipo as TipoProcesso) ?? 'Outro',
      descricao:           p.descricao as string | null,
      status:              (p.status as StatusProcesso) ?? 'Pendente',
      data_abertura:       p.data_abertura as string | null,
      data_previsao:       p.data_previsao as string | null,
      data_renovacao:      p.data_renovacao as string | null,
      responsavel:         p.responsavel as string | null,
      lembrar_antes_dias:  p.lembrar_antes_dias as number | null,
      retorno_confirmado:  Boolean(p.retorno_confirmado),
      observacao:          p.observacao as string | null,
    }))
    setProcessos(procs)

    // Tarefas do setor LEGALIZAÇÃO
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tData } = await (supabase.from('tarefas') as any)
      .select('id, titulo, status, prazo, responsavel, cliente_id, clientes(nome)')
      .eq('setor', 'LEGALIZAÇÃO')
      .order('prazo', { ascending: true, nullsFirst: false })
    const tfs: TarefaSetor[] = ((tData ?? []) as Record<string, unknown>[]).map(t => ({
      id:           t.id as string,
      titulo:       t.titulo as string,
      status:       t.status as string,
      prazo:        t.prazo as string | null,
      responsavel:  t.responsavel as string | null,
      cliente_id:   t.cliente_id as string | null,
      cliente_nome: (t.clientes as { nome?: string } | null)?.nome ?? null,
    }))
    setTarefas(tfs)

    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO_PROCESSO())
    setErroSalvar(null)
    setModalAberto(true)
  }

  function abrirEdicao(p: Processo) {
    setEditando(p)
    setForm({
      cliente_id:         p.cliente_id,
      tipo:               p.tipo,
      descricao:          p.descricao,
      status:             p.status,
      data_abertura:      p.data_abertura,
      data_previsao:      p.data_previsao,
      data_renovacao:     p.data_renovacao,
      responsavel:        p.responsavel,
      lembrar_antes_dias: p.lembrar_antes_dias,
      retorno_confirmado: p.retorno_confirmado,
      observacao:         p.observacao,
    })
    setErroSalvar(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
  }

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function salvar() {
    setSaving(true)
    setErroSalvar(null)
    try {
      const payload = {
        cliente_id:         form.cliente_id || null,
        tipo:               form.tipo,
        descricao:          form.descricao || null,
        status:             form.status,
        data_abertura:      form.data_abertura || null,
        data_previsao:      form.data_previsao || null,
        data_renovacao:     form.data_renovacao || null,
        responsavel:        form.responsavel || null,
        lembrar_antes_dias: form.lembrar_antes_dias ?? 30,
        retorno_confirmado: form.retorno_confirmado,
        observacao:         form.observacao || null,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = editando
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (supabase.from('processos_legalizacao') as any).update(payload).eq('id', editando.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (supabase.from('processos_legalizacao') as any).insert(payload)
      const { error } = await q
      if (error) throw error
      await carregar()
      fecharModal()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e)
      setErroSalvar(`Erro: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este processo?')) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('processos_legalizacao') as any).delete().eq('id', id)
    if (error) { setErroSalvar('Erro ao excluir: ' + error.message); return }
    await carregar()
  }

  const processosFiltrados = processos.filter(p => {
    if (busca && !p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) &&
        !p.descricao?.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroStatus && p.status !== filtroStatus) return false
    if (filtroTipo && p.tipo !== filtroTipo) return false
    return true
  })

  return (
    <Shell>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-900">Legalização</h1>
            <p className="text-sm text-brand-500">Processos de legalização e tarefas do setor</p>
          </div>
          <button onClick={abrirNovo} className="btn-primary">
            <Plus size={15} /> Novo Processo
          </button>
        </div>

        {/* ══ BLOCO SUPERIOR: Tarefas do Setor ════════════════════ */}
        <section className="bg-white rounded-xl border border-brand-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-800">Tarefas do Setor</h2>
            <span className="text-xs text-brand-400">{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 size={22} className="animate-spin text-brand-300" />
            </div>
          ) : tarefas.length === 0 ? (
            <p className="py-8 text-center text-sm text-brand-300">Nenhuma tarefa no setor de Legalização.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] text-brand-400 bg-brand-50 border-b border-brand-100">
                    {['TÍTULO','CLIENTE','PRAZO','RESPONSÁVEL','STATUS'].map((h, i) => (
                      <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tarefas.map(t => (
                    <tr key={t.id} className="border-b border-brand-50 hover:bg-brand-50/60">
                      <td className="px-3 py-2 font-medium text-brand-800 max-w-[220px] truncate">{t.titulo}</td>
                      <td className="px-3 py-2 text-brand-500">{t.cliente_nome ?? '—'}</td>
                      <td className="px-3 py-2 text-brand-500 whitespace-nowrap">{fmtData(t.prazo)}</td>
                      <td className="px-3 py-2 text-brand-500">{t.responsavel ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TAREFA_STATUS_BADGE[t.status] ?? 'bg-brand-100 text-brand-500'}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ══ BLOCO INFERIOR: Processos de Legalização ════════════ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-800">Processos de Legalização</h2>
            <span className="text-xs text-brand-400">{processosFiltrados.length} processo{processosFiltrados.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                className="input pl-8 text-sm w-full"
                placeholder="Buscar cliente ou descrição..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <div className="relative">
              <select
                className="input text-sm pr-7 appearance-none cursor-pointer"
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos os Status</option>
                {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                className="input text-sm pr-7 appearance-none cursor-pointer"
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
              >
                <option value="">Todos os Tipos</option>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl border border-brand-100 overflow-x-auto">
            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 size={26} className="animate-spin text-brand-300" />
              </div>
            ) : (
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="text-left text-[11px] text-brand-400 bg-brand-50 border-b border-brand-100">
                    {['CLIENTE','TIPO','DESCRIÇÃO','STATUS','ABERTURA','PREVISÃO','RENOVAÇÃO','RESPONSÁVEL',''].map((h, i) => (
                      <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processosFiltrados.map(p => (
                    <tr key={p.id} className="border-b border-brand-50 hover:bg-brand-50/60 transition-colors">
                      <td className="px-3 py-2 font-semibold text-brand-800 whitespace-nowrap max-w-[150px] truncate">
                        {p.cliente_nome ?? '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-100 text-brand-600 border border-brand-200">
                          {p.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-brand-600 max-w-[200px] truncate">{p.descricao ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[p.status] ?? 'bg-brand-100 text-brand-500 border-brand-200'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-brand-500 whitespace-nowrap">{fmtData(p.data_abertura)}</td>
                      <td className="px-3 py-2 text-brand-500 whitespace-nowrap">{fmtData(p.data_previsao)}</td>
                      <td className="px-3 py-2 text-brand-500 whitespace-nowrap">{fmtData(p.data_renovacao)}</td>
                      <td className="px-3 py-2 text-brand-500 max-w-[100px] truncate">{p.responsavel ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button title="Anexos" className="p-1 rounded hover:bg-brand-100 text-brand-400 hover:text-brand-700">
                            <Paperclip size={13} />
                          </button>
                          <button onClick={() => abrirEdicao(p)} title="Editar" className="p-1 rounded hover:bg-brand-100 text-brand-400 hover:text-brand-700">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => excluir(p.id)} title="Excluir" className="p-1 rounded hover:bg-red-100 text-brand-400 hover:text-red-600">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {processosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-brand-300 text-sm">
                        Nenhum processo encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* ── Modal Novo / Editar Processo ────────────────────────── */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100">
              <h2 className="text-base font-bold text-brand-900">
                {editando ? 'Editar Processo' : 'Novo Processo'}
              </h2>
              <button onClick={fecharModal} className="text-brand-400 hover:text-brand-700">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">

              {/* CLIENTE */}
              <div>
                <label className="input-label">CLIENTE</label>
                <div className="relative">
                  <select
                    className="input text-sm w-full pr-7 appearance-none cursor-pointer"
                    value={form.cliente_id ?? ''}
                    onChange={e => setF('cliente_id', e.target.value || null)}
                  >
                    <option value="">Selecione o cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
                </div>
              </div>

              {/* TIPO + STATUS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">TIPO *</label>
                  <div className="relative">
                    <select
                      className="input text-sm w-full pr-7 appearance-none cursor-pointer"
                      value={form.tipo}
                      onChange={e => setF('tipo', e.target.value as TipoProcesso)}
                    >
                      {TIPOS.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="input-label">STATUS</label>
                  <div className="relative">
                    <select
                      className="input text-sm w-full pr-7 appearance-none cursor-pointer"
                      value={form.status}
                      onChange={e => setF('status', e.target.value as StatusProcesso)}
                    >
                      {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* RESPONSÁVEL */}
              <div>
                <label className="input-label">RESPONSÁVEL</label>
                <input
                  className="input text-sm w-full"
                  placeholder="Nome do responsável..."
                  value={form.responsavel ?? ''}
                  onChange={e => setF('responsavel', e.target.value || null)}
                />
              </div>

              {/* DATAS */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="input-label">ABERTURA</label>
                  <input
                    type="date"
                    className="input text-sm w-full"
                    value={form.data_abertura ?? ''}
                    onChange={e => setF('data_abertura', e.target.value || null)}
                  />
                </div>
                <div>
                  <label className="input-label">PREVISÃO</label>
                  <input
                    type="date"
                    className="input text-sm w-full"
                    value={form.data_previsao ?? ''}
                    onChange={e => setF('data_previsao', e.target.value || null)}
                  />
                </div>
                <div>
                  <label className="input-label">RENOVAÇÃO</label>
                  <input
                    type="date"
                    className="input text-sm w-full"
                    value={form.data_renovacao ?? ''}
                    onChange={e => setF('data_renovacao', e.target.value || null)}
                  />
                </div>
              </div>

              {/* LEMBRAR ANTES (DIAS) */}
              <div>
                <label className="input-label">LEMBRAR ANTES (DIAS)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="input text-sm w-full"
                  placeholder="30"
                  value={form.lembrar_antes_dias ?? ''}
                  onChange={e => setF('lembrar_antes_dias', e.target.value ? Number(e.target.value) : null)}
                />
              </div>

              {/* RETORNO CONFIRMADO */}
              <button
                type="button"
                onClick={() => setF('retorno_confirmado', !form.retorno_confirmado)}
                className="flex items-center gap-2 text-sm text-brand-700 hover:text-brand-900 transition-colors"
              >
                {form.retorno_confirmado
                  ? <CheckSquare size={16} className="text-accent-600" />
                  : <Square size={16} className="text-brand-400" />}
                RETORNO CONFIRMADO
              </button>

              {/* DESCRIÇÃO */}
              <div>
                <label className="input-label">DESCRIÇÃO</label>
                <input
                  className="input text-sm w-full"
                  placeholder="Descrição resumida do processo..."
                  value={form.descricao ?? ''}
                  onChange={e => setF('descricao', e.target.value || null)}
                />
              </div>

              {/* OBSERVAÇÃO */}
              <div>
                <label className="input-label">OBSERVAÇÃO</label>
                <textarea
                  rows={3}
                  className="input text-sm resize-none w-full"
                  placeholder="Detalhes, pendências, notas..."
                  value={form.observacao ?? ''}
                  onChange={e => setF('observacao', e.target.value || null)}
                />
              </div>

              {erroSalvar && (
                <p className="text-sm text-red-600">{erroSalvar}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-brand-100">
              <button onClick={salvar} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editando ? 'Salvar Alterações' : 'Criar Processo'}
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
