'use client'

import { useState } from 'react'
import { Loader2, Save, X, CheckSquare, Square, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Tipos locais ─────────────────────────────────────────────

type RegimeTributario = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI'

type SetorContratado =
  | 'ACOMPANHAMENTO'
  | 'CERTIFICADO DIGITAL'
  | 'CONTÁBIL'
  | 'DP'
  | 'FISCAL'
  | 'LEGALIZAÇÃO'
  | 'OFFICE BOY'

interface FormState {
  nome: string
  cnpj_cpf: string
  email: string
  telefone: string
  whatsapp: string
  regime: RegimeTributario | ''
  condicao: string
  responsavel: string
  observacoes: string
  setores: SetorContratado[]
  ativo: boolean
  // Onboarding
  empresa_nova: boolean
  onboarding_processo: string
  onboarding_responsavel_tecnico: string
  onboarding_inicio_atividades: string
  onboarding_regime: RegimeTributario | ''
}

interface Props {
  inicial?: { id?: string; nome?: string }
  onSalvo: (id: string) => void
  onCancelar: () => void
}

// ─── Constantes ───────────────────────────────────────────────

const REGIMES: RegimeTributario[] = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI']

const SETORES: SetorContratado[] = [
  'ACOMPANHAMENTO', 'CERTIFICADO DIGITAL', 'CONTÁBIL', 'DP', 'FISCAL', 'LEGALIZAÇÃO', 'OFFICE BOY',
]

const VAZIO: FormState = {
  nome: '', cnpj_cpf: '', email: '', telefone: '', whatsapp: '',
  regime: '', condicao: 'Normal', responsavel: '', observacoes: '',
  setores: [], ativo: true,
  empresa_nova: false,
  onboarding_processo: '', onboarding_responsavel_tecnico: '',
  onboarding_inicio_atividades: '', onboarding_regime: '',
}

// ─── Componente ───────────────────────────────────────────────

export default function ClienteForm({ inicial, onSalvo, onCancelar }: Props) {
  const [form, setForm] = useState<FormState>({ ...VAZIO, nome: inicial?.nome ?? '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleSetor(s: SetorContratado) {
    setForm(f => ({
      ...f,
      setores: f.setores.includes(s)
        ? f.setores.filter(x => x !== s)
        : [...f.setores, s],
    }))
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome / Razão Social é obrigatório.'); return }
    setSaving(true)
    setErro(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        nome:        form.nome.trim(),
        cnpj_cpf:    form.cnpj_cpf || null,
        email:       form.email || null,
        telefone:    form.telefone || null,
        whatsapp:    form.whatsapp || null,
        regime:      form.regime || null,
        condicao:    form.condicao || 'Normal',
        responsavel: form.responsavel || null,
        observacoes: form.observacoes || null,
        setores_contratados: form.setores,
        status:      form.ativo ? 'Ativo' : 'Inativo',
        criado_por:  user?.id ?? null,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = inicial?.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (supabase.from('clientes') as any).update(payload).eq('id', inicial.id).select('id').single()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (supabase.from('clientes') as any).insert(payload).select('id').single()

      const { data, error } = await q
      if (error) throw error

      const clienteId: string = data.id

      // ── Onboarding automático ──────────────────────────────
      if (form.empresa_nova) {
        const tarefasOnboarding = [
          {
            titulo:     '[EMPRESA NOVA] Parametrização Contábil',
            setor:      'CONTÁBIL',
            prioridade: 'Alta',
            status:     'Pendente',
          },
          {
            titulo:     '[EMPRESA NOVA] Parametrização Fiscal',
            setor:      'FISCAL',
            prioridade: 'Alta',
            status:     'Pendente',
          },
          {
            titulo:     '[EMPRESA NOVA] Parametrização DP',
            setor:      'DP',
            prioridade: 'Alta',
            status:     'Pendente',
          },
          {
            titulo:     `[EMPRESA NOVA] Legalização — ${form.nome.trim()}`,
            setor:      'LEGALIZAÇÃO',
            prioridade: 'Alta',
            status:     'Pendente',
          },
        ].map(t => ({
          ...t,
          cliente_id:  clienteId,
          criado_por:  user?.id ?? null,
          descricao: [
            form.onboarding_processo       ? `Processo/Registro: ${form.onboarding_processo}` : null,
            form.onboarding_responsavel_tecnico ? `Resp. Técnico: ${form.onboarding_responsavel_tecnico}` : null,
            form.onboarding_inicio_atividades   ? `Início de atividades: ${form.onboarding_inicio_atividades}` : null,
            form.onboarding_regime              ? `Regime: ${form.onboarding_regime}` : null,
          ].filter(Boolean).join(' | ') || null,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: tarefaErr } = await (supabase.from('tarefas') as any).insert(tarefasOnboarding)
        if (tarefaErr) throw new Error(`Tarefas onboarding: ${tarefaErr.message}`)
      }

      onSalvo(clienteId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e)
      setErro(`Erro: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Dados principais ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="sm:col-span-2">
          <label className="input-label">NOME / RAZÃO SOCIAL *</label>
          <input
            className="input w-full"
            placeholder="Nome completo ou Razão Social..."
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
          />
        </div>

        <div>
          <label className="input-label">CNPJ / CPF</label>
          <input
            className="input w-full"
            placeholder="00.000.000/0001-00 ou 000.000.000-00"
            value={form.cnpj_cpf}
            onChange={e => set('cnpj_cpf', e.target.value)}
          />
        </div>

        <div>
          <label className="input-label">E-MAIL</label>
          <input
            type="email"
            className="input w-full"
            placeholder="email@empresa.com.br"
            value={form.email}
            onChange={e => set('email', e.target.value)}
          />
        </div>

        <div>
          <label className="input-label">TELEFONE</label>
          <input
            className="input w-full"
            placeholder="(43) 0000-0000"
            value={form.telefone}
            onChange={e => set('telefone', e.target.value)}
          />
        </div>

        <div>
          <label className="input-label">WHATSAPP</label>
          <input
            className="input w-full"
            placeholder="(43) 90000-0000"
            value={form.whatsapp}
            onChange={e => set('whatsapp', e.target.value)}
          />
        </div>

        <div>
          <label className="input-label">REGIME TRIBUTÁRIO</label>
          <div className="relative">
            <select
              className="input w-full pr-7 appearance-none cursor-pointer"
              value={form.regime}
              onChange={e => set('regime', e.target.value as RegimeTributario | '')}
            >
              <option value="">Selecione...</option>
              {REGIMES.map(r => <option key={r}>{r}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="input-label">CONDIÇÃO</label>
          <div className="relative">
            <select
              className="input w-full pr-7 appearance-none cursor-pointer"
              value={form.condicao}
              onChange={e => set('condicao', e.target.value)}
            >
              {['Normal', 'Fator R', 'Sem Movimento', 'Optante pelo Lucro Real'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="input-label">RESPONSÁVEL</label>
          <input
            className="input w-full"
            placeholder="Nome do responsável no escritório..."
            value={form.responsavel}
            onChange={e => set('responsavel', e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="input-label">OBSERVAÇÕES</label>
          <textarea
            rows={3}
            className="input w-full resize-none"
            placeholder="Anotações gerais sobre o cliente..."
            value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
          />
        </div>
      </div>

      {/* ── Setores Contratados ───────────────────────────────── */}
      <div>
        <p className="input-label mb-2">SETORES CONTRATADOS</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SETORES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSetor(s)}
              className="flex items-center gap-2 text-xs text-brand-700 hover:text-brand-900 transition-colors"
            >
              {form.setores.includes(s)
                ? <CheckSquare size={15} className="text-accent-600 flex-shrink-0" />
                : <Square size={15} className="text-brand-300 flex-shrink-0" />}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── ATIVO ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => set('ativo', !form.ativo)}
        className="flex items-center gap-2 text-sm text-brand-700 hover:text-brand-900 transition-colors"
      >
        {form.ativo
          ? <CheckSquare size={15} className="text-emerald-600" />
          : <Square size={15} className="text-brand-300" />}
        ATIVO
      </button>

      {/* ── Bloco Onboarding ──────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => set('empresa_nova', !form.empresa_nova)}
          className="flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900 transition-colors"
        >
          {form.empresa_nova
            ? <CheckSquare size={15} className="text-emerald-600" />
            : <Square size={15} className="text-brand-300" />}
          EMPRESA NOVA — AUTO-CRIAR TAREFAS DE PARAMETRIZAÇÃO
        </button>

        {form.empresa_nova && (
          <div className="mt-3 border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
              Dados do Onboarding
            </p>
            <p className="text-xs text-emerald-600">
              Serão criadas automaticamente 4 tarefas de parametrização (Contábil, Fiscal, DP e Legalização).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="input-label">Nº PROCESSO / REGISTRO</label>
                <input
                  className="input w-full text-sm"
                  placeholder="PRN-12345, NIRE, CNPJ..."
                  value={form.onboarding_processo}
                  onChange={e => set('onboarding_processo', e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">RESPONSÁVEL TÉCNICO</label>
                <input
                  className="input w-full text-sm"
                  placeholder="CRC, OAB, CRM..."
                  value={form.onboarding_responsavel_tecnico}
                  onChange={e => set('onboarding_responsavel_tecnico', e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">DATA INÍCIO ATIVIDADES</label>
                <input
                  type="date"
                  className="input w-full text-sm"
                  value={form.onboarding_inicio_atividades}
                  onChange={e => set('onboarding_inicio_atividades', e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">REGIME TRIBUTÁRIO (ABERTURA)</label>
                <div className="relative">
                  <select
                    className="input w-full text-sm pr-7 appearance-none cursor-pointer"
                    value={form.onboarding_regime}
                    onChange={e => set('onboarding_regime', e.target.value as RegimeTributario | '')}
                  >
                    <option value="">Selecione...</option>
                    {REGIMES.map(r => <option key={r}>{r}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {/* ── Ações ────────────────────────────────────────────── */}
      <div className="flex gap-2 pt-1">
        <button onClick={salvar} disabled={saving} className="btn-primary flex-1">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {inicial?.id ? 'Salvar Alterações' : 'Cadastrar Cliente'}
        </button>
        <button onClick={onCancelar} className="btn-secondary">
          <X size={14} /> Cancelar
        </button>
      </div>
    </div>
  )
}
