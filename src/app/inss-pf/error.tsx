'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[INSS PF] Error:', error) }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="text-lg font-bold text-red-600">Erro na página INSS PF</h2>
      <p className="text-sm text-brand-600 max-w-md font-mono bg-red-50 p-3 rounded-lg break-all">
        {error.message || 'Erro desconhecido'}
      </p>
      <button onClick={reset} className="btn-primary">Tentar novamente</button>
    </div>
  )
}
