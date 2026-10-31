'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/types/database.types'
import { Save, UserCheck, Phone, Mail, AlertTriangle, ArrowRightLeft, Plus, Trash2 } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

export type VinculoAtendimento = 'Exclusivo Denazaré' | 'Exclusivo Silvio' | 'Carteira Conjunta'

export interface ContatoChave {
  nome: string
  cargo: string
  whatsapp: string
  email_guias: string
}

export interface GovernancaData {
  vinculo_atendimento: VinculoAtendimento | null
  contatos_chave: ContatoChave[]
  manual_costumes: string
}

const VINCULOS: VinculoAtendimento[] = ['Exclusivo Denazaré', 'Exclusivo Silvio', 'Carteira Conjunta']

const VINCULO_COR: Record<VinculoAtendimento, string> = {
  'Exclusivo Denazaré':  'bg-purple-100 text-purple-800 border-purple-200',
  'Exclusivo Silvio':    'bg-blue-100 text-blue-800 border-blue-200',
  'Carteira Conjunta':   'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const CONTATO_VAZIO: ContatoChave = { nome: '', cargo: '', whatsapp: '', email_guias: '' }

interface Props {
  cliente: Cliente
  onAtualizado?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────

function parseGovernanca(c: Cliente): GovernancaData {
  // Lê campos extras do cliente (armazenados no obs ou em colunas extras via migration)
  const raw = (c as unknown as Record<string, unknown>)
  return {
    vinculo_atendimento: (raw['vinculo_atendimento'] as VinculoAtendimento | null) ?? null,
    contatos_chave: (() => {
      try { return JSON.parse(raw['contatos_chave'] as string ?? '[]') as ContatoChave[] }
      catch { return [] }
    })(),
    manual_costumes: (raw['manual_costumes'] as string) ?? '',
  }
}

// ─── Componente ───────────────────────────────────────────────

export default function ClientGovernanceTab({ cliente, onAtualizado }: Props) {
  const [gov, setGov] = useState<GovernancaData>(() => parseGovernanca(cliente))
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  // Transferência de carteira
  const [showTransferencia, setShowTransferencia] = useState(false)
  const [novoResponsavel, setNovoResponsavel] = useState('')
  const [transferindo, setTransferindo] = useState(false)

  useEffect(() => {
    setGov(parseGovernanca(cliente))
  }, [cliente.id])

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        vinculo_atendimento: gov.vinculo_atendimento,
        contatos_chave: JSON.stringify(gov.contatos_chave),
        manual_costumes: gov.manual_costumes,
        updated_at: new Date().toISOString(),
      }
      const { error } = await (supabase.from('clientes') as any).update(payload).eq('id', cliente.id)
      if (error) throw error
      setMsg({ tipo: 'ok', texto: 'Governança salva com sucesso.' })
      onAtualizado?.()
    } catch (e) {
      setMsg({ tipo: 'err', texto: String(e) })
    } finally {
      setSalvando(false)
    }
  }

  async function transferirCarteira() {
    if (!novoResponsavel.trim()) return
    setTransferindo(true)
    try {
      // Atualiza responsável do cliente
      await (supabase.from('clientes') as any)
        .update({ responsavel: novoResponsavel.trim(), updated_at: new Date().toISOString() })
        .eq('id', cliente.id)

      // Reatribui tarefas ativas
      await (supabase.from('tarefas') as any)
        .update({ responsavel: novoResponsavel.trim(), updated_at: new Date().toISOString() })
        .eq('cliente_id', cliente.id)
        .in('status', ['Pendente', 'Em andamento', 'Aguardando'])

      setMsg({ tipo: 'ok', texto: `Carteira transferida para ${novoResponsavel}. Tarefas ativas reatribuídas.` })
      setShowTransferencia(false)
      setNovoResponsavel('')
      onAtualizado?.()
    } catch (e) {
      setMsg({ tipo: 'err', texto: String(e) })
    } finally {
      setTransferindo(false)
    }
  }

  function addContato() {
    setGov(g => ({ ...g, contatos_chave: [...g.contatos_chave, { ...CONTATO_VAZIO }] }))
  }

  function removeContato(i: number) {
    setGov(g => ({ ...g, contatos_chave: g.contatos_chave.filter((_, j) => j !== i) }))
  }

  function updateContato(i: number, field: keyof ContatoChave, value: string) {
    setGov(g => ({
      ...g,
      contatos_chave: g.contatos_chave.map((c, j) => j === i ? { ...c, [field]: value } : c),
    }))
  }

  return (
    <div className="space-y-6">

      {msg && (
        <div className={`text-sm rounded-lg px-4 py-2 ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      {/* ─── Vínculo de Atendimento ──────────────────────────── */}
      <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <UserCheck size={16} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-brand-700">Vínculo de Atendimento</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {VINCULOS.map(v => (
            <button
              key={v}
              onClick={() => setGov(g => ({ ...g, vinculo_atendimento: g.vinculo_atendimento === v ? null : v }))}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                gov.vinculo_atendimento === v
                  ? VINCULO_COR[v]
                  : 'border-brand-200 text-brand-500 hover:bg-brand-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {gov.vinculo_atendimento && (
          <p className="text-xs text-brand-400">
            Responsável principal: <strong className="text-brand-600">{cliente.responsavel ?? '—'}</strong>
          </p>
        )}
      </div>

      {/* ─── Matriz de Contatos Chave ────────────────────────── */}
      <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-brand-700">Contatos Chave</h3>
          </div>
          <button onClick={addContato} className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-800">
            <Plus size={14} /> Adicionar
          </button>
        </div>

        {gov.contatos_chave.length === 0 ? (
          <p className="text-xs text-brand-300 text-center py-4">Nenhum contato cadastrado. Clique em "Adicionar".</p>
        ) : (
          <div className="space-y-3">
            {gov.contatos_chave.map((c, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 bg-brand-50/50 rounded-lg p-3 relative">
                <button
                  onClick={() => removeContato(i)}
                  className="absolute top-2 right-2 text-brand-300 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
                <div>
                  <label className="text-[11px] text-brand-400 block mb-0.5">Nome</label>
                  <input
                    value={c.nome}
                    onChange={e => updateContato(i, 'nome', e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full text-xs border border-brand-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-brand-400 block mb-0.5">Cargo</label>
                  <input
                    value={c.cargo}
                    onChange={e => updateContato(i, 'cargo', e.target.value)}
                    placeholder="Ex: Sócio / Financeiro"
                    className="w-full text-xs border border-brand-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-brand-400 block mb-0.5 flex items-center gap-1">
                    <Phone size={10} /> WhatsApp
                  </label>
                  <input
                    value={c.whatsapp}
                    onChange={e => updateContato(i, 'whatsapp', e.target.value)}
                    placeholder="(47) 9 9999-9999"
                    className="w-full text-xs border border-brand-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-brand-400 block mb-0.5 flex items-center gap-1">
                    <Mail size={10} /> E-mail Guias
                  </label>
                  <input
                    value={c.email_guias}
                    onChange={e => updateContato(i, 'email_guias', e.target.value)}
                    placeholder="financeiro@empresa.com"
                    className="w-full text-xs border border-brand-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-400"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Manual de Costumes ─────────────────────────────── */}
      <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-brand-700">Manual de Costumes & Particularidades</h3>
        </div>
        <p className="text-xs text-brand-400">Instruções para atendimento emergencial e substituição. Use Markdown.</p>
        <textarea
          value={gov.manual_costumes}
          onChange={e => setGov(g => ({ ...g, manual_costumes: e.target.value }))}
          rows={8}
          placeholder={`## Preferências de comunicação\n- Prefere contato por WhatsApp\n- Não ligar depois das 18h\n\n## Particularidades fiscais\n- Guias enviadas sempre até dia 15\n- CC obrigatório para o sócio X\n\n## Documentos físicos\n- Buscar documentos toda 1ª segunda-feira do mês`}
          className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent-400 resize-y"
        />
        {/* Preview markdown simples */}
        {gov.manual_costumes && (
          <details className="text-xs text-brand-500">
            <summary className="cursor-pointer hover:text-brand-700">Visualizar prévia</summary>
            <div className="mt-2 p-3 bg-brand-50 rounded-lg whitespace-pre-wrap font-mono text-[11px] text-brand-600 max-h-48 overflow-y-auto">
              {gov.manual_costumes}
            </div>
          </details>
        )}
      </div>

      {/* ─── Transferência de Carteira ───────────────────────── */}
      <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-700">Transferência de Carteira / Substituição de Emergência</h3>
          </div>
        </div>
        <p className="text-xs text-brand-500">
          Reatribui o responsável do cliente <strong>{cliente.nome}</strong> e todas as tarefas ativas a outro operador.
          Responsável atual: <strong>{cliente.responsavel ?? 'não definido'}</strong>
        </p>

        {!showTransferencia ? (
          <button
            onClick={() => setShowTransferencia(true)}
            className="flex items-center gap-2 text-sm text-amber-700 border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition"
          >
            <ArrowRightLeft size={14} />
            Iniciar Transferência
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-brand-500 block mb-1">Nome do novo responsável *</label>
              <input
                value={novoResponsavel}
                onChange={e => setNovoResponsavel(e.target.value)}
                placeholder="Ex: Silvio / Denazaré"
                className="border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowTransferencia(false); setNovoResponsavel('') }} className="text-sm text-brand-500 px-3 py-1.5 hover:bg-brand-50 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={transferirCarteira}
                disabled={transferindo || !novoResponsavel.trim()}
                className="text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-medium px-4 py-1.5 rounded-lg"
              >
                {transferindo ? 'Transferindo…' : 'Confirmar Transferência'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Salvar */}
      <div className="flex justify-end">
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
        >
          <Save size={15} />
          {salvando ? 'Salvando…' : 'Salvar Governança'}
        </button>
      </div>
    </div>
  )
}
