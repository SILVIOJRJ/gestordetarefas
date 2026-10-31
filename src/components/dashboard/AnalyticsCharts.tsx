'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

// ─── Tipos ────────────────────────────────────────────────────

interface SliceData {
  name: string
  value: number
  color: string
}

interface Props {
  tarefasPorStatus?: SliceData[]
  faturamentoPorRegime?: SliceData[]
}

// ─── Paletas ──────────────────────────────────────────────────

export const CORES_STATUS: Record<string, string> = {
  'Pendente':     '#f59e0b',
  'Em andamento': '#3b82f6',
  'Aguardando':   '#94a3b8',
  'Concluída':    '#10b981',
  'Cancelada':    '#ef4444',
}

export const CORES_REGIME: Record<string, string> = {
  'Simples Nacional': '#6366f1',
  'Lucro Presumido':  '#0ea5e9',
  'Lucro Real':       '#f59e0b',
  'MEI':              '#10b981',
}

// ─── CustomTooltip ────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: SliceData }> }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-white border border-brand-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-brand-800">{name}</p>
      <p className="text-brand-500">{value.toLocaleString('pt-BR')}</p>
    </div>
  )
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
      {payload.map((p, i) => (
        <li key={i} className="flex items-center gap-1 text-[11px] text-brand-600">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.value}
        </li>
      ))}
    </ul>
  )
}

// ─── Rosca simples ────────────────────────────────────────────

function RoscaChart({ dados, titulo, vazio }: { dados: SliceData[]; titulo: string; vazio?: string }) {
  const total = dados.reduce((s, d) => s + d.value, 0)

  if (!total) {
    return (
      <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-brand-700">{titulo}</h3>
        <div className="flex items-center justify-center py-8 text-brand-300 text-xs">
          {vazio ?? 'Sem dados para exibir'}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-brand-100 rounded-xl p-4 space-y-2">
      <h3 className="text-sm font-semibold text-brand-700">{titulo}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={dados}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {dados.map((d, i) => (
              <Cell key={i} fill={d.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Total central via CSS overlay não é possível em SVG puro com Recharts; exibe abaixo */}
      <p className="text-center text-xs text-brand-400">Total: <strong className="text-brand-700">{total.toLocaleString('pt-BR')}</strong></p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────

export default function AnalyticsCharts({ tarefasPorStatus, faturamentoPorRegime }: Props) {
  const statusData: SliceData[] = tarefasPorStatus ?? []
  const regimeData: SliceData[] = faturamentoPorRegime ?? []

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <RoscaChart
        dados={statusData}
        titulo="Tarefas por Status"
        vazio="Nenhuma tarefa ativa no momento"
      />
      <RoscaChart
        dados={regimeData}
        titulo="Clientes por Regime Tributário"
        vazio="Nenhum cliente cadastrado"
      />
    </div>
  )
}

// ─── Helper: monta dados de status ───────────────────────────

export function montarStatusData(contagens: Record<string, number>): SliceData[] {
  return Object.entries(contagens)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: CORES_STATUS[name] ?? '#94a3b8',
    }))
}

export function montarRegimeData(contagens: Record<string, number>): SliceData[] {
  return Object.entries(contagens)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: CORES_REGIME[name] ?? '#94a3b8',
    }))
}
