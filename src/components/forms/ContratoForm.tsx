'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, X, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ContratoPayload {
  cliente_id: string
  titulo: string
  descricao: string | null
  valor_mensal: number | null
  dia_vencimento: number | null
  inicio: string
  termino: string | null
  renovacao_auto: boolean
  status: string
  servicos_inclusos: string[]
  servicos_extras: string[]
}

interface Props {
  inicial?: Partial<ContratoPayload & { id: string }>
  onSalvo: (id: string) => void
  onCancelar: () => void
}

const SERVICOS_PADRAO = [
  'Escrituração Fiscal', 'Folha de Pagamento', 'Contabilidade',
  'FGTS/GPS', 'DCTF/SPED', 'Declaração IR PF', 'Legalização',
]

export default function ContratoForm({ inicial, onSalvo, onCancelar }: Props) {
  const [clientes, setClientes] = useState<Array<{ id: string; nome: string }>>([])
  const [form, setForm] = useState<ContratoPayload>({
    cliente_id: '', titulo: 'Contrato de Prestação de Serviços Contábeis',
    descricao: null, valor_mensal: null, dia_vencimento: 10,
    inicio: new Date().toISOString().slice(0, 10), termino: null,
    renovacao_auto: true, status: 'ativo',
    servicos_inclusos: [], servicos_extras: [],
    ...inicial,
  })
  const [novoServico, setNovoServico] = useState('')
  const [novoExtra, setNovoExtra]     = useState('')
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from('clientes') as any).select('id, nome').order('nome').then(({ data }: { data: Array<{ id: string; nome: string }> | null }) => {
      setClientes(data ?? [])
    })
  }, [])

  const set = (k: keyof ContratoPayload, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  function addServico(lista: 'servicos_inclusos' | 'servicos_extras', val: string) {
    if (!val.trim()) return
    set(lista, [...form[lista], val.trim()])
    lista === 'servicos_inclusos' ? setNovoServico('') : setNovoExtra('')
  }
  function removeServico(lista: 'servicos_inclusos' | 'servicos_extras', idx: number) {
    set(lista, form[lista].filter((_, i) => i !== idx))
  }

  async function salvar() {
    if (!form.cliente_id) { setErro('Selecione a empresa.'); return }
    if (!form.titulo.trim()) { setErro('Título obrigatório.'); return }
    setSaving(true); setErro(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        cliente_id:    form.cliente_id,
        titulo:        form.titulo.trim(),
        descricao:     JSON.stringify({
          dia_vencimento: form.dia_vencimento,
          servicos_inclusos: form.servicos_inclusos,
          extras: form.servicos_extras,
        }),
        valor_mensal:  form.valor_mensal,
        inicio:        form.inicio,
        termino:       form.termino || null,
        renovacao_auto: form.renovacao_auto,
        status:        form.status,
        criado_por:    user?.id ?? null,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = inicial?.id
        ? (supabase.from('contratos') as any).update(payload).eq('id', inicial.id).select('id').single()
        : (supabase.from('contratos') as any).insert(payload).select('id').single()
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
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="input-label">Empresa *</label>
          <select className="input" value={form.cliente_id} onChange={(e) => set('cliente_id', e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="input-label">Título do Contrato</label>
          <input className="input" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Honorários Mensais (R$)</label>
          <input type="number" min={0} step={0.01} className="input" value={form.valor_mensal ?? ''} onChange={(e) => set('valor_mensal', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="input-label">Dia de Vencimento</label>
          <input type="number" min={1} max={28} className="input" value={form.dia_vencimento ?? 10} onChange={(e) => set('dia_vencimento', Number(e.target.value))} />
        </div>
        <div>
          <label className="input-label">Início</label>
          <input type="date" className="input" value={form.inicio} onChange={(e) => set('inicio', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Término (deixe em branco se indeterminado)</label>
          <input type="date" className="input" value={form.termino ?? ''} onChange={(e) => set('termino', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Status</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {['ativo', 'suspenso', 'encerrado'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="renov" checked={form.renovacao_auto} onChange={(e) => set('renovacao_auto', e.target.checked)} className="w-4 h-4 accent-accent-500" />
          <label htmlFor="renov" className="text-sm text-brand-700">Renovação automática</label>
        </div>
      </div>

      {/* Serviços inclusos */}
      <div>
        <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-2">Serviços Inclusos no Pacote</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {SERVICOS_PADRAO.filter((s) => !form.servicos_inclusos.includes(s)).map((s) => (
            <button key={s} onClick={() => set('servicos_inclusos', [...form.servicos_inclusos, s])}
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
          <input className="input flex-1 text-sm" placeholder="Adicionar serviço..." value={novoServico} onChange={(e) => setNovoServico(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addServico('servicos_inclusos', novoServico) }} />
          <button onClick={() => addServico('servicos_inclusos', novoServico)} className="btn-secondary px-3"><Plus size={14} /></button>
        </div>
      </div>

      {/* Serviços extracontratuais */}
      <div>
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
          <input className="input flex-1 text-sm" placeholder="Ex: Recálculo de guia em atraso (R$150)" value={novoExtra} onChange={(e) => setNovoExtra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addServico('servicos_extras', novoExtra) }} />
          <button onClick={() => addServico('servicos_extras', novoExtra)} className="btn-secondary px-3"><Plus size={14} /></button>
        </div>
      </div>

      {erro && <p className="text-sm text-danger-600">{erro}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={salvar} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {inicial?.id ? 'Salvar Alterações' : 'Criar Contrato'}
        </button>
        <button onClick={onCancelar} className="btn-secondary"><X size={14} /> Cancelar</button>
      </div>
    </div>
  )
}
