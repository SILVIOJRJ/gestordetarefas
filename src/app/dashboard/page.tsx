import Shell from '@/components/layout/Shell'
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  FileText,
  Repeat,
  Lock,
  TrendingUp,
} from 'lucide-react'

interface StatCard {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
  bg: string
}

const STATS: StatCard[] = [
  { label: 'Tarefas Pendentes',    value: '—', icon: Clock,         color: 'text-warning-600',  bg: 'bg-warning-100' },
  { label: 'Em Andamento',         value: '—', icon: TrendingUp,    color: 'text-blue-600',     bg: 'bg-blue-100' },
  { label: 'Concluídas Hoje',      value: '—', icon: CheckCircle2,  color: 'text-accent-700',   bg: 'bg-accent-100' },
  { label: 'Atenção / Urgentes',   value: '—', icon: AlertTriangle, color: 'text-danger-600',   bg: 'bg-danger-100' },
]

interface QuickLink {
  href: string
  label: string
  desc: string
  icon: React.ElementType
}

const QUICK_LINKS: QuickLink[] = [
  { href: '/tarefas',         label: 'Nova Tarefa',        desc: 'Criar tarefa em qualquer setor', icon: CheckSquare },
  { href: '/clientes',        label: 'Clientes',           desc: 'Gerenciar empresas e contratos', icon: Users },
  { href: '/processos',       label: 'Legalização',        desc: 'Processos e prazos',             icon: FileText },
  { href: '/rotinas',         label: 'Rotinas',            desc: 'Pendências recorrentes',         icon: Repeat },
  { href: '/cofre',           label: 'Cofre de Senhas',   desc: 'Credenciais criptografadas E2EE', icon: Lock },
]

export default function DashboardPage() {
  return (
    <Shell userInitials="A" userEmail="admin@nascente.com.br">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Dashboard</h1>
          <p className="text-brand-500 text-sm mt-0.5">
            Visão geral do escritório — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="card flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className={color} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-brand-900">{value}</p>
                <p className="text-xs text-brand-500 leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Atalhos rápidos */}
        <section>
          <h2 className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">
            Acesso Rápido
          </h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {QUICK_LINKS.map(({ href, label, desc, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="card-hover flex flex-col gap-3 group"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center group-hover:bg-brand-900 transition-colors">
                  <Icon size={18} className="text-brand-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-900">{label}</p>
                  <p className="text-xs text-brand-500 mt-0.5">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Status de conexões */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-brand-700 mb-3">Status do Sistema</h2>
            <ul className="space-y-2">
              {[
                { label: 'Banco de dados (Supabase)',  ok: true },
                { label: 'Autenticação',               ok: true },
                { label: 'Storage / Anexos',           ok: true },
                { label: 'Cofre E2EE',                 ok: true },
              ].map(({ label, ok }) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-accent-500' : 'bg-danger-500'}`} />
                  <span className="text-brand-600">{label}</span>
                  <span className={`ml-auto text-xs font-medium ${ok ? 'text-accent-700' : 'text-danger-600'}`}>
                    {ok ? 'Operacional' : 'Falha'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-brand-700 mb-3">Módulos Disponíveis</h2>
            <ul className="space-y-1.5 text-sm text-brand-600">
              {[
                'Tarefas multi-setor',
                'Legalização de empresas',
                'Obrigações mensais',
                'Controle gerencial',
                'Rotinas recorrentes',
                'Parcelamentos fiscais',
                'Office Boy / Entregas',
                'Cofre de senhas E2EE',
                'Ordens de serviço',
                'Contratos',
              ].map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-accent-500 flex-shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </Shell>
  )
}
