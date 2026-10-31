import { supabase } from '@/lib/supabase'
import type { ReferenciaTipoAnexo } from '@/types/database.types'

// ─── Constantes ───────────────────────────────────────────────

export const BUCKET_PRINCIPAL = 'documentos-empresa'

export const TIPOS_PERMITIDOS: Record<string, string> = {
  'application/pdf':                          'PDF',
  'image/jpeg':                               'JPG',
  'image/png':                                'PNG',
  'image/webp':                               'WEBP',
  'application/zip':                          'ZIP',
  'application/x-zip-compressed':            'ZIP',
  'text/xml':                                 'XML',
  'application/xml':                          'XML',
  'application/vnd.ms-excel':                'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
}

export interface AnexoInfo {
  id: string
  nome_original: string
  url: string          // caminho no Storage (não signed URL)
  tipo_mime: string | null
  tamanho: number | null
  criado_por: string
  created_at: string
}

// ─── Upload ───────────────────────────────────────────────────

export interface UploadResult {
  caminho: string
  anexoId: string
  signedUrl: string
}

export async function uploadArquivo(
  bucket: string,
  pasta: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const ext     = file.name.split('.').pop() ?? 'bin'
  const ts      = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')
  const caminho = `${pasta}/${ts}-${safeName}`

  onProgress?.(10)

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(caminho, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (upErr) throw new Error(`Erro no upload: ${upErr.message}`)

  onProgress?.(80)

  const signedUrl = await obterSignedUrl(bucket, caminho)

  onProgress?.(100)

  return { caminho, anexoId: '', signedUrl }
}

// ─── Signed URL ───────────────────────────────────────────────

export async function obterSignedUrl(
  bucket: string,
  caminho: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(caminho, expiresInSeconds)
  if (error || !data?.signedUrl) throw new Error(`Falha ao gerar URL: ${error?.message}`)
  return data.signedUrl
}

// ─── Deletar ──────────────────────────────────────────────────

export async function deletarArquivo(bucket: string, caminho: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([caminho])
  if (error) throw new Error(`Falha ao deletar: ${error.message}`)
}

// ─── Salvar metadados na tabela anexos ────────────────────────

export async function salvarAnexoDb(params: {
  referencia_tipo: ReferenciaTipoAnexo
  referencia_id: string
  nome_original: string
  caminho: string
  tipo_mime: string
  tamanho: number
  criado_por: string
}): Promise<string> {
  const { data, error } = await (supabase.from('anexos') as any).insert({
    referencia_tipo: params.referencia_tipo,
    referencia_id:   params.referencia_id,
    nome_original:   params.nome_original,
    nome_arquivo:    params.caminho,
    url:             params.caminho,
    tamanho:         params.tamanho,
    tipo_mime:       params.tipo_mime,
    criado_por:      params.criado_por,
  }).select('id').single()
  if (error) throw new Error(`Erro ao salvar anexo: ${error.message}`)
  return data.id as string
}

// ─── Upload completo (storage + DB) ──────────────────────────

export async function uploadERegistrar(params: {
  file: File
  bucket: string
  pasta: string
  referencia_tipo: ReferenciaTipoAnexo
  referencia_id: string
  criado_por: string
  onProgress?: (pct: number) => void
}): Promise<AnexoInfo> {
  const { caminho, signedUrl } = await uploadArquivo(
    params.bucket, params.pasta, params.file, params.onProgress,
  )
  const id = await salvarAnexoDb({
    referencia_tipo: params.referencia_tipo,
    referencia_id:   params.referencia_id,
    nome_original:   params.file.name,
    caminho,
    tipo_mime:       params.file.type,
    tamanho:         params.file.size,
    criado_por:      params.criado_por,
  })
  return {
    id,
    nome_original: params.file.name,
    url: caminho,
    tipo_mime: params.file.type,
    tamanho: params.file.size,
    criado_por: params.criado_por,
    created_at: new Date().toISOString(), // local approximation
  }
}

// ─── Listar anexos de uma entidade ───────────────────────────

export async function listarAnexos(
  referencia_tipo: ReferenciaTipoAnexo,
  referencia_id: string,
): Promise<AnexoInfo[]> {
  const { data, error } = await (supabase.from('anexos') as any)
    .select('id, nome_original, url, tipo_mime, tamanho, criado_por, criado_em')
    .eq('referencia_tipo', referencia_tipo)
    .eq('referencia_id', referencia_id)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as Omit<AnexoInfo, 'created_at'>),
    created_at: (row.criado_em as string) ?? '',
  })) as AnexoInfo[]
}

// ─── Deletar anexo (storage + DB) ────────────────────────────

export async function deletarAnexo(
  id: string,
  caminho: string,
  bucket = BUCKET_PRINCIPAL,
): Promise<void> {
  await deletarArquivo(bucket, caminho)
  await (supabase.from('anexos') as any).delete().eq('id', id)
}

// ─── Helpers ──────────────────────────────────────────────────

export function fmtTamanho(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function iconeArquivo(mime: string | null): string {
  if (!mime) return '📎'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('zip')) return '🗜️'
  if (mime.includes('xml') || mime.includes('excel') || mime.includes('sheet')) return '📊'
  return '📎'
}
