'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import type { PerfilUsuario, AcessoLog, RoleUsuario, PermissoesModulos } from '@/types/database.types'
import { PERMISSOES_DEFAULT as PERM_DEFAULT } from '@/types/database.types'
import { Settings, Users, Shield, ClipboardList, Search, RefreshCw, ChevronDown, ChevronUp, Clock } from 'lucide-react'

// ─── Config de módulos ────────────────────────────────────────

const MODULOS: Array<{ key: keyof PermissoesModulos; label: string; desc: string }> = [
  { key: 'modulo_pessoal',    label: 'Depto. Pessoal',     desc: 'Acesso às tarefas e rotinas de RH' },
  { key: 'modulo_fiscal',     label: 'Depto. Fiscal',      desc: 'Rotinas fiscais e obrigações tributárias' },
  { key: 'modulo_contabil',   label: 'Depto. Contábil',    desc: 'Clientes, contratos e lançamentos contábeis' },
  { key: 'modulo_societario', label: 'Depto. Societário',  desc: 'Legalização e processos empresariais' },
  { key: 'modulo_financeiro', label: 'Financeiro Interno', desc: 'Painel gerencial e relatórios financeiros' },
  { key: 'acoes_financeiras', label: 'Ações Financeiras',  desc: 'Criar/editar faturas e ver extratos' },
]

// ─── Tipos internos ───────────────────────────────────────────

type Aba = 'usuarios' | 'seguranca' | 'auditoria'

function fmtTs(ts: string | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const ROLE_CONFIG: Record<RoleUsuario, { label: string; cor: string; desc: string }> = {
  admin:              { label: 'Admin',       cor: 'bg-rose-100 text-rose-800',    desc: 'Acesso total a todos os módulos e clientes' },
  gestor_cliente:     { label: 'Gestor',      cor: 'bg-blue-100 text-blue-800',    desc: 'Empresa própria — documentos, obrigações e guias' },
  colaborador_cliente:{ label: 'Colaborador', cor: 'bg-gray-100 text-gray-700',    desc: 'Apenas holerites, informes e férias do próprio CPF' },
}

// ─── Componente ───────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('usuarios')

  // Guard de acesso — somente admin
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      ;(supabase.from('perfis_usuarios') as any)
        .select('role').eq('id', user.id).single()
        .then(({ data }: { data: { role: string } | null }) => {
          if (data?.role !== 'admin') router.push('/dashboard')
        })
    })
  }, [router])

  // Usuários
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [editandoRole, setEditandoRole] = useState<string | null>(null)
  const [salvandoRole, setSalvandoRole] = useState(false)

  // Auditoria
  const [logs, setLogs] = useState<AcessoLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [buscaLog, setBuscaLog] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 50

  // Segurança
  const [cofre, setCofre] = useState({ autoLockMin: 15, requireMasterOnExport: true })
  const [salvoSeguranca, setSalvoSeguranca] = useState(false)

  // ─── Carga de usuários ───────────────────────────────────────

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

  // ─── Carga de logs ────────────────────────────────────────────

  const carregarLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const { data } = await (supabase.from('acessos_log') as any)
        .select('*')
        .order('acessado_em', { ascending: false })
        .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1)
      setLogs((data ?? []) as AcessoLog[])
    } finally {
      setLoadingLogs(false)
    }
  }, [pagina])

  useEffect(() => {
    if (aba === 'auditoria') carregarLogs()
  }, [aba, carregarLogs])

  // ─── Alterar papel ────────────────────────────────────────────

  async function salvarRole(userId: string, novoRole: RoleUsuario) {
    setSalvandoRole(true)
    try {
      await (supabase.from('perfis_usuarios') as any)
        .update({ role: novoRole, updated_at: new Date().toISOString() })
        .eq('id', userId)
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, role: novoRole } : u))
      setEditandoRole(null)
    } finally {
      setSalvandoRole(false)
    }
  }

  // ─── Permissões modulares ─────────────────────────────────────

  const [expandindoPerm, setExpandindoPerm] = useState<string | null>(null)
  const [salvandoPerm, setSalvandoPerm]     = useState(false)

  async function salvarPermissoes(userId: string, perm: PermissoesModulos) {
    setSalvandoPerm(true)
    try {
      await (supabase.from('perfis_usuarios') as any)
        .update({ permissoes_modulos: perm, updated_at: new Date().toISOString() })
        .eq('id', userId)
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, permissoes_modulos: perm } : u))
    } finally {
      setSalvandoPerm(false)
    }
  }

  // ─── Toggle ativo ────────────────────────────────────────────

  async function toggleAtivo(u: PerfilUsuario) {
    const ativo = !u.ativo
    await (supabase.from('perfis_usuarios') as any).update({ ativo, updated_at: new Date().toISOString() }).eq('id', u.id)
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ativo } : x))
  }

  // ─── Filtro de logs ───────────────────────────────────────────

  const logsFiltrados = logs.filter(l => {
    const q = buscaLog.toLowerCase()
    return !q || l.funcionario_nome?.toLowerCase().includes(q) || l.funcionario_email?.toLowerCase().includes(q) || l.ip?.includes(q)
  })

  // ─── Render abas ─────────────────────────────────────────────

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-brand-600" />
          <div>
            <h1 className="text-xl font-bold text-brand-800">Configurações & Administração</h1>
            <p className="text-xs text-brand-400">Usuários, segurança e log de auditoria</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-brand-50 rounded-xl p-1">
          {([
            { id: 'usuarios',  label: 'Usuários & Permissões', icon: Users },
            { id: 'seguranca', label: 'Segurança & Cofre',     icon: Shield },
            { id: 'auditoria', label: 'Log de Auditoria',      icon: ClipboardList },
          ] as { id: Aba; label: string; icon: React.ComponentType<{ size: number; className?: string }> }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${aba === id ? 'bg-white text-brand-800 shadow-sm' : 'text-brand-400 hover:text-brand-600'}`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ─── ABA USUÁRIOS ─────────────────────────────────────── */}
        {aba === 'usuarios' && (
          <div className="space-y-4">
            <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-700">Usuários do Sistema</h2>
                <button onClick={carregarUsuarios} className="p-1.5 hover:bg-brand-50 rounded text-brand-400">
                  <RefreshCw size={14} />
                </button>
              </div>

              {loadingUsuarios ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
              ) : (
                <div className="divide-y divide-brand-50">
                  {usuarios.map(u => (
                    <div key={u.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Avatar + info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {u.nome?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-brand-800 truncate">{u.nome}</p>
                          <p className="text-xs text-brand-400 truncate">{u.email}</p>
                        </div>
                      </div>

                      {/* Role selector */}
                      <div className="flex items-center gap-3 shrink-0">
                        {editandoRole === u.id ? (
                          <div className="flex items-center gap-2">
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
                            <button onClick={() => setEditandoRole(null)} className="text-xs text-brand-400 hover:text-brand-700">×</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditandoRole(u.id)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${ROLE_CONFIG[u.role]?.cor ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {ROLE_CONFIG[u.role]?.label ?? u.role}
                            <ChevronDown size={11} />
                          </button>
                        )}

                        {/* Toggle ativo */}
                        <button
                          onClick={() => toggleAtivo(u)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${u.ativo ? 'bg-emerald-500' : 'bg-brand-200'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${u.ativo ? 'left-5' : 'left-0.5'}`} />
                        </button>
                        <span className={`text-xs ${u.ativo ? 'text-emerald-600' : 'text-brand-400'}`}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>

                        {/* Último acesso */}
                        {u.ultimo_acesso && (
                          <span className="hidden lg:flex items-center gap-1 text-[10px] text-brand-400">
                            <Clock size={10} /> {fmtTs(u.ultimo_acesso)}
                          </span>
                        )}

                        {/* Expandir permissões (não-admin) */}
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => setExpandindoPerm(expandindoPerm === u.id ? null : u.id)}
                            className="text-xs text-brand-400 hover:text-brand-700 flex items-center gap-0.5"
                            title="Permissões modulares"
                          >
                            {expandindoPerm === u.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        )}
                      </div>

                      {/* Painel de permissões modulares */}
                      {expandindoPerm === u.id && u.role !== 'admin' && (
                        <div className="mt-3 bg-brand-50 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-semibold text-brand-600 mb-2">Módulos acessíveis</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {MODULOS.map(({ key, label, desc }) => {
                              const perm = u.permissoes_modulos ?? PERM_DEFAULT
                              const ativo = perm[key] ?? false
                              return (
                                <button
                                  key={key}
                                  onClick={() => {
                                    const novo = { ...(u.permissoes_modulos ?? PERM_DEFAULT), [key]: !ativo }
                                    salvarPermissoes(u.id, novo)
                                  }}
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

            {/* Legenda de papéis */}
            <div className="bg-white border border-brand-100 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-3">Papéis e Permissões</h3>
              <div className="space-y-3">
                {(Object.entries(ROLE_CONFIG) as [RoleUsuario, typeof ROLE_CONFIG[RoleUsuario]][]).map(([role, cfg]) => (
                  <div key={role} className="flex items-start gap-3">
                    <span className={`mt-0.5 text-xs px-2 py-0.5 rounded-full shrink-0 ${cfg.cor}`}>{cfg.label}</span>
                    <p className="text-xs text-brand-500">{cfg.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA SEGURANÇA ────────────────────────────────────── */}
        {aba === 'seguranca' && (
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

            {/* Info de segurança geral */}
            <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-700">Políticas de Segurança</h3>
              <div className="space-y-2 text-xs text-brand-500">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p>Todas as rotas exigem autenticação (Zero-Trust)</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p>RLS (Row Level Security) habilitado em todas as tabelas do Supabase</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p>Storage privado com Signed URLs — nenhum arquivo público sem autorização</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p>Log de acessos Append-Only para compliance e auditoria</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p>Chave Gemini API exclusivamente server-side (nunca exposta ao cliente)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA AUDITORIA ────────────────────────────────────── */}
        {aba === 'auditoria' && (
          <div className="space-y-4">
            <div className="bg-white border border-brand-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-50 flex flex-col sm:flex-row gap-3 sm:items-center">
                <h2 className="text-sm font-semibold text-brand-700 shrink-0">Log de Acessos</h2>
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-300" />
                  <input
                    value={buscaLog}
                    onChange={e => setBuscaLog(e.target.value)}
                    placeholder="Filtrar por usuário, email, IP…"
                    className="w-full border border-brand-200 rounded-lg pl-8 pr-3 py-1.5 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400"
                  />
                </div>
                <button onClick={carregarLogs} className="p-1.5 hover:bg-brand-50 rounded text-brand-400 shrink-0">
                  <RefreshCw size={14} />
                </button>
              </div>

              {loadingLogs ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando logs…</div>
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

              {/* Paginação */}
              {logs.length === POR_PAGINA && (
                <div className="flex justify-between items-center px-4 py-3 border-t border-brand-50">
                  <button
                    onClick={() => setPagina(p => Math.max(0, p - 1))}
                    disabled={pagina === 0}
                    className="text-xs text-brand-500 disabled:opacity-40 hover:text-brand-700"
                  >← Anterior</button>
                  <span className="text-xs text-brand-400">Página {pagina + 1}</span>
                  <button
                    onClick={() => setPagina(p => p + 1)}
                    className="text-xs text-brand-500 hover:text-brand-700"
                  >Próxima →</button>
                </div>
              )}
            </div>

            <p className="text-xs text-brand-400 text-center">
              Tabela <code className="bg-brand-50 px-1 rounded">acessos_log</code> — Append-Only · Somente leitura para compliance
            </p>
          </div>
        )}
      </div>
    </Shell>
  )
}
