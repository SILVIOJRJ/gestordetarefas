'use client'

import { useEffect } from 'react'

export default function PerfilError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Perfil] erro:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-rose-100 p-6 space-y-4">
        <h2 className="text-lg font-bold text-rose-700">Erro ao carregar o perfil</h2>
        <p className="text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-3 font-mono break-all">
          {error.message}
        </p>
        <button
          onClick={reset}
          className="w-full bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium py-2.5 rounded-xl transition"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
