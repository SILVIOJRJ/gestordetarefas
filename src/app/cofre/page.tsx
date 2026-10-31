'use client'

import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import {
  Lock, Plus, Eye, EyeOff, Copy, Trash2,
  ShieldCheck, AlertTriangle, Loader2, Search, X,
} from 'lucide-react'

interface CofreItem {
  id: string
  cliente_id: string
  titulo: string
  payload_enc: string // JSON: { ciphertext, iv, salt }
  criado_por: string
  created_at: string
  // virtual — preenchido após decifragem
  decifrado?: string
}

interface EncPayload {
  ciphertext: string
  iv: string
  salt: string
}

export default function CofrePage() {
  const [masterKey, setMasterKey]     = useState('')
  const [masterOk, setMasterOk]       = useState(false)
  const [itens, setItens]             = useState<CofreItem[]>([])
  const [filtro, setFiltro]           = useState('')
  const [loading, setLoading]         = useState(false)
  const [erro, setErro]               = useState<string | null>(null)
  const [revelados, setRevelados]     = useState<Record<string, string>>({})
  const [showAdd, setShowAdd]         = useState(false)
  const [novoTitulo, setNovoTitulo]   = useState('')
  const [novoSegredo, setNovoSegredo] = useState('')
  const [clienteId, setClienteId]     = useState('')
  const [clientes, setClientes]       = useState<Array<{ id: string; nome: string }>>([])
  const [saving, setSaving]           = useState(false)

  // Carrega clientes para o filtro
  useEffect(() => {
    supabase.from('clientes').select('id, nome').order('nome').then(({ data }) => {
      setClientes(data ?? [])
    })
  }, [])

  const carregarItens = useCallback(async () => {
    setLoading(true)
    setErro(null)
    let q = supabase.from('cofre_credenciais').select('*').order('created_at', { ascending: false })
    if (clienteId) q = q.eq('cliente_id', clienteId)
    const { data, error } = await q
    if (error) setErro(error.message)
    else setItens((data ?? []) as CofreItem[])
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    if (masterOk) carregarItens()
  }, [masterOk, carregarItens])

  async function revelarItem(item: CofreItem) {
    if (revelados[item.id]) {
      setRevelados((r) => { const n = { ...r }; delete n[item.id]; return n })
      return
    }
    try {
      const payload: EncPayload = JSON.parse(item.payload_enc)
      const texto = await decryptSecret(payload.ciphertext, payload.iv, payload.salt, masterKey)
      setRevelados((r) => ({ ...r, [item.id]: texto }))
    } catch {
      setErro('Falha ao decifrar. Verifique a Passphrase Mestra.')
    }
  }

  async function copiarItem(item: CofreItem) {
    try {
      const payload: EncPayload = JSON.parse(item.payload_enc)
      const texto = await decryptSecret(payload.ciphertext, payload.iv, payload.salt, masterKey)
      await navigator.clipboard.writeText(texto)
    } catch {
      setErro('Falha ao copiar.')
    }
  }

  async function salvarNovo() {
    if (!novoTitulo.trim() || !novoSegredo.trim() || !clienteId) {
      setErro('Preencha todos os campos antes de salvar.')
      return
    }
    setSaving(true)
    setErro(null)
    try {
      const enc = await encryptSecret(novoSegredo, masterKey)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado.')
      const { error } = await supabase.from('cofre_credenciais').insert({
        cliente_id:  clienteId,
        titulo:      novoTitulo.trim(),
        payload_enc: JSON.stringify(enc),
        criado_por:  user.id,
      })
      if (error) throw error
      setNovoTitulo('')
      setNovoSegredo('')
      setShowAdd(false)
      await carregarItens()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function excluirItem(id: string) {
    if (!confirm('Excluir esta credencial permanentemente?')) return
    await supabase.from('cofre_credenciais').delete().eq('id', id)
    setItens((prev) => prev.filter((i) => i.id !== id))
  }

  const itensFiltrados = itens.filter((i) =>
    i.titulo.toLowerCase().includes(filtro.toLowerCase()),
  )

  // ── Tela de desbloqueio ────────────────────────────────────
  if (!masterOk) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="card w-full max-w-sm text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-brand-900 flex items-center justify-center mx-auto">
              <Lock size={28} className="text-accent-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-900">Cofre de Senhas</h1>
              <p className="text-sm text-brand-500 mt-1">
                Digite a Passphrase Mestra para desbloquear.<br />
                Ela nunca é enviada ao servidor.
              </p>
            </div>
            <div>
              <label className="input-label text-left block">Passphrase Mestra</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••••••"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && masterKey.length >= 8) setMasterOk(true) }}
                autoFocus
              />
            </div>
            {masterKey.length > 0 && masterKey.length < 8 && (
              <p className="text-xs text-warning-600 flex items-center gap-1">
                <AlertTriangle size={13} /> Mínimo 8 caracteres.
              </p>
            )}
            <button
              onClick={() => setMasterOk(true)}
              disabled={masterKey.length < 8}
              className="btn-primary w-full justify-center"
            >
              <ShieldCheck size={16} /> Desbloquear Cofre
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Tela principal do cofre ────────────────────────────────
  return (
    <Shell>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl bg-brand-900 flex items-center justify-center">
              <Lock size={18} className="text-accent-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-900">Cofre de Senhas</h1>
              <p className="text-xs text-accent-600 flex items-center gap-1">
                <ShieldCheck size={12} /> E2EE ativo — chave apenas em memória
              </p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> Nova Credencial
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              className="input pl-9"
              placeholder="Buscar credencial..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <select
            className="input w-44"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2 text-sm text-danger-600 bg-danger-100 px-3 py-2 rounded-lg">
            <AlertTriangle size={15} />
            {erro}
            <button onClick={() => setErro(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Modal: nova credencial */}
        {showAdd && (
          <div className="card border-2 border-brand-300 space-y-4">
            <h2 className="font-semibold text-brand-900">Nova Credencial</h2>
            <div>
              <label className="input-label">Empresa</label>
              <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Selecione...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Título / Identificação</label>
              <input className="input" placeholder="Ex: Acesso Receita Federal" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} />
            </div>
            <div>
              <label className="input-label">Segredo (senha, token, chave...)</label>
              <input type="password" className="input" placeholder="Será cifrado localmente" value={novoSegredo} onChange={(e) => setNovoSegredo(e.target.value)} />
            </div>
            <p className="text-xs text-brand-500">
              🔒 O segredo é cifrado com AES-GCM 256-bit antes de sair do seu dispositivo.
            </p>
            <div className="flex gap-2">
              <button onClick={salvarNovo} disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                Cifrar e Salvar
              </button>
              <button onClick={() => { setShowAdd(false); setErro(null) }} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-brand-400" />
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="text-center py-12 text-brand-400">
            <Lock size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma credencial encontrada.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {itensFiltrados.map((item) => (
              <li key={item.id} className="card flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <Lock size={15} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-900">{item.titulo}</p>
                  {revelados[item.id] ? (
                    <p className="text-xs font-mono text-accent-700 bg-accent-50 px-2 py-0.5 rounded mt-0.5 break-all">
                      {revelados[item.id]}
                    </p>
                  ) : (
                    <p className="text-xs text-brand-400 mt-0.5">••••••••••••</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => revelarItem(item)} className="p-2 rounded-lg hover:bg-brand-100 text-brand-500 hover:text-brand-900" title={revelados[item.id] ? 'Ocultar' : 'Revelar'}>
                    {revelados[item.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button onClick={() => copiarItem(item)} className="p-2 rounded-lg hover:bg-brand-100 text-brand-500 hover:text-brand-900" title="Copiar">
                    <Copy size={15} />
                  </button>
                  <button onClick={() => excluirItem(item.id)} className="p-2 rounded-lg hover:bg-danger-100 text-brand-400 hover:text-danger-600" title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  )
}
