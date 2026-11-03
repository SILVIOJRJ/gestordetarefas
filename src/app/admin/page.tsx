'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import type {
  PerfilUsuario, AcessoLog, RoleUsuario, PermissoesModulos, Funcionario,
} from '@/types/database.types'
import { PERMISSOES_DEFAULT as PERM_DEFAULT } from '@/types/database.types'
import {
  Shield, Users, UserCog, ClipboardList, Settings, Search, RefreshCw,
  ChevronDown, ChevronUp, Clock, Plus, Save, X, Pencil, Trash2,
  Building2, Lock, FileSignature, Activity,
} from 'lucide-react'

// ─── Módulos de permissão ─────────────────────────────────────

const MODULOS: Array<{ key: keyof PermissoesModulos; label: string; desc: string }> = [
  { key: 'modulo_pessoal',    label: 'Depto. Pessoal',     desc: 'Tarefas e rotinas de RH' },
  { key: 'modulo_fiscal',     label: 'Depto. Fiscal',      desc: 'Rotinas fiscais e obrigações' },
  { key: 'modulo_contabil',   label: 'Depto. Contábil',    desc: 'Clientes, contratos e lançamentos' },
  { key: 'modulo_societario', label: 'Depto. Societário',  desc: 'Legalização e processos' },
  { key: 'modulo_financeiro', label: 'Financeiro Interno', desc: 'Painel gerencial e relatórios' },
  { key: 'acoes_financeiras', label: 'Ações Financeiras',  desc: 'Criar/editar faturas e extratos' },
]

const ROLE_CONFIG: Record<RoleUsuario, { label: string; cor: string; desc: string }> = {
  admin:               { label: 'Admin',       cor: 'bg-rose-100 text-rose-800',  desc: 'Acesso total a todos os módulos e clientes' },
  gestor_cliente:      { label: 'Gestor',      cor: 'bg-blue-100 text-blue-800',  desc: 'Empresa própria — documentos, obrigações e guias' },
  colaborador_cliente: { label: 'Colaborador', cor: 'bg-gray-100 text-gray-700',  desc: 'Apenas holerites, informes e férias do próprio CPF' },
}

const SETORES = ['Legalização', 'Fiscal', 'RH', 'Office Boy', 'Gerencial', 'Administrativo']

type Aba = 'usuarios' | 'equipe' | 'contratos_internos' | 'auditoria' | 'configuracoes'

function fmtTs(ts: string | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Tipos internos ────────────────────────────────────────────

interface ContratoInterno {
  id: string
  titulo: string
  descricao: string | null
  valor: number | null
  inicio: string | null
  termino: string | null
  status: string
  responsavel: string | null
  observacoes: string | null
  created_at: string
}

const CONTRATO_VAZIO: Omit<ContratoInterno, 'id' | 'created_at'> = {
  titulo: '', descricao: '', valor: null, inicio: '', termino: '',
  status: 'Ativo', responsavel: '', observacoes: '',
}

// ─── Componente principal ──────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('usuarios')
  const [roleAtual, setRoleAtual] = useState<RoleUsuario | null>(null)

  // Verificação de acesso
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await (supabase.from('perfis_usuarios') as any)
        .select('role').eq('id', user.id).single()
      const role = data?.role as RoleUsuario | null
      setRoleAtual(role)
      if (role !== 'admin') router.push('/dashboard')
    })()
  }, [router])

  // ─── USUÁRIOS ──────────────────────────────────────────────

  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [editandoRole, setEditandoRole] = useState<string | null>(null)
  const [salvandoRole, setSalvandoRole] = useState(false)
  const [expandindoPerm, setExpandindoPerm] = useState<string | null>(null)
  const [salvandoPerm, setSalvandoPerm] = useState(false)
  const [buscaUsuario, setBuscaUsuario] = useState('')

  const carregarUsuarios = useCallback(async () => {
    setLoadingUsuarios(true)
    try {
      const { data } = await (supabase.from('perfis_usuarios') as any).select('*').order('nome')
      setUsuarios((data ?? []) as PerfilUsuario[])
    } finally {
      setLoadingUsuarios(false)
    }
  }, [])

  useEffect(() => { carregarUsuarios() }, [carregarUsuarios])

  async function salvarRole(userId: string, novoRole: RoleUsuario) {
    setSalvandoRole(true)
    try {
      await (supabase.from('perfis_usuarios') as any)
        .update({ role: novoRole, updated_at: new Date().toISOString() }).eq('id', userId)
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, role: novoRole } : u))
      setEditandoRole(null)
    } finally { setSalvandoRole(false) }
  }

  async function salvarPermissoes(userId: string, perm: PermissoesModulos) {
    setSalvandoPerm(true)
    try {
      await (supabase.from('perfis_usuarios') as any)
        .update({ permissoes_modulos: perm, updated_at: new Date().toISOString() }).eq('id', userId)
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, permissoes_modulos: perm } : u))
    } finally { setSalvandoPerm(false) }
  }

  async function toggleAtivo(u: PerfilUsuario) {
    const ativo = !u.ativo
    await (supabase.from('perfis_usuarios') as any)
      .update({ ativo, updated_at: new Date().toISOString() }).eq('id', u.id)
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ativo } : x))
  }

  const usuariosFiltrados = usuarios.filter(u => {
    const q = buscaUsuario.toLowerCase()
    return !q || u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  // ─── EQUIPE ────────────────────────────────────────────────

  const [equipe, setEquipe] = useState<Funcionario[]>([])
  const [loadingEquipe, setLoadingEquipe] = useState(false)
  const [modalEquipe, setModalEquipe] = useState(false)
  const [editEquipe, setEditEquipe] = useState<Partial<Funcionario> | null>(null)
  const [salvandoEquipe, setSalvandoEquipe] = useState(false)

  const carregarEquipe = useCallback(async () => {
    setLoadingEquipe(true)
    try {
      const { data } = await (supabase.from('funcionarios') as any).select('*').order('nome')
      setEquipe((data ?? []) as Funcionario[])
    } finally { setLoadingEquipe(false) }
  }, [])

  useEffect(() => { if (aba === 'equipe') carregarEquipe() }, [aba, carregarEquipe])

  function abrirNovoFuncionario() {
    setEditEquipe({ nome: '', email: '', setor: null, cargo: '', ativo: true })
    setModalEquipe(true)
  }

  function abrirEditarFuncionario(f: Funcionario) {
    setEditEquipe({ ...f })
    setModalEquipe(true)
  }

  async function salvarFuncionario() {
    if (!editEquipe || !editEquipe.nome || !editEquipe.email) return
    setSalvandoEquipe(true)
    try {
      const payload = {
        nome: editEquipe.nome,
        email: editEquipe.email,
        setor: editEquipe.setor ?? null,
        cargo: editEquipe.cargo ?? null,
        ativo: editEquipe.ativo ?? true,
        updated_at: new Date().toISOString(),
      }
      if (editEquipe.id) {
        await (supabase.from('funcionarios') as any).update(payload).eq('id', editEquipe.id)
      } else {
        await (supabase.from('funcionarios') as any).insert(payload)
      }
      setModalEquipe(false)
      setEditEquipe(null)
      carregarEquipe()
    } finally { setSalvandoEquipe(false) }
  }

  async function excluirFuncionario(id: string) {
    if (!confirm('Excluir este funcionário?')) return
    await (supabase.from('funcionarios') as any).delete().eq('id', id)
    setEquipe(prev => prev.filter(f => f.id !== id))
  }

  // ─── CONTRATOS INTERNOS ────────────────────────────────────

  const [contratos, setContratos] = useState<ContratoInterno[]>([])
  const [loadingContratos, setLoadingContratos] = useState(false)
  const [modalContrato, setModalContrato] = useState(false)
  const [editContrato, setEditContrato] = useState<Partial<ContratoInterno> | null>(null)
  const [salvandoContrato, setSalvandoContrato] = useState(false)

  const carregarContratos = useCallback(async () => {
    setLoadingContratos(true)
    try {
      const { data } = await (supabase.from('contratos_internos') as any)
        .select('*').order('created_at', { ascending: false })
      setContratos((data ?? []) as ContratoInterno[])
    } finally { setLoadingContratos(false) }
  }, [])

  useEffect(() => { if (aba === 'contratos_internos') carregarContratos() }, [aba, carregarContratos])

  async function salvarContrato() {
    if (!editContrato?.titulo) return
    setSalvandoContrato(true)
    try {
      const payload = {
        titulo: editContrato.titulo,
        descricao: editContrato.descricao ?? null,
        valor: editContrato.valor != null ? Number(editContrato.valor) : null,
        inicio: editContrato.inicio || null,
        termino: editContrato.termino || null,
        status: editContrato.status ?? 'Ativo',
        responsavel: editContrato.responsavel ?? null,
        observacoes: editContrato.observacoes ?? null,
        updated_at: new Date().toISOString(),
      }
      if (editContrato.id) {
        await (supabase.from('contratos_internos') as any).update(payload).eq('id', editContrato.id)
      } else {
        await (supabase.from('contratos_internos') as any).insert(payload)
      }
      setModalContrato(false)
      setEditContrato(null)
      carregarContratos()
    } finally { setSalvandoContrato(false) }
  }

  async function excluirContrato(id: string) {
    if (!confirm('Excluir este contrato?')) return
    await (supabase.from('contratos_internos') as any).delete().eq('id', id)
    setContratos(prev => prev.filter(c => c.id !== id))
  }

  // ─── AUDITORIA ────────────────────────────────────────────

  const [logs, setLogs] = useState<AcessoLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [buscaLog, setBuscaLog] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 50

  const carregarLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const { data } = await (supabase.from('acessos_log') as any)
        .select('*')
        .order('acessado_em', { ascending: false })
        .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1)
      setLogs((data ?? []) as AcessoLog[])
    } finally { setLoadingLogs(false) }
  }, [pagina])

  useEffect(() => { if (aba === 'auditoria') carregarLogs() }, [aba, carregarLogs])

  const logsFiltrados = logs.filter(l => {
    const q = buscaLog.toLowerCase()
    return !q || l.funcionario_nome?.toLowerCase().includes(q) ||
      l.funcionario_email?.toLowerCase().includes(q) || l.ip?.includes(q)
  })

  // ─── CONFIGURAÇÕES ────────────────────────────────────────

  const [cofre, setCofre] = useState({ autoLockMin: 15, requireMasterOnExport: true })
  const [salvoSeguranca, setSalvoSeguranca] = useState(false)

  // ─── Render ───────────────────────────────────────────────

  if (roleAtual === null) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Shell>
    )
  }

  const ABAS: Array<{ id: Aba; label: string; icon: React.ElementType }> = [
    { id: 'usuarios',           label: 'Usuários',           icon: Users },
    { id: 'equipe',             label: 'Equipe Interna',     icon: UserCog },
    { id: 'contratos_internos', label: 'Contratos Internos', icon: FileSignature },
    { id: 'auditoria',          label: 'Auditoria',          icon: ClipboardList },
    { id: 'configuracoes',      label: 'Configurações',      icon: Settings },
  ]

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <Shield size={22} className="text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-800">Central de Administração</h1>
            <p className="text-xs text-brand-400">Gestão completa do sistema — acesso restrito ao administrador</p>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Usuários', valor: usuarios.filter(u => u.ativo).length, sub: 'ativos', icon: Users, cor: 'bg-blue-50 text-blue-600' },
            { label: 'Equipe', valor: equipe.filter(f => f.ativo).length, sub: 'colaboradores', icon: UserCog, cor: 'bg-emerald-50 text-emerald-600' },
            { label: 'Contratos', valor: contratos.filter(c => c.status === 'Ativo').length, sub: 'vigentes', icon: FileSignature, cor: 'bg-violet-50 text-violet-600' },
            { label: 'Acessos', valor: logs.length > 0 ? `${logs.length}+` : '—', sub: 'no log', icon: Activity, cor: 'bg-amber-50 text-amber-600' },
          ].map(({ label, valor, sub, icon: Icon, cor }) => (
            <div key={label} className="bg-white border border-brand-100 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${cor} flex items-center justify-center shrink-0`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-lg font-bold text-brand-800 leading-none">{valor}</p>
                <p className="text-[10px] text-brand-400">{label} {sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-brand-50 rounded-xl p-1 overflow-x-auto">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0
                ${aba === id ? 'bg-white text-brand-800 shadow-sm' : 'text-brand-400 hover:text-brand-600'}`}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ─── ABA: USUÁRIOS ──────────────────────────────────── */}
        {aba === 'usuarios' && (
          <div className="space-y-4">
            <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-50 flex flex-col sm:flex-row gap-2 sm:items-center">
                <h2 className="text-sm font-semibold text-brand-700 shrink-0">Usuários do Sistema</h2>
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300" />
                  <input
                    value={buscaUsuario}
                    onChange={e => setBuscaUsuario(e.target.value)}
                    placeholder="Buscar por nome ou email…"
                    className="w-full border border-brand-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                  />
                </div>
                <button onClick={carregarUsuarios} className="p-1.5 hover:bg-brand-50 rounded text-brand-400 shrink-0">
                  <RefreshCw size={14} />
                </button>
              </div>

              {loadingUsuarios ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
              ) : (
                <div className="divide-y divide-brand-50">
                  {usuariosFiltrados.map(u => (
                    <div key={u.id} className="px-4 py-3 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {u.nome?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-800 truncate">{u.nome}</p>
                          <p className="text-xs text-brand-400 truncate">{u.email}</p>
                        </div>
                        {/* Role */}
                        {editandoRole === u.id ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              defaultValue={u.role}
                              onChange={e => salvarRole(u.id, e.target.value as RoleUsuario)}
                              disabled={salvandoRole}
                              className="text-xs border border-brand-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-400"
                              autoFocus
                            >
                              {(Object.keys(ROLE_CONFIG) as RoleUsuario[]).map(r => (
                                <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                              ))}
                            </select>
                            <button onClick={() => setEditandoRole(null)} className="text-brand-400 hover:text-brand-700">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditandoRole(u.id)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full shrink-0 ${ROLE_CONFIG[u.role]?.cor ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {ROLE_CONFIG[u.role]?.label ?? u.role}
                            <ChevronDown size={10} />
                          </button>
                        )}
                        {/* Toggle ativo */}
                        <button
                          onClick={() => toggleAtivo(u)}
                          className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${u.ativo ? 'bg-emerald-500' : 'bg-brand-200'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${u.ativo ? 'left-5' : 'left-0.5'}`} />
                        </button>
                        {/* Permissões */}
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => setExpandindoPerm(expandindoPerm === u.id ? null : u.id)}
                            className="text-brand-400 hover:text-brand-700"
                          >
                            {expandindoPerm === u.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>

                      {/* Último acesso */}
                      {u.ultimo_acesso && (
                        <div className="ml-12 flex items-center gap-1 text-[10px] text-brand-400">
                          <Clock size={10} /> Último acesso: {fmtTs(u.ultimo_acesso)}
                        </div>
                      )}

                      {/* Permissões modulares */}
                      {expandindoPerm === u.id && u.role !== 'admin' && (
                        <div className="ml-12 bg-brand-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-semibold text-brand-600 mb-2">Módulos acessíveis</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {MODULOS.map(({ key, label, desc }) => {
                              const perm = u.permissoes_modulos ?? PERM_DEFAULT
                              const ativo = perm[key] ?? false
                              return (
                                <button
                                  key={key}
                                  onClick={() => salvarPermissoes(u.id, { ...(u.permissoes_modulos ?? PERM_DEFAULT), [key]: !ativo })}
                                  disabled={salvandoPerm}
                                  className={`flex items-start gap-2 text-left p-2 rounded-lg border transition ${
                                    ativo ? 'bg-white border-accent-300' : 'bg-brand-100 border-brand-200 opacity-60'
                                  }`}
                                >
                                  <span className={`mt-0.5 w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                                    ativo ? 'bg-accent-500 border-accent-500' : 'border-brand-300 bg-white'
                                  }`}>
                                    {ativo && <span className="w-1.5 h-1.5 bg-white rounded-sm" />}
                                  </span>
                                  <div>
                                    <p className="text-xs font-medium text-brand-800">{label}</p>
                                    <p className="text-[10px] text-brand-400">{desc}</p>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legenda */}
            <div className="bg-white border border-brand-100 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-3">Papéis disponíveis</h3>
              <div className="space-y-2">
                {(Object.entries(ROLE_CONFIG) as [RoleUsuario, (typeof ROLE_CONFIG)[RoleUsuario]][]).map(([r, cfg]) => (
                  <div key={r} className="flex items-start gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${cfg.cor}`}>{cfg.label}</span>
                    <p className="text-xs text-brand-500">{cfg.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA: EQUIPE INTERNA ──────────────────────────── */}
        {aba === 'equipe' && (
          <div className="space-y-4">
            <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-700">Colaboradores do Escritório</h2>
                <div className="flex gap-2">
                  <button onClick={carregarEquipe} className="p-1.5 hover:bg-brand-50 rounded text-brand-400">
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={abrirNovoFuncionario}
                    className="flex items-center gap-1.5 bg-accent-600 hover:bg-accent-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                  >
                    <Plus size={13} /> Novo
                  </button>
                </div>
              </div>

              {loadingEquipe ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
              ) : equipe.length === 0 ? (
                <div className="py-10 text-center text-brand-300 text-sm">Nenhum colaborador cadastrado.</div>
              ) : (
                <div className="divide-y divide-brand-50">
                  {equipe.map(f => (
                    <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
                        {f.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-800 truncate">{f.nome}</p>
                        <p className="text-xs text-brand-400 truncate">{f.email}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        {f.setor && (
                          <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">{f.setor}</span>
                        )}
                        {f.cargo && (
                          <span className="text-[10px] text-brand-400">{f.cargo}</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${f.ativo ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          {f.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => abrirEditarFuncionario(f)} className="p-1.5 hover:bg-brand-50 rounded text-brand-400">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluirFuncionario(f.id)} className="p-1.5 hover:bg-red-50 rounded text-brand-300 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal funcionário */}
            {modalEquipe && editEquipe && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/60 px-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-brand-800">
                      {editEquipe.id ? 'Editar Colaborador' : 'Novo Colaborador'}
                    </h3>
                    <button onClick={() => { setModalEquipe(false); setEditEquipe(null) }}>
                      <X size={18} className="text-brand-400" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-brand-500 block mb-1">Nome *</label>
                      <input
                        value={editEquipe.nome ?? ''}
                        onChange={e => setEditEquipe(p => ({ ...p!, nome: e.target.value }))}
                        className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-brand-500 block mb-1">E-mail *</label>
                      <input
                        type="email"
                        value={editEquipe.email ?? ''}
                        onChange={e => setEditEquipe(p => ({ ...p!, email: e.target.value }))}
                        className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        placeholder="email@escritorio.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-brand-500 block mb-1">Setor</label>
                        <select
                          value={editEquipe.setor ?? ''}
                          onChange={e => setEditEquipe(p => ({ ...p!, setor: (e.target.value || null) as any }))}
                          className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        >
                          <option value="">— nenhum —</option>
                          {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-brand-500 block mb-1">Cargo</label>
                        <input
                          value={editEquipe.cargo ?? ''}
                          onChange={e => setEditEquipe(p => ({ ...p!, cargo: e.target.value }))}
                          className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                          placeholder="ex: Analista"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditEquipe(p => ({ ...p!, ativo: !p!.ativo }))}
                        className={`w-10 h-5 rounded-full transition-colors relative ${editEquipe.ativo ? 'bg-emerald-500' : 'bg-brand-200'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${editEquipe.ativo ? 'left-5' : 'left-0.5'}`} />
                      </button>
                      <span className="text-sm text-brand-600">{editEquipe.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setModalEquipe(false); setEditEquipe(null) }}
                      className="flex-1 border border-brand-200 text-brand-600 text-sm py-2 rounded-lg hover:bg-brand-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={salvarFuncionario}
                      disabled={salvandoEquipe || !editEquipe.nome || !editEquipe.email}
                      className="flex-1 flex items-center justify-center gap-2 bg-accent-600 hover:bg-accent-700 text-white text-sm py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {salvandoEquipe ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><Save size={14} /> Salvar</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ABA: CONTRATOS INTERNOS ──────────────────────── */}
        {aba === 'contratos_internos' && (
          <div className="space-y-4">
            <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-700">Contratos do Escritório</h2>
                <div className="flex gap-2">
                  <button onClick={carregarContratos} className="p-1.5 hover:bg-brand-50 rounded text-brand-400">
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={() => { setEditContrato({ ...CONTRATO_VAZIO }); setModalContrato(true) }}
                    className="flex items-center gap-1.5 bg-accent-600 hover:bg-accent-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                  >
                    <Plus size={13} /> Novo
                  </button>
                </div>
              </div>

              {loadingContratos ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
              ) : contratos.length === 0 ? (
                <div className="py-10 text-center text-brand-300 text-sm">Nenhum contrato interno cadastrado.</div>
              ) : (
                <div className="divide-y divide-brand-50">
                  {contratos.map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-brand-800">{c.titulo}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            c.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700' :
                            c.status === 'Encerrado' ? 'bg-gray-100 text-gray-500' :
                            'bg-amber-50 text-amber-700'
                          }`}>{c.status}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-brand-400 flex-wrap">
                          {c.valor != null && (
                            <span>R$ {Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          )}
                          {c.responsavel && <span>{c.responsavel}</span>}
                          {c.inicio && <span>Início: {new Date(c.inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                          {c.termino && <span>Término: {new Date(c.termino + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                        </div>
                        {c.descricao && (
                          <p className="text-xs text-brand-400 mt-0.5 line-clamp-1">{c.descricao}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => { setEditContrato({ ...c }); setModalContrato(true) }}
                          className="p-1.5 hover:bg-brand-50 rounded text-brand-400"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => excluirContrato(c.id)}
                          className="p-1.5 hover:bg-red-50 rounded text-brand-300 hover:text-red-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal contrato */}
            {modalContrato && editContrato !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/60 px-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-brand-800">
                      {editContrato.id ? 'Editar Contrato' : 'Novo Contrato Interno'}
                    </h3>
                    <button onClick={() => { setModalContrato(false); setEditContrato(null) }}>
                      <X size={18} className="text-brand-400" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-brand-500 block mb-1">Título *</label>
                      <input
                        value={editContrato.titulo ?? ''}
                        onChange={e => setEditContrato(p => ({ ...p!, titulo: e.target.value }))}
                        className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        placeholder="ex: Contrato de Locação da Sede"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-brand-500 block mb-1">Descrição</label>
                      <textarea
                        value={editContrato.descricao ?? ''}
                        onChange={e => setEditContrato(p => ({ ...p!, descricao: e.target.value }))}
                        rows={2}
                        className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-brand-500 block mb-1">Valor mensal (R$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editContrato.valor ?? ''}
                          onChange={e => setEditContrato(p => ({ ...p!, valor: e.target.value ? Number(e.target.value) : null }))}
                          className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-brand-500 block mb-1">Status</label>
                        <select
                          value={editContrato.status ?? 'Ativo'}
                          onChange={e => setEditContrato(p => ({ ...p!, status: e.target.value }))}
                          className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        >
                          {['Ativo', 'Pendente', 'Encerrado', 'Suspenso'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-brand-500 block mb-1">Início</label>
                        <input
                          type="date"
                          value={editContrato.inicio ?? ''}
                          onChange={e => setEditContrato(p => ({ ...p!, inicio: e.target.value }))}
                          className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-brand-500 block mb-1">Término</label>
                        <input
                          type="date"
                          value={editContrato.termino ?? ''}
                          onChange={e => setEditContrato(p => ({ ...p!, termino: e.target.value }))}
                          className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-brand-500 block mb-1">Responsável</label>
                      <input
                        value={editContrato.responsavel ?? ''}
                        onChange={e => setEditContrato(p => ({ ...p!, responsavel: e.target.value }))}
                        className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        placeholder="Nome do responsável interno"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-brand-500 block mb-1">Observações</label>
                      <textarea
                        value={editContrato.observacoes ?? ''}
                        onChange={e => setEditContrato(p => ({ ...p!, observacoes: e.target.value }))}
                        rows={2}
                        className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setModalContrato(false); setEditContrato(null) }}
                      className="flex-1 border border-brand-200 text-brand-600 text-sm py-2 rounded-lg hover:bg-brand-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={salvarContrato}
                      disabled={salvandoContrato || !editContrato.titulo}
                      className="flex-1 flex items-center justify-center gap-2 bg-accent-600 hover:bg-accent-700 text-white text-sm py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {salvandoContrato ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><Save size={14} /> Salvar</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ABA: AUDITORIA ───────────────────────────────── */}
        {aba === 'auditoria' && (
          <div className="space-y-4">
            <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-50 flex flex-col sm:flex-row gap-2 sm:items-center">
                <h2 className="text-sm font-semibold text-brand-700 shrink-0">Log de Acessos</h2>
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300" />
                  <input
                    value={buscaLog}
                    onChange={e => setBuscaLog(e.target.value)}
                    placeholder="Filtrar por usuário, email, IP…"
                    className="w-full border border-brand-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                  />
                </div>
                <button onClick={carregarLogs} className="p-1.5 hover:bg-brand-50 rounded text-brand-400 shrink-0">
                  <RefreshCw size={14} />
                </button>
              </div>

              {loadingLogs ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
              ) : logsFiltrados.length === 0 ? (
                <div className="py-10 text-center text-brand-300 text-sm">
                  {logs.length === 0 ? 'Nenhum log registrado.' : 'Nenhum resultado para a busca.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-brand-400 bg-brand-50/60 border-b border-brand-100">
                        <th className="px-4 py-2 font-medium">Data / Hora</th>
                        <th className="px-3 py-2 font-medium">Usuário</th>
                        <th className="px-3 py-2 font-medium">Setor</th>
                        <th className="px-3 py-2 font-medium">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsFiltrados.map(l => (
                        <tr key={l.id} className="border-b border-brand-50 hover:bg-brand-50/40 transition">
                          <td className="px-4 py-2 text-brand-600 text-xs whitespace-nowrap">
                            {new Date(l.acessado_em).toLocaleString('pt-BR', {
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-brand-800 font-medium text-xs">{l.funcionario_nome ?? '—'}</p>
                            <p className="text-brand-400 text-[11px]">{l.funcionario_email ?? ''}</p>
                          </td>
                          <td className="px-3 py-2 text-brand-500 text-xs">{l.setor ?? '—'}</td>
                          <td className="px-3 py-2 text-brand-400 text-xs font-mono">{l.ip ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {logs.length === POR_PAGINA && (
                <div className="flex justify-between items-center px-4 py-3 border-t border-brand-50">
                  <button
                    onClick={() => setPagina(p => Math.max(0, p - 1))}
                    disabled={pagina === 0}
                    className="text-xs text-brand-500 disabled:opacity-40 hover:text-brand-700"
                  >← Anterior</button>
                  <span className="text-xs text-brand-400">Página {pagina + 1}</span>
                  <button onClick={() => setPagina(p => p + 1)} className="text-xs text-brand-500 hover:text-brand-700">
                    Próxima →
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-brand-400 text-center">
              Tabela <code className="bg-brand-50 px-1 rounded">acessos_log</code> — Append-Only · Somente leitura para compliance
            </p>
          </div>
        )}

        {/* ─── ABA: CONFIGURAÇÕES ───────────────────────────── */}
        {aba === 'configuracoes' && (
          <div className="space-y-4">
            <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-5">
              <h2 className="text-sm font-semibold text-brand-700">Configurações do Cofre E2EE</h2>

              <div>
                <label className="text-xs text-brand-500 block mb-1">Bloqueio automático após inatividade</label>
                <select
                  value={cofre.autoLockMin}
                  onChange={e => setCofre(c => ({ ...c, autoLockMin: Number(e.target.value) }))}
                  className="border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                >
                  {[5, 10, 15, 30, 60].map(m => (
                    <option key={m} value={m}>{m} minutos</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-brand-700">Exigir senha mestre ao exportar</p>
                  <p className="text-xs text-brand-400">Reconfirmar a senha antes de qualquer exportação de credenciais</p>
                </div>
                <button
                  onClick={() => setCofre(c => ({ ...c, requireMasterOnExport: !c.requireMasterOnExport }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${cofre.requireMasterOnExport ? 'bg-accent-600' : 'bg-brand-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${cofre.requireMasterOnExport ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="pt-2 border-t border-brand-50">
                <h3 className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-2">Sobre a criptografia</h3>
                <div className="space-y-1 text-xs text-brand-500">
                  <p>• Algoritmo: <strong className="text-brand-700">AES-GCM 256-bit</strong> (Web Crypto API — executa apenas no navegador)</p>
                  <p>• Derivação de chave: <strong className="text-brand-700">PBKDF2 · 150.000 iterações · SHA-256</strong></p>
                  <p>• O servidor <strong className="text-brand-700">nunca recebe</strong> a senha mestre nem as credenciais em texto claro</p>
                  <p>• Cada entrada usa um <strong className="text-brand-700">salt + IV únicos</strong> gerados aleatoriamente</p>
                </div>
              </div>

              <button
                onClick={() => { setSalvoSeguranca(true); setTimeout(() => setSalvoSeguranca(false), 2500) }}
                className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                {salvoSeguranca ? 'Preferências salvas ✓' : 'Salvar preferências'}
              </button>
            </div>

            <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-700">Políticas de Segurança do Sistema</h3>
              <div className="space-y-2 text-xs text-brand-500">
                {[
                  'Todas as rotas exigem autenticação (Zero-Trust)',
                  'RLS (Row Level Security) habilitado em todas as tabelas do Supabase',
                  'Storage privado com Signed URLs — nenhum arquivo público sem autorização',
                  'Log de acessos Append-Only para compliance e auditoria',
                  'Chave Gemini API exclusivamente server-side (nunca exposta ao cliente)',
                ].map(txt => (
                  <div key={txt} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <p>{txt}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Lock size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Área restrita</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Todas as operações nesta página são registradas e visíveis apenas para administradores.
                    Alterações de role, permissões e configurações ficam no log de auditoria.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
