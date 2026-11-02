'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BroadcastNoticeModal from '@/components/admin/BroadcastNoticeModal'
import type { PermissoesModulos, RoleUsuario } from '@/types/database.types'
import {
  LayoutDashboard, CheckSquare, Users, FileText, BarChart2,
  Repeat, Truck, Lock, Settings, Bell, ChevronLeft, ChevronRight,
  Menu, X, Building2, Scale,
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
  { href: '/dashboard',     label: 'Dashboard',       icon: LayoutDashboard, modulo: null },
  { href: '/tarefas',       label: 'Tarefas',          icon: CheckSquare,     modulo: null },
  { href: '/clientes',      label: 'Clientes',         icon: Users,           modulo: 'modulo_contabil' },
  { href: '/processos',     label: 'Legalização',      icon: FileText,        modulo: 'modulo_societario' },
  { href: '/gerencial',     label: 'Gerencial',        icon: BarChart2,       modulo: 'modulo_financeiro' },
  { href: '/rotinas',       label: 'Rotinas',          icon: Repeat,          modulo: 'modulo_fiscal' },
  { href: '/officeboy',     label: 'Office Boy',       icon: Truck,           modulo: 'modulo_pessoal' },
  { href: '/cofre',         label: 'Cofre de Senhas',  icon: Lock,            modulo: null },
  { href: '/radar-juridico', label: 'Radar Jurídico',  icon: Scale,           modulo: null },
  { href: '/configuracoes', label: 'Configurações',    icon: Settings,        modulo: null },
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
  const [collapsed, setCollapsed]     = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [role, setRole]               = useState<RoleUsuario | null>(null)
  const [permissoes, setPermissoes]   = useState<PermissoesModulos | null>(null)
  const [ultimoAcesso, setUltimoAcesso] = useState<string | null>(null)
  const [initials, setInitials]       = useState(userInitials)
  const [email, setEmail]             = useState(userEmail ?? '')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Registra acesso e busca perfil
      const { data: p } = await (supabase.from('perfis_usuarios') as any)
        .select('role, permissoes_modulos, nome, email, ultimo_acesso')
        .eq('id', user.id)
        .single()

      if (!p) return
      setRole(p.role as RoleUsuario)
      setPermissoes(p.permissoes_modulos ?? null)
      setUltimoAcesso(p.ultimo_acesso ?? null)
      if (p.nome)  setInitials(p.nome.charAt(0).toUpperCase())
      if (p.email) setEmail(p.email)

      // Atualiza último acesso (fire-and-forget)
      await (supabase.from('perfis_usuarios') as any)
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', user.id)
    }
    init()
  }, [])

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
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-brand-800">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center font-bold text-brand-900 text-sm">
            N
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm leading-tight">
              Nascente<br />
              <span className="text-brand-400 font-normal">Contábil</span>
            </span>
          )}
          <button
            className="ml-auto lg:hidden text-brand-400 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav filtrado por permissões */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
          {navFiltrado.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-800 text-white'
                    : 'text-brand-400 hover:bg-brand-800 hover:text-white',
                ].join(' ')}
                title={collapsed ? label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}

          {/* Departamentos (visível para admin) */}
          {role === 'admin' && !collapsed && (
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider mb-1">Departamentos</p>
              {[
                { slug: 'pessoal',    label: 'Pessoal' },
                { slug: 'fiscal',     label: 'Fiscal' },
                { slug: 'contabil',   label: 'Contábil' },
                { slug: 'societario', label: 'Societário' },
                { slug: 'financeiro', label: 'Financeiro' },
              ].map(({ slug, label }) => {
                const href = `/departamentos/${slug}`
                const active = pathname === href
                return (
                  <Link
                    key={slug}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      active ? 'bg-brand-800 text-white' : 'text-brand-500 hover:bg-brand-800 hover:text-white',
                    ].join(' ')}
                  >
                    <Building2 size={13} className="flex-shrink-0" /> {label}
                  </Link>
                )
              })}
            </div>
          )}
        </nav>

        {/* Perfil + colapsar */}
        <div className="border-t border-brand-800 p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-brand-400 truncate">{email}</p>
                {ultimoAcesso && (
                  <p className="text-[10px] text-brand-600 truncate">Acesso ant.: {fmtAcesso(ultimoAcesso)}</p>
                )}
              </div>
            </div>
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

          {/* Notificações */}
          <button className="relative p-2 rounded-lg text-brand-500 hover:bg-brand-100 hover:text-brand-900 transition-colors">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500" />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-brand-900 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
        </header>

        {/* Área de conteúdo */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── Modal de recados obrigatórios ───────────────────── */}
      <BroadcastNoticeModal />

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
