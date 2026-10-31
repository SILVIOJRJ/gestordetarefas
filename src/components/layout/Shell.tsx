'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  FileText,
  BarChart2,
  Repeat,
  Truck,
  Lock,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/tarefas',      label: 'Tarefas',         icon: CheckSquare },
  { href: '/clientes',     label: 'Clientes',        icon: Users },
  { href: '/processos',    label: 'Legalização',     icon: FileText },
  { href: '/gerencial',    label: 'Gerencial',       icon: BarChart2 },
  { href: '/rotinas',      label: 'Rotinas',         icon: Repeat },
  { href: '/officeboy',    label: 'Office Boy',      icon: Truck },
  { href: '/cofre',        label: 'Cofre de Senhas', icon: Lock },
  { href: '/configuracoes',label: 'Configurações',   icon: Settings },
]

// Itens exibidos na Bottom Nav mobile (até 5)
const BOTTOM_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Início',    icon: LayoutDashboard },
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

export default function Shell({ children, userEmail, userInitials = 'U' }: ShellProps) {
  const pathname   = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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
          // Mobile: desliza para dentro/fora
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: sempre visível, largura colapsa
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
          {/* Fechar no mobile */}
          <button
            className="ml-auto lg:hidden text-brand-400 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
        </nav>

        {/* Perfil + colapsar (desktop) */}
        <div className="border-t border-brand-800 p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {userInitials}
              </div>
              <p className="text-xs text-brand-400 truncate">{userEmail}</p>
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
          {/* Hambúrguer mobile */}
          <button
            className="lg:hidden text-brand-600 hover:text-brand-900"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="flex-1" />

          {/* Notificações */}
          <button className="relative p-2 rounded-lg text-brand-500 hover:bg-brand-100 hover:text-brand-900 transition-colors">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500" />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-brand-900 flex items-center justify-center text-xs font-bold text-white">
            {userInitials}
          </div>
        </header>

        {/* Área de conteúdo */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

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
