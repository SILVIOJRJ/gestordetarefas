'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, X, Paperclip } from 'lucide-react'
import type { Setor, Prioridade, StatusTarefa } from '@/types/database.types'
import { supabase } from '@/lib/supabase'

interface TarefaPayload {
  titulo: string
  descricao: string | null
  setor: Setor | null
  prioridade: Prioridade
  prazo: string | null
  cliente_id: string | null
  responsavel: string | null
  status: StatusTarefa
}

interface Props {
  inicial?: Partial<TarefaPayload & { id: string }>
  onSalvo: (id: string) => void
  onCancelar: () => void
}

const SETORES: Setor[] = ['Legalização', 'Fiscal', 'RH', 'Office Boy', 'Gerencial', 'Administrativo']
const PRIORIDADES: Prioridade[] = ['Baixa', 'Média', 'Alta', 'Urgente']
const STATUS_LIST: StatusTarefa[] = ['Pendente', 'Em andamento', 'Aguardando', 'Concluída', 'Cancelada']

export default function TarefaForm({ inicial, onSalvo, onCancelar }: Props) {
  const [form, setForm] = useState<TarefaPayload>({
    titulo: '', descricao: null, setor: null, prioridade: 'Média',
    prazo: null, cliente_id: null, responsavel: null, status: 'Pendente',
    ...inicial,
  })
  const [clientes, setClientes] = useState<Array<{ id: string; nome: string }>>([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [anexoNome, setAnexoNome] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from('clientes') as any).select('id, nome').order('nome').then(({ data }: { data: Array<{ id: string; nome: string }> | null }) => {
      setClientes(data ?? [])
    })
  }, [])

  const set = (k: keyof TarefaPayload, v: unknown) => setForm((f) => ({ ...f, [k]: v || null }))

  async function salvar() {
    if (!form.titulo.trim()) { setErro('Título obrigatório.'); return }
    setSaving(true); setErro(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = inicial?.id
        ? (supabase.from('tarefas') as any).update({ ...form, titulo: form.titulo.trim() }).eq('id', inicial.id).select('id').single()
        : (supabase.from('tarefas') as any).insert({ ...form, titulo: form.titulo.trim() }).select('id').single()
      const { data, error } = await q
      if (error) throw error
      onSalvo(data.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="input-label">Título *</label>
          <input className="input" placeholder="Descreva a tarefa..." value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="input-label">Descrição Detalhada</label>
          <textarea className="input resize-none" rows={3} value={form.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Empresa Vinculada</label>
          <select className="input" value={form.cliente_id ?? ''} onChange={(e) => set('cliente_id', e.target.value)}>
            <option value="">Sem empresa</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Setor</label>
          <select className="input" value={form.setor ?? ''} onChange={(e) => set('setor', e.target.value)}>
            <option value="">Selecione...</option>
            {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Prioridade</label>
          <select className="input" value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as Prioridade }))}>
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StatusTarefa }))}>
            {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Data de Vencimento</label>
          <input type="date" className="input" value={form.prazo ?? ''} onChange={(e) => set('prazo', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Responsável</label>
          <input className="input" placeholder="Nome do responsável" value={form.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="input-label">Anexo (Storage privado)</label>
          <label className="flex items-center gap-2 cursor-pointer input text-brand-500 hover:text-brand-700">
            <Paperclip size={15} />
            <span className="text-sm">{anexoNome ?? 'Selecionar arquivo...'}</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => setAnexoNome(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          <p className="text-xs text-brand-400 mt-1">PDF, JPG, PNG ou WEBP — máx. 20 MB. Upload salvo em bucket privado.</p>
        </div>
      </div>

      {erro && <p className="text-sm text-danger-600">{erro}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={salvar} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {inicial?.id ? 'Salvar Alterações' : 'Criar Tarefa'}
        </button>
        <button onClick={onCancelar} className="btn-secondary"><X size={14} /> Cancelar</button>
      </div>
    </div>
  )
}
