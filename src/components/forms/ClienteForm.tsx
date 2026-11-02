'use client'

import { useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import type { Cliente, RegimeTributario, Setor } from '@/types/database.types'
import { supabase } from '@/lib/supabase'

type ClientePayload = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>

interface Props {
  inicial?: Partial<ClientePayload & { id: string }>
  onSalvo: (id: string) => void
  onCancelar: () => void
}

const REGIMES: RegimeTributario[] = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI']
const SETORES: Setor[] = ['Legalização', 'Fiscal', 'RH', 'Office Boy', 'Gerencial', 'Administrativo']

const VAZIO: ClientePayload = {
  nome: '', cnpj: '', regime: null, email: null, telefone: null,
  responsavel: null, responsavel_id: null, criado_por: null,
  ie: '', im: '', cnae: '', limite_nfe: 50, limite_faturamento: 100000, taxa_recalculo: 150,
  vinculo_atendimento: null, contatos_chave: null, manual_costumes: null,
}

export default function ClienteForm({ inicial, onSalvo, onCancelar }: Props) {
  const [form, setForm] = useState({ ...VAZIO, ...inicial })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome obrigatório.'); return }
    setSaving(true); setErro(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        nome:                form.nome.trim(),
        cnpj:                form.cnpj || null,
        regime:              form.regime,
        email:               form.email || null,
        telefone:            form.telefone || null,
        responsavel:         form.responsavel || null,
        responsavel_id:      form.responsavel_id || null,
        criado_por:          user?.id ?? null,
        ie:                  form.ie || null,
        im:                  form.im || null,
        cnae:                form.cnae || null,
        limite_nfe:          form.limite_nfe ?? 50,
        limite_faturamento:  form.limite_faturamento ?? 100000,
        taxa_recalculo:      form.taxa_recalculo ?? 150,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = inicial?.id
        ? (supabase.from('clientes') as any).update(payload).eq('id', inicial.id).select('id').single()
        : (supabase.from('clientes') as any).insert(payload).select('id').single()
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

        {/* Dados básicos */}
        <div className="sm:col-span-2">
          <label className="input-label">Razão Social / Nome *</label>
          <input className="input" value={form.nome} onChange={(e) => set('nome', e.target.value)} />
        </div>
        <div>
          <label className="input-label">CNPJ / CPF</label>
          <input className="input" placeholder="00.000.000/0000-00" value={form.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Regime Tributário</label>
          <select className="input" value={form.regime ?? ''} onChange={(e) => set('regime', e.target.value || null)}>
            <option value="">Selecione...</option>
            {REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Inscrição Estadual</label>
          <input className="input" placeholder="IE" value={form.ie ?? ''} onChange={(e) => set('ie', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Inscrição Municipal</label>
          <input className="input" placeholder="IM" value={form.im ?? ''} onChange={(e) => set('im', e.target.value)} />
        </div>
        <div>
          <label className="input-label">CNAE Principal</label>
          <input className="input" placeholder="0000-0/00" value={form.cnae ?? ''} onChange={(e) => set('cnae', e.target.value)} />
        </div>
        <div>
          <label className="input-label">E-mail</label>
          <input type="email" className="input" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Telefone / WhatsApp</label>
          <input className="input" placeholder="(00) 00000-0000" value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Responsável no Escritório</label>
          <input className="input" value={form.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Setor Responsável</label>
          <select className="input" value={''} onChange={() => {}}>
            <option value="">Selecione...</option>
            {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Limites contratuais */}
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-3 mt-1">Limites Contratuais</p>
        </div>
        <div>
          <label className="input-label">Limite NF-e / mês</label>
          <input type="number" min={0} className="input" value={form.limite_nfe ?? 50} onChange={(e) => set('limite_nfe', Number(e.target.value))} />
        </div>
        <div>
          <label className="input-label">Teto de Faturamento Mensal (R$)</label>
          <input type="number" min={0} className="input" value={form.limite_faturamento ?? 100000} onChange={(e) => set('limite_faturamento', Number(e.target.value))} />
        </div>
        <div>
          <label className="input-label">Taxa de Recálculo de Guia em Atraso (R$)</label>
          <input type="number" min={0} className="input" value={form.taxa_recalculo ?? 150} onChange={(e) => set('taxa_recalculo', Number(e.target.value))} />
        </div>
      </div>

      {erro && <p className="text-sm text-danger-600">{erro}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={salvar} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {inicial?.id ? 'Salvar Alterações' : 'Cadastrar Cliente'}
        </button>
        <button onClick={onCancelar} className="btn-secondary"><X size={14} /> Cancelar</button>
      </div>
    </div>
  )
}
