'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BroadcastNoticeModal from '@/components/admin/BroadcastNoticeModal'
import SmartUploadPanel from '@/components/documents/SmartUploadPanel'
import type { PermissoesModulos, RoleUsuario } from '@/types/database.types'
import {
  LayoutDashboard, CheckSquare, Users, FileText, BarChart2,
  Repeat, Truck, Lock, Bell, ChevronLeft, ChevronRight,
  Menu, X, Building2, Scale, CalendarCheck, Paperclip,
  Landmark, UserCheck, ShieldCheck, LogOut, Camera, ChevronDown, BadgeCheck,
} from 'lucide-react'

// ─── Nav items com gate de módulo ─────────────────────────────

type ModuloGate = keyof PermissoesModulos | null // null = sempre visível para admin

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  modulo: ModuloGate
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',           label: 'Dashboard',       icon: LayoutDashboard, modulo: null },
  { href: '/tarefas',             label: 'Tarefas',         icon: CheckSquare,     modulo: null },
  { href: '/clientes',            label: 'Clientes',        icon: Users,           modulo: 'modulo_contabil' },
  { href: '/controle-mensal',     label: 'Controle Mensal', icon: CalendarCheck,   modulo: 'modulo_contabil' },
  { href: '/rotinas',             label: 'Rotinas',         icon: Repeat,          modulo: null },
  { href: '/officeboy',           label: 'Office Boy',      icon: Truck,           modulo: null },
  { href: '/cofre',               label: 'Cofre de Senhas', icon: Lock,            modulo: null },
  { href: '/legalizacao',         label: 'Legalização',     icon: FileText,        modulo: 'modulo_societario' },
  { href: '/gerencial',           label: 'Gerencial',       icon: BarChart2,       modulo: 'modulo_financeiro' },
  { href: '/parcelamentos',       label: 'Parcelamentos',   icon: Landmark,        modulo: 'modulo_fiscal' },
  { href: '/inss-pf',             label: 'INSS PF',         icon: UserCheck,       modulo: 'modulo_fiscal' },
  { href: '/radar-juridico',      label: 'Radar Jurídico',  icon: Scale,           modulo: null },
  { href: '/certificado-digital', label: 'Cert. Digital',   icon: BadgeCheck,      modulo: 'modulo_societario' },
]

// Itens da bottom nav mobile (sempre visíveis)
const BOTTOM_NAV: Omit<NavItem, 'modulo'>[] = [
  { href: '/dashboard', label: 'Início',   icon: LayoutDashboard },
  { href: '/tarefas',   label: 'Tarefas',  icon: CheckSquare },
  { href: '/clientes',  label: 'Clientes', icon: Users },
  { href: '/rotinas',   label: 'Rotinas',  icon: Repeat },
  { href: '/cofre',     label: 'Cofre',    icon: Lock },
]

interface ShellProps {
  children: React.ReactNode
  userEmail?: string
  userInitials?: string
}

function fmtAcesso(ts: string | null | undefined): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function Shell({ children, userEmail, userInitials = 'U' }: ShellProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [uploadOpen, setUploadOpen]     = useState(false)
  const [role, setRole]                 = useState<RoleUsuario | null>(null)
  const [permissoes, setPermissoes]     = useState<PermissoesModulos | null>(null)
  const [ultimoAcesso, setUltimoAcesso] = useState<string | null>(null)
  const [initials, setInitials]         = useState(userInitials)
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail]               = useState(userEmail ?? '')
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [userId, setUserId]             = useState<string | null>(null)
  const [setor, setSetor]               = useState<string | null>(null)
  const [deptAberto, setDeptAberto]     = useState(false)
  const [perfilOpen, setPerfilOpen]     = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [bellOpen, setBellOpen]         = useState(false)
  const [headerUserOpen, setHeaderUserOpen] = useState(false)
  const [notifs, setNotifs]             = useState<{ id: string; mensagem: string; created_at: string; lido: boolean }[]>([])

  const DEPARTAMENTOS = [
    { slug: 'pessoal',               label: 'Pessoal' },
    { slug: 'fiscal',                label: 'Fiscal' },
    { slug: 'contabil',              label: 'Contábil' },
    { slug: 'societario',            label: 'Societário' },
    { slug: 'financeiro',            label: 'Financeiro' },
    { slug: 'certificado-digital',   label: 'Certificado Digital' },
  ]

  useEffect(() => {
    async function init() {
      try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      // Auth email é sempre a fonte correta — nunca usar o email da tabela de perfil
      setEmail(user.email ?? '')

      const { data: p } = await (supabase.from('perfis_usuarios') as any)
        .select('role, permissoes_modulos, nome, ultimo_acesso, avatar_url, setor')
        .eq('id', user.id)
        .single()

      if (!p) return
      setRole(p.role as RoleUsuario)
      setPermissoes(p.permissoes_modulos ?? null)
      setUltimoAcesso(p.ultimo_acesso ?? null)
      if (p.nome)       { setNomeCompleto(p.nome); setInitials(p.nome.charAt(0).toUpperCase()) }
      if (p.avatar_url) setAvatarUrl(p.avatar_url)
      if (p.setor)      setSetor(p.setor)

      // Abre dept do setor atual automaticamente
      if (p.setor) setDeptAberto(true)

      await (supabase.from('perfis_usuarios') as any)
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', user.id)
      } catch (err) {
        console.error('[Shell] init error:', err)
      }
    }
    init()

    // Busca notificações do usuário
    async function fetchNotifs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await (supabase.from('notificacoes') as any)
        .select('id, mensagem, created_at, lido')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setNotifs(data)
    }
    fetchNotifs()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${userId}.${ext}`
      await supabase.storage.from('documentos').upload(path, file, { upsert: true })
      const { data: signed } = await supabase.storage.from('documentos').createSignedUrl(path, 60 * 60 * 24 * 365)
      const url = signed?.signedUrl ?? null
      if (url) {
        await (supabase.from('perfis_usuarios') as any).update({ avatar_url: url }).eq('id', userId)
        setAvatarUrl(url)
      }
    } finally {
      setUploadingAvatar(false)
    }
  }

  // Filtra nav baseado em role + permissões
  const navFiltrado = NAV_ITEMS.filter(item => {
    if (role === 'admin') return true          // admin vê tudo
    if (!item.modulo) return true              // sem gate = sempre visível
    if (!permissoes) return false              // sem permissões = esconde
    return permissoes[item.modulo] === true
  })

  return (
    <div className="flex h-screen overflow-hidden bg-brand-100">
      {/* ── Overlay mobile ──────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-brand-950/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-brand-900 text-white',
          'transition-all duration-300 shadow-sidebar',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
        ].join(' ')}
      >
        {/* Logo + perfil */}
        <div className="border-b border-brand-800">
          {/* Logo */}
          <div className="flex h-14 items-center gap-3 px-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent-500 flex items-center justify-center font-bold text-brand-900 text-xs">
              N
            </div>
            {!collapsed && (
              <span className="font-semibold text-sm leading-tight">
                Nascente<span className="text-brand-400 font-normal"> Contábil</span>
              </span>
            )}
            <button
              className="ml-auto lg:hidden text-brand-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Perfil compacto */}
          <div className="px-3 pb-3">
            <button
              onClick={() => setPerfilOpen(o => !o)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-brand-800 transition-colors text-left"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-brand-700" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center text-xs font-bold text-white">
                    {initials}
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{nomeCompleto || email}</p>
                    <p className="text-[10px] text-brand-500 truncate">{setor ?? (role === 'admin' ? 'Administrador' : '')}</p>
                  </div>
                  <ChevronDown size={12} className={`text-brand-500 transition-transform ${perfilOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {/* Menu de perfil expandido */}
            {perfilOpen && !collapsed && (
              <div className="mt-1 bg-brand-950/60 rounded-xl overflow-hidden">
                <label className="flex items-center gap-2 px-3 py-2 text-xs text-brand-300 hover:text-white hover:bg-brand-800 transition-colors cursor-pointer">
                  <Camera size={13} />
                  <span>{uploadingAvatar ? 'Enviando…' : 'Alterar foto'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
                <Link
                  href="/perfil"
                  onClick={() => { setMobileOpen(false); setPerfilOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-brand-300 hover:text-white hover:bg-brand-800 transition-colors"
                >
                  <Building2 size={13} /> Meu perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:text-rose-200 hover:bg-rose-900/30 transition-colors"
                >
                  <LogOut size={13} /> Sair do sistema
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Nav + Departamentos integrados */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navFiltrado.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-400 hover:bg-brand-800 hover:text-white',
                ].join(' ')}
                title={collapsed ? label : undefined}
              >
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}

          {/* Divisor */}
          {!collapsed && <div className="mx-3 my-1 border-t border-brand-800" />}

          {/* Departamentos como item de nav com sub-menu */}
          <div>
            <button
              onClick={() => setDeptAberto(o => !o)}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                pathname.startsWith('/departamentos')
                  ? 'bg-brand-700 text-white'
                  : 'text-brand-400 hover:bg-brand-800 hover:text-white',
              ].join(' ')}
              title={collapsed ? 'Departamentos' : undefined}
            >
              <Building2 size={17} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Departamentos</span>
                  <ChevronDown size={13} className={`transition-transform duration-200 ${deptAberto ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {deptAberto && !collapsed && (
              <div className="mt-0.5 ml-3 pl-3 border-l border-brand-700 space-y-0.5 pb-1">
                {DEPARTAMENTOS.map(({ slug, label }) => {
                  const href = `/departamentos/${slug}`
                  const active = pathname === href
                  return (
                    <Link
                      key={slug}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                        active
                          ? 'text-white bg-brand-700'
                          : 'text-brand-400 hover:text-white hover:bg-brand-800',
                      ].join(' ')}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" />
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Botão Administração — só admin */}
        {role === 'admin' && (
          <div className="px-2 pb-2">
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border',
                pathname.startsWith('/admin')
                  ? 'bg-rose-900 border-rose-700 text-rose-100'
                  : 'border-rose-900/50 text-rose-400 hover:bg-rose-900/40 hover:text-rose-200',
              ].join(' ')}
              title={collapsed ? 'Administração' : undefined}
            >
              <ShieldCheck size={18} className="flex-shrink-0" />
              {!collapsed && <span>Administração</span>}
            </Link>
          </div>
        )}

        {/* Rodapé: logout (collapsed) + recolher */}
        <div className="border-t border-brand-800 p-2 space-y-1">
          {collapsed && (
            <button
              onClick={handleLogout}
              title="Sair"
              className="w-full flex items-center justify-center p-2 rounded-lg text-rose-400 hover:bg-rose-900/30 hover:text-rose-200 transition-colors"
            >
              <LogOut size={16} />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-brand-400 hover:bg-brand-800 hover:text-white text-xs transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Recolher</span></>}
          </button>
        </div>
      </aside>

      {/* ── Conteúdo principal ──────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center gap-3 px-4 bg-white border-b border-brand-200 shadow-sm flex-shrink-0">
          <button
            className="lg:hidden text-brand-600 hover:text-brand-900"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="flex-1" />

          {/* Último acesso no header */}
          {ultimoAcesso && (
            <p className="hidden md:block text-xs text-brand-400">
              Último acesso: <span className="text-brand-600 font-medium">{fmtAcesso(ultimoAcesso)}</span>
            </p>
          )}

          {/* Upload Inteligente */}
          <button
            onClick={() => setUploadOpen(true)}
            title="Upload Inteligente"
            className="relative p-2 rounded-lg text-brand-500 hover:bg-brand-100 hover:text-brand-900 transition-colors"
          >
            <Paperclip size={20} />
          </button>

          {/* Notificações */}
          <div
            className="relative"
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setBellOpen(false) }}
          >
            <button
              onClick={() => setBellOpen(v => !v)}
              className="relative p-2 rounded-lg text-brand-500 hover:bg-brand-100 hover:text-brand-900 transition-colors"
            >
              <Bell size={20} />
              {notifs.some(n => !n.lido) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500" />
              )}
            </button>
            {bellOpen && (
              <div
                tabIndex={-1}
                className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-brand-100 z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-brand-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-brand-800">Notificações</span>
                  {notifs.some(n => !n.lido) && (
                    <span className="text-xs bg-accent-100 text-accent-700 px-2 py-0.5 rounded-full font-medium">
                      {notifs.filter(n => !n.lido).length} novas
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-brand-50">
                  {notifs.length === 0 ? (
                    <p className="text-xs text-brand-400 text-center py-6">Nenhuma notificação</p>
                  ) : notifs.map(n => (
                    <div key={n.id} className={['px-4 py-3 text-sm', !n.lido ? 'bg-accent-50' : ''].join(' ')}>
                      <p className={['text-brand-800', !n.lido ? 'font-medium' : ''].join(' ')}>{n.mensagem}</p>
                      <p className="text-xs text-brand-400 mt-0.5">
                        {new Date(n.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  className="sr-only"
                  onClick={() => setBellOpen(false)}
                >fechar</button>
              </div>
            )}
          </div>

          {/* Avatar do header */}
          <div
            className="relative"
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setHeaderUserOpen(false) }}
          >
            <button
              onClick={() => setHeaderUserOpen(v => !v)}
              className="flex items-center gap-1 rounded-xl hover:bg-brand-100 p-1 transition-colors"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-brand-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-900 flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
              )}
              <ChevronDown size={14} className="text-brand-400" />
            </button>
            {headerUserOpen && (
              <div
                tabIndex={-1}
                className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-brand-100 z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-brand-100">
                  <p className="text-sm font-semibold text-brand-800 truncate">{nomeCompleto || 'Meu perfil'}</p>
                  <p className="text-xs text-brand-400 truncate">{email}</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/perfil"
                    onClick={() => setHeaderUserOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-brand-700 hover:bg-brand-50 transition-colors"
                  >
                    <Camera size={15} className="text-brand-400" />
                    Meu Perfil
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut size={15} />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Área de conteúdo */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── Modal de recados obrigatórios ───────────────────── */}
      <BroadcastNoticeModal />

      {/* ── Upload Inteligente (painel global) ──────────────── */}
      <SmartUploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* ── Bottom Navigation (mobile) ───────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-20 flex lg:hidden bg-white border-t border-brand-200 h-16">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-brand-900' : 'text-brand-400',
              ].join(' ')}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
