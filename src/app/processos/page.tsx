'use client'

import Shell from '@/components/layout/Shell'
import { FileText } from 'lucide-react'

export default function ProcessosPage() {
  return (
    <Shell>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-brand-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <h1 className="text-lg font-bold text-brand-700">Legalização</h1>
          <p className="text-sm mt-1">Módulo em desenvolvimento — Passo 7+</p>
        </div>
      </div>
    </Shell>
  )
}
