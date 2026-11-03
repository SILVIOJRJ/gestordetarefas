import { supabase } from '@/lib/supabase'
import { analisarDocumentoComIA, type DadosDocumentoExtraidos, type TipoDocumento } from '@/lib/gemini'

const BUCKET = 'documentos'

export interface DocumentoUploadResult {
  caminho: string
  dados: DadosDocumentoExtraidos
  anexoId: string
  alocado: boolean
  alocacaoDetalhes: string[]
}

// ─── Mapeamento tipo → setor/obrigação no controle_mensal ──────

interface ObrigacaoMap {
  setor: string
  obrigacao: string
}

const TIPO_PARA_OBRIGACAO: Partial<Record<TipoDocumento, ObrigacaoMap>> = {
  DAS:       { setor: 'FISCAL', obrigacao: 'PGDAS' },
  DARF:      { setor: 'FISCAL', obrigacao: 'DCTF' },
  GUIA_FGTS: { setor: 'DP',     obrigacao: 'FGTS' },
  GUIA_INSS: { setor: 'DP',     obrigacao: 'INSS' },
}

// ─── Triagem Inteligente de Lote ─────────────────────────────

export interface LancamentoClassificado {
  origem: string
  destino: 'LANCAMENTO_CAIXA' | 'OBRIGACAO_CLIENTE' | 'IGNORADO'
  descricao: string
  valor: number | null
  tipo: 'entrada' | 'saida'
  categoria: string
  cliente?: string | null
}

type DestinoMap = Record<TipoDocumento, Omit<LancamentoClassificado, 'origem' | 'valor' | 'cliente'>>

const DESTINO_POR_TIPO: DestinoMap = {
  DAS:             { destino: 'OBRIGACAO_CLIENTE', descricao: 'DAS — Simples Nacional',     tipo: 'saida',   categoria: 'Imposto' },
  DARF:            { destino: 'OBRIGACAO_CLIENTE', descricao: 'DARF',                        tipo: 'saida',   categoria: 'Imposto' },
  HOLERITE:        { destino: 'LANCAMENTO_CAIXA',  descricao: 'Folha de Pagamento',          tipo: 'saida',   categoria: 'Pessoal' },
  FATURA:          { destino: 'LANCAMENTO_CAIXA',  descricao: 'Fatura/Boleto',               tipo: 'saida',   categoria: 'Despesa' },
  CONTRATO_SOCIAL: { destino: 'IGNORADO',          descricao: 'Contrato Social (arquivo)',   tipo: 'entrada', categoria: 'Documento' },
  NOTA_FISCAL:     { destino: 'LANCAMENTO_CAIXA',  descricao: 'Nota Fiscal de Serviço',     tipo: 'entrada', categoria: 'Receita' },
  NFe:             { destino: 'LANCAMENTO_CAIXA',  descricao: 'Nota Fiscal de Produto',     tipo: 'entrada', categoria: 'Receita' },
  GUIA_FGTS:       { destino: 'OBRIGACAO_CLIENTE', descricao: 'Guia FGTS',                  tipo: 'saida',   categoria: 'Imposto' },
  GUIA_INSS:       { destino: 'OBRIGACAO_CLIENTE', descricao: 'Guia INSS/GPS',              tipo: 'saida',   categoria: 'Imposto' },
  EXTRATO_BANCARIO:{ destino: 'LANCAMENTO_CAIXA',  descricao: 'Extrato Bancário',           tipo: 'entrada', categoria: 'Financeiro' },
  BALANCETE:       { destino: 'LANCAMENTO_CAIXA',  descricao: 'Balancete/DRE',              tipo: 'entrada', categoria: 'Contábil' },
  OUTRO:           { destino: 'IGNORADO',          descricao: 'Documento não classificado', tipo: 'entrada', categoria: 'Outros' },
}

export function classificarLotePorDestino(
  docs: DadosDocumentoExtraidos[],
  nomeOrigem = 'documento',
): LancamentoClassificado[] {
  return docs.map((doc, i) => {
    const template = DESTINO_POR_TIPO[doc.tipo_documento]
    return {
      origem:    `${nomeOrigem} #${i + 1}`,
      destino:   template.destino,
      descricao: doc.observacoes
        ? `${template.descricao} — ${doc.observacoes}`
        : template.descricao,
      valor:     doc.valor,
      tipo:      template.tipo,
      categoria: template.categoria,
      cliente:   doc.razao_social_ou_nome,
    }
  })
}

// ─── Auto-alocação em gerencial_mensal ────────────────────────

/**
 * Injeta o valor extraído do documento no campo correto de gerencial_mensal.
 * Para campos acumulativos (despesas, receitas), soma ao valor existente.
 */
async function alocarValoresGerenciais(
  dados: DadosDocumentoExtraidos,
  clienteId: string,
  competencia: string,
): Promise<string[]> {
  const campo = dados.campo_gerencial
  if (!campo || dados.valor == null) return []

  const detalhes: string[] = []

  try {
    // Campos acumulativos: soma ao existente; demais: sobrescreve apenas se vazio
    const acumulativos: string[] = ['despesas_total', 'receita_servicos', 'receita_vendas']

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: atual } = await (supabase.from('gerencial_mensal') as any)
      .select(`id, ${campo}`)
      .eq('cliente_id', clienteId)
      .eq('competencia', competencia)
      .single()

    const valorAtual: number = atual?.[campo] ?? 0
    const novoValor = acumulativos.includes(campo)
      ? (valorAtual ?? 0) + dados.valor
      : dados.valor

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('gerencial_mensal') as any)
      .upsert(
        {
          cliente_id:  clienteId,
          competencia,
          [campo]:     novoValor,
          atualizado_por: 'IA Upload',
        },
        { onConflict: 'cliente_id,competencia' },
      )

    if (!error) {
      detalhes.push(`${campo}: R$ ${novoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    }
  } catch {
    // falha silenciosa — não bloqueia o upload
  }

  return detalhes
}

// ─── Auto-conclusão em controle_mensal_obrigacoes ─────────────

/**
 * Marca a obrigação correspondente como Concluído no controle mensal.
 */
async function atualizarObrigacaoConcluida(
  dados: DadosDocumentoExtraidos,
  clienteId: string,
  competencia: string,
): Promise<string[]> {
  const mapa = TIPO_PARA_OBRIGACAO[dados.tipo_documento]
  if (!mapa) return []

  const detalhes: string[] = []

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existente } = await (supabase.from('controle_mensal_obrigacoes') as any)
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('competencia', competencia)
      .eq('setor', mapa.setor)
      .eq('obrigacao', mapa.obrigacao)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = existente
      ? await (supabase.from('controle_mensal_obrigacoes') as any)
          .update({ status: 'Concluído', valor: dados.valor })
          .eq('id', existente.id)
      : await (supabase.from('controle_mensal_obrigacoes') as any)
          .insert({
            cliente_id:  clienteId,
            competencia,
            setor:       mapa.setor,
            obrigacao:   mapa.obrigacao,
            status:      'Concluído',
            valor:       dados.valor,
          })

    if (!error) {
      detalhes.push(`${mapa.setor} / ${mapa.obrigacao} → Concluído`)
    }
  } catch {
    // silencioso
  }

  return detalhes
}

// ─── Upload principal ─────────────────────────────────────────

/**
 * Faz upload de um arquivo para o bucket privado, analisa com IA Gemini,
 * e aloca automaticamente os valores nas tabelas gerencial_mensal e
 * controle_mensal_obrigacoes quando aplicável.
 */
export async function uploadDocumentoComIA(
  arquivo: File,
  clienteId: string | null,
  criadoPor: string,
  competencia?: string, // 'YYYY-MM' — quando fornecida, ativa a alocação automática
): Promise<DocumentoUploadResult> {
  // 1. Caminho único no Storage
  const ts  = Date.now()
  const pasta = clienteId ?? 'sem-cliente'
  const caminho = `${pasta}/${ts}-${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  // 2. Upload para bucket privado
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, {
      cacheControl: '3600',
      upsert: false,
      contentType: arquivo.type,
    })

  if (uploadErr) throw new Error(`Erro no upload: ${uploadErr.message}`)

  // 3. Signed URL temporária para a IA
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminho, 120)

  if (signErr || !signed?.signedUrl) throw new Error('Falha ao gerar URL de leitura para IA.')

  // 4. Analisa com Gemini
  const blob = await fetch(signed.signedUrl).then((r) => r.blob())
  const dados = await analisarDocumentoComIA(blob, arquivo.type)

  // 5. Alocação automática (paralela, silenciosa em caso de falha)
  let alocacaoDetalhes: string[] = []
  let alocado = false

  if (competencia && clienteId) {
    const [gerencial, obrigacao] = await Promise.all([
      alocarValoresGerenciais(dados, clienteId, competencia),
      atualizarObrigacaoConcluida(dados, clienteId, competencia),
    ])
    alocacaoDetalhes = [...gerencial, ...obrigacao]
    alocado = alocacaoDetalhes.length > 0
  }

  // 6. Persiste metadados na tabela anexos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: anexo, error: dbErr } = await (supabase.from('anexos') as any)
    .insert({
      referencia_tipo:  clienteId ? 'cliente' : null,
      referencia_id:    clienteId ?? null,
      nome_original:    arquivo.name,
      nome_arquivo:     caminho,
      url:              caminho,
      tamanho:          arquivo.size,
      tipo_mime:        arquivo.type,
      criado_por:       criadoPor,
      competencia:      competencia ?? null,
      tipo_documento:   dados.tipo_documento,
      status_ia:        'Processado com IA',
      alocado,
    })
    .select('id')
    .single()

  if (dbErr || !anexo) throw new Error(`Erro ao salvar metadados: ${dbErr?.message}`)

  return { caminho, dados, anexoId: anexo.id, alocado, alocacaoDetalhes }
}

// ─── URL segura ───────────────────────────────────────────────

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

// ─── Histórico ────────────────────────────────────────────────

export interface AnexoHistorico {
  id: string
  nome_original: string
  tipo_documento: string | null
  status_ia: string | null
  alocado: boolean | null
  competencia: string | null
  criado_em: string
  referencia_id: string
  nome_arquivo: string
}

export async function listarHistoricoUploads(limite = 50): Promise<AnexoHistorico[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('anexos') as any)
    .select('id, nome_original, tipo_documento, status_ia, alocado, competencia, criado_em, referencia_id, nome_arquivo')
    .eq('referencia_tipo', 'cliente')
    .order('criado_em', { ascending: false })
    .limit(limite)

  if (error) return []
  return (data ?? []) as AnexoHistorico[]
}

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

export async function removerDocumento(anexoId: string, caminhoArquivo: string): Promise<void> {
  const [{ error: storageErr }, { error: dbErr }] = await Promise.all([
    supabase.storage.from(BUCKET).remove([caminhoArquivo]),
    supabase.from('anexos').delete().eq('id', anexoId),
  ])

  if (storageErr) throw new Error(`Erro ao remover do Storage: ${storageErr.message}`)
  if (dbErr)      throw new Error(`Erro ao remover do banco: ${dbErr.message}`)
}
