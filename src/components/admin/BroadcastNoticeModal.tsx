'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, CheckCircle2, Loader2 } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

interface Recado {
  id: string
  titulo: string
  corpo: string
  criado_em: string
  destinatario_id: string | null // null = global
}

// ─── Componente ───────────────────────────────────────────────

export default function BroadcastNoticeModal() {
  const [recado, setRecado]     = useState<Recado | null>(null)
  const [userId, setUserId]     = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [visto, setVisto]       = useState(false)

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Busca recados pendentes (global ou direcionado a este user) não lidos
      const { data: recados } = await (supabase.from('recados') as any)
        .select('id, titulo, corpo, criado_em, destinatario_id')
        .or(`destinatario_id.eq.${user.id},destinatario_id.is.null`)
        .order('criado_em', { ascending: false })
        .limit(20)

      if (!recados?.length) return

      // Filtra apenas os que ainda não foram marcados como cientes
      const { data: lidos } = await (supabase.from('acessos_log') as any)
        .select('obs')
        .eq('user_id', user.id)
        .like('obs', 'ciente:recado:%')

      const lidosIds = new Set<string>(
        (lidos ?? []).map((l: { obs: string }) => l.obs.replace('ciente:recado:', ''))
      )

      const pendente = (recados as Recado[]).find(r => !lidosIds.has(r.id))
      if (pendente) setRecado(pendente)
    }
    verificar()
  }, [])

  async function marcarCiente() {
    if (!recado || !userId) return
    setSalvando(true)
    try {
      await (supabase.from('acessos_log') as any).insert({
        user_id: userId,
        acao: 'recado_ciente',
        obs: `ciente:recado:${recado.id}`,
      })
      setVisto(true)
      setTimeout(() => setRecado(null), 600)
    } finally {
      setSalvando(false)
    }
  }

  if (!recado) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-brand-900 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-brand-900" />
          </div>
          <div>
            <p className="text-xs text-brand-300 uppercase tracking-wide">Aviso Importante</p>
            <p className="text-white font-semibold">{recado.titulo}</p>
          </div>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5">
          <p className="text-sm text-brand-700 leading-relaxed whitespace-pre-wrap">{recado.corpo}</p>
          <p className="text-xs text-brand-400 mt-4">
            Publicado em {new Date(recado.criado_em).toLocaleString('pt-BR')}
          </p>
        </div>

        {/* Ação */}
        <div className="px-6 pb-6">
          <button
            onClick={marcarCiente}
            disabled={salvando || visto}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition
              ${visto
                ? 'bg-accent-500 text-white cursor-default'
                : 'bg-brand-900 hover:bg-brand-800 text-white disabled:opacity-70'
              }`}
          >
            {salvando
              ? <><Loader2 size={16} className="animate-spin" /> Registrando…</>
              : visto
                ? <><CheckCircle2 size={16} /> Ciente registrado!</>
                : <><CheckCircle2 size={16} /> Marcar como Ciente</>
            }
          </button>
          <p className="text-xs text-brand-400 text-center mt-2">
            Este aviso não pode ser fechado sem confirmação de leitura.
          </p>
        </div>
      </div>
    </div>
  )
}
