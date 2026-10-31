import { supabase } from '@/lib/supabase'
import { analisarDocumentoComIA, type DadosDocumentoExtraidos } from '@/lib/gemini'

const BUCKET = 'documentos-empresa'

export interface DocumentoUploadResult {
  caminho: string
  dados: DadosDocumentoExtraidos
  anexoId: string
}

/**
 * Faz upload de um arquivo para o bucket privado e analisa com IA.
 * Salva metadados na tabela `anexos` vinculados ao cliente.
 */
export async function uploadDocumentoComIA(
  arquivo: File,
  clienteId: string,
  criadoPor: string,
): Promise<DocumentoUploadResult> {
  // 1. Determina caminho único no Storage
  const ext = arquivo.name.split('.').pop() ?? 'bin'
  const ts  = Date.now()
  const caminho = `${clienteId}/${ts}-${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  // 2. Upload para bucket privado
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, {
      cacheControl: '3600',
      upsert: false,
      contentType: arquivo.type,
    })

  if (uploadErr) throw new Error(`Erro no upload: ${uploadErr.message}`)

  // 3. Gera signed URL temporária para leitura pela IA
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminho, 120) // 2 min para a IA processar

  if (signErr || !signed?.signedUrl) throw new Error('Falha ao gerar URL de leitura para IA.')

  // 4. Analisa com Gemini
  const blob = await fetch(signed.signedUrl).then((r) => r.blob())
  const dados = await analisarDocumentoComIA(blob, arquivo.type)

  // 5. Persiste metadados na tabela anexos
  const { data: anexo, error: dbErr } = await supabase
    .from('anexos')
    .insert({
      referencia_tipo: 'cliente',
      referencia_id:   clienteId,
      nome_original:   arquivo.name,
      nome_arquivo:    caminho,
      url:             caminho, // URL resolvida via signed URLs na leitura
      tamanho:         arquivo.size,
      tipo_mime:       arquivo.type,
      criado_por:      criadoPor,
    })
    .select('id')
    .single()

  if (dbErr || !anexo) throw new Error(`Erro ao salvar metadados: ${dbErr?.message}`)

  return { caminho, dados, anexoId: anexo.id }
}

/**
 * Gera uma Signed URL privada com validade de `expiraEmSegundos` (padrão 5 min).
 * Nunca expõe a URL pública permanente do arquivo.
 */
export async function obterUrlSegura(
  caminhoArquivo: string,
  expiraEmSegundos = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminhoArquivo, expiraEmSegundos)

  if (error || !data?.signedUrl) {
    throw new Error(`Falha ao gerar Signed URL: ${error?.message}`)
  }

  return data.signedUrl
}

/**
 * Lista documentos de um cliente ordenados por data de criação.
 */
export async function listarDocumentosCliente(clienteId: string) {
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .eq('referencia_tipo', 'cliente')
    .eq('referencia_id', clienteId)
    .order('criado_em', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Remove um documento do Storage e da tabela anexos.
 */
export async function removerDocumento(anexoId: string, caminhoArquivo: string): Promise<void> {
  const [{ error: storageErr }, { error: dbErr }] = await Promise.all([
    supabase.storage.from(BUCKET).remove([caminhoArquivo]),
    supabase.from('anexos').delete().eq('id', anexoId),
  ])

  if (storageErr) throw new Error(`Erro ao remover do Storage: ${storageErr.message}`)
  if (dbErr)      throw new Error(`Erro ao remover do banco: ${dbErr.message}`)
}
