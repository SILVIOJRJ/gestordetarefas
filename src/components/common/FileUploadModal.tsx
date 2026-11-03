'use client'

import { useState, useRef, useCallback } from 'react'
import { TIPOS_PERMITIDOS, fmtTamanho, iconeArquivo } from '@/services/storage'

export interface FileUploadModalProps {
  titulo?: string
  bucket: string
  pasta: string
  referencia_tipo: string
  referencia_id: string
  criado_por: string
  maxSizeMb?: number
  onUpload: (files: File[], pasta: string, bucket: string) => Promise<void>
  onClose: () => void
}

interface ArquivoPendente {
  file: File
  id: string
  progresso: number
  erro: string | null
  ok: boolean
}

export default function FileUploadModal({
  titulo = 'Anexar Arquivos',
  bucket,
  pasta,
  referencia_tipo: _referencia_tipo,
  referencia_id: _referencia_id,
  criado_por: _criado_por,
  maxSizeMb = 20,
  onUpload,
  onClose,
}: FileUploadModalProps) {
  const [pendentes, setPendentes] = useState<ArquivoPendente[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const maxBytes = maxSizeMb * 1024 * 1024

  const adicionarArquivos = useCallback((files: FileList | File[]) => {
    const novos: ArquivoPendente[] = []
    Array.from(files).forEach(file => {
      const tipoOk  = Object.keys(TIPOS_PERMITIDOS).includes(file.type)
      const tamanhoOk = file.size <= maxBytes
      novos.push({
        file,
        id: `${Date.now()}-${Math.random()}`,
        progresso: 0,
        erro: !tipoOk
          ? `Tipo não permitido (${file.type || 'desconhecido'})`
          : !tamanhoOk
          ? `Arquivo muito grande (máx ${maxSizeMb} MB)`
          : null,
        ok: tipoOk && tamanhoOk,
      })
    })
    setPendentes(p => [...p, ...novos])
  }, [maxBytes, maxSizeMb])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    if (e.dataTransfer.files.length) adicionarArquivos(e.dataTransfer.files)
  }, [adicionarArquivos])

  const remover = (id: string) => setPendentes(p => p.filter(x => x.id !== id))

  const enviar = async () => {
    const validos = pendentes.filter(p => p.ok && !p.erro)
    if (!validos.length) return
    setEnviando(true)
    try {
      await onUpload(validos.map(v => v.file), pasta, bucket)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setEnviando(false)
    }
  }

  const validos = pendentes.filter(p => p.ok && !p.erro)
  const invalidos = pendentes.filter(p => !p.ok || p.erro)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {titulo}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${arrastando
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
            `}
          >
            <div className="text-4xl mb-3">📁</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Arraste arquivos aqui ou <span className="text-blue-600">clique para selecionar</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              PDF, PNG, JPG, ZIP, XML, XLS/XLSX — máx {maxSizeMb} MB por arquivo
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={Object.keys(TIPOS_PERMITIDOS).join(',')}
              className="hidden"
              onChange={e => e.target.files && adicionarArquivos(e.target.files)}
            />
          </div>

          {/* Arquivos pendentes */}
          {pendentes.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {pendentes.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                    p.erro
                      ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                      : 'border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700'
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{iconeArquivo(p.file.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {p.file.name}
                    </p>
                    {p.erro ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{p.erro}</p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {fmtTamanho(p.file.size)}
                        {p.progresso > 0 && p.progresso < 100 && ` · ${p.progresso}%`}
                        {p.progresso === 100 && ' · ✅'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => remover(p.id)}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {invalidos.length > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {invalidos.length} arquivo(s) com erro serão ignorados.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {validos.length} arquivo(s) prontos para envio
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={enviar}
              disabled={validos.length === 0 || enviando}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? 'Enviando…' : `Enviar ${validos.length > 0 ? `(${validos.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
