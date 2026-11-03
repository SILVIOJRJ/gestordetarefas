'use client'

import { useEffect, useState } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Loader2, X, Save,
  BadgeCheck, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'

interface Cliente { id: string; nome: string }

interface Cert {
  id: string
  cliente_id: string | null
  nome_manual: string | null
  tipo: string
  vencimento: string
  senha: string | null
  responsavel: string | null
  status: string
  observacoes: string | null
  clientes?: { nome: string } | null
}

const TIPOS   = ['e-CNPJ', 'e-CPF', 'e-CPF PJ', 'NF-e', 'Outros']
const STATUS  = ['Ativo', 'Vencido', 'Renovando', 'Cancelado']

const HOJE = new Date().toISOString().split('T')[0]
const dias  = (venc: string) => Math.ceil((new Date(venc + 'T00:00:00').getTime() - Date.now()) / 86400000)

function vencCor(venc: string, status: string) {
  if (status === 'Cancelado') return 'text-brand-400'
  const d = dias(venc)
  if (d < 0)   return 'text-red-600 font-bold'
  if (d <= 30) return 'text-orange-500 font-semibold'
  if (d <= 90) return 'text-amber-500'
  return 'text-emerald-600'
}

function vencLabel(venc: string, status: string) {
  if (status === 'Cancelado') return new Date(venc + 'T00:00:00').toLocaleDateString('pt-BR')
  const d = dias(venc)
  const data = new Date(venc + 'T00:00:00').toLocaleDateString('pt-BR')
  if (d < 0)   return `${data} ⚠ vencido há ${Math.abs(d)}d`
  if (d === 0) return `${data} — VENCE HOJE`
  if (d <= 30) return `${data} (${d}d)`
  return data
}

const STATUS_COLOR: Record<string, string> = {
  'Ativo':     'bg-emerald-100 text-emerald-700',
  'Vencido':   'bg-red-100 text-red-700',
  'Renovando': 'bg-amber-100 text-amber-700',
  'Cancelado': 'bg-brand-100 text-brand-400',
}

const EMPTY: Omit<Cert, 'id'> = {
  cliente_id: null, nome_manual: null, tipo: 'e-CNPJ',
  vencimento: '', senha: null, responsavel: null,
  status: 'Ativo', observacoes: null,
}

export default function CertificadoDigitalPage() {
  const [certs, setCerts]         = useState<Cert[]>([])
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState<Partial<Cert> | null>(null)
  const [saving, setSaving]       = useState(false)
  const [erro, setErro]           = useState<string | null>(null)
  const [senhaVis, setSenhaVis]   = useState(false)
  const [filtro, setFiltro]       = useState('')
  const [excluindo, setExcluindo] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    const { data } = await (supabase.from('certificados_digitais') as any)
      .select('*, clientes(nome)')
      .order('vencimento', { ascending: true })
    setCerts((data ?? []) as Cert[])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    ;(supabase.from('clientes') as any)
      .select('id, nome').order('nome')
      .then(({ data }: { data: Cliente[] | null }) => setClientes(data ?? []))
  }, [])

  function abrir(c?: Cert) {
    setSenhaVis(false)
    setErro(null)
    setModal(c ? { ...c } : { ...EMPTY })
  }

  function setF(k: keyof Cert, v: unknown) {
    setModal(m => m ? { ...m, [k]: v || null } : m)
  }

  async function salvar() {
    if (!modal) return
    if (!modal.vencimento) { setErro('Data de vencimento obrigatória.'); return }
    if (!modal.cliente_id && !modal.nome_manual) { setErro('Selecione uma empresa ou informe o nome.'); return }
    setSaving(true); setErro(null)
    try {
      const payload = {
        cliente_id: modal.cliente_id || null,
        nome_manual: modal.nome_manual || null,
        tipo: modal.tipo, vencimento: modal.vencimento,
        senha: modal.senha || null, responsavel: modal.responsavel || null,
        status: modal.status, observacoes: modal.observacoes || null,
      }
      if (modal.id) {
        const { error } = await (supabase.from('certificados_digitais') as any)
          .update(payload).eq('id', modal.id)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('certificados_digitais') as any)
          .insert(payload)
        if (error) throw error
      }
      setModal(null)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este certificado? Ação irreversível.')) return
    setExcluindo(id)
    await (supabase.from('certificados_digitais') as any).delete().eq('id', id)
    setExcluindo(null)
    await carregar()
  }

  const lista = filtro
    ? certs.filter(c => {
        const nome = c.clientes?.nome ?? c.nome_manual ?? ''
        return nome.toLowerCase().includes(filtro.toLowerCase()) ||
               c.tipo.toLowerCase().includes(filtro.toLowerCase()) ||
               (c.responsavel ?? '').toLowerCase().includes(filtro.toLowerCase())
      })
    : certs

  const ativos   = certs.filter(c => c.status === 'Ativo').length
  const vencendo = certs.filter(c => c.status === 'Ativo' && dias(c.vencimento) <= 30 && dias(c.vencimento) >= 0).length
  const vencidos = certs.filter(c => dias(c.vencimento) < 0 && c.status !== 'Cancelado').length

  return (
    <Shell>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
              <BadgeCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-900">Certificado Digital</h1>
              <p className="text-sm text-brand-500">Vencimentos e renovações de e-CNPJ / e-CPF</p>
            </div>
          </div>
          <button onClick={() => abrir()} className="btn-primary shrink-0">
            <Plus size={14} /> Novo Certificado
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',       value: certs.length, icon: BadgeCheck,    cls: 'text-brand-600',   bg: 'bg-brand-50' },
            { label: 'Ativos',      value: ativos,       icon: CheckCircle2,  cls: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Vencendo 30d',value: vencendo,     icon: Clock,         cls: 'text-amber-600',   bg: 'bg-amber-50' },
            { label: 'Vencidos',    value: vencidos,     icon: AlertTriangle, cls: 'text-red-600',     bg: 'bg-red-50' },
          ].map(({ label, value, icon: Icon, cls, bg }) => (
            <div key={label} className="bg-white border border-brand-100 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon size={16} className={cls} />
              </div>
              <div>
                <p className="text-xl font-bold text-brand-900">{value}</p>
                <p className="text-xs text-brand-400 leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Busca */}
        <input
          className="input max-w-sm"
          placeholder="Buscar empresa, tipo, responsável..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />

        {/* Tabela */}
        <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-700">Certificados</h2>
            <span className="text-xs text-brand-400">{lista.length} registro{lista.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-brand-300" />
            </div>
          ) : lista.length === 0 ? (
            <div className="py-12 text-center text-brand-300 text-sm">
              Nenhum certificado cadastrado.
              <br />
              <button onClick={() => abrir()} className="text-sky-600 underline mt-1 text-xs">Adicionar o primeiro</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-50 text-xs text-brand-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Empresa</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Tipo</th>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Responsável</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Status</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50">
                  {lista.map(c => (
                    <tr key={c.id} className="hover:bg-brand-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-900">
                          {c.clientes?.nome ?? c.nome_manual ?? '—'}
                        </p>
                        {c.observacoes && <p className="text-xs text-brand-400 mt-0.5 line-clamp-1">{c.observacoes}</p>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-brand-600 font-medium">
                        {c.tipo}
                      </td>
                      <td className={`px-4 py-3 text-xs ${vencCor(c.vencimento, c.status)}`}>
                        {vencLabel(c.vencimento, c.status)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-brand-600">
                        {c.responsavel ?? '—'}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] ?? ''}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => abrir(c)} className="p-1.5 rounded hover:bg-brand-100 text-brand-500">
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => excluir(c.id)}
                            disabled={excluindo === c.id}
                            className="p-1.5 rounded hover:bg-red-50 text-brand-400 hover:text-red-500"
                          >
                            {excluindo === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-50">
              <h3 className="font-semibold text-brand-900">
                {modal.id ? 'Editar Certificado' : 'Novo Certificado'}
              </h3>
              <button onClick={() => setModal(null)} className="p-1 hover:bg-brand-100 rounded text-brand-400">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Empresa */}
              <div>
                <label className="input-label">Empresa (cliente cadastrado)</label>
                <select className="input" value={modal.cliente_id ?? ''} onChange={e => {
                  setF('cliente_id', e.target.value)
                  if (e.target.value) setF('nome_manual', null)
                }}>
                  <option value="">— selecionar cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              {!modal.cliente_id && (
                <div>
                  <label className="input-label">Ou nome manual (empresa não cadastrada)</label>
                  <input className="input" placeholder="Nome da empresa..."
                    value={modal.nome_manual ?? ''}
                    onChange={e => setF('nome_manual', e.target.value)} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Tipo *</label>
                  <select className="input" value={modal.tipo ?? 'e-CNPJ'} onChange={e => setF('tipo', e.target.value)}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Vencimento *</label>
                  <input type="date" className="input" value={modal.vencimento ?? ''}
                    onChange={e => setF('vencimento', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Status</label>
                  <select className="input" value={modal.status ?? 'Ativo'} onChange={e => setF('status', e.target.value)}>
                    {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Responsável</label>
                  <input className="input" placeholder="Nome..."
                    value={modal.responsavel ?? ''}
                    onChange={e => setF('responsavel', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="input-label">Senha do certificado</label>
                <div className="relative">
                  <input
                    type={senhaVis ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Senha..."
                    value={modal.senha ?? ''}
                    onChange={e => setF('senha', e.target.value)}
                  />
                  <button type="button"
                    onClick={() => setSenhaVis(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400">
                    {senhaVis ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="input-label">Observações</label>
                <textarea className="input resize-none" rows={2}
                  value={modal.observacoes ?? ''}
                  onChange={e => setF('observacoes', e.target.value)} />
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={salvar} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
                <button onClick={() => setModal(null)} className="btn-secondary">
                  <X size={14} /> Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
