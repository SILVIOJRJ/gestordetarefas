// Tipos e utilitários para análise de documentos via Gemini (chamado via API Route server-side)

export type TipoDocumento =
  | 'DAS'
  | 'DARF'
  | 'HOLERITE'
  | 'FATURA'
  | 'CONTRATO_SOCIAL'
  | 'NOTA_FISCAL'        // NFS-e (serviços)
  | 'NFe'                // NF-e (produtos)
  | 'GUIA_FGTS'
  | 'GUIA_INSS'
  | 'EXTRATO_BANCARIO'   // OFX / PDF de extrato
  | 'BALANCETE'
  | 'OUTRO'

/** Qual coluna de gerencial_mensal este documento alimenta (null = não aloca) */
export type CampoGerencial =
  | 'das'
  | 'fgts'
  | 'inss'
  | 'receita_servicos'
  | 'receita_vendas'
  | 'despesas_total'
  | 'folha_pagamento'
  | null

export interface DadosDocumentoExtraidos {
  tipo_documento: TipoDocumento
  cnpj_cpf: string | null
  razao_social_ou_nome: string | null
  competencia: string | null        // 'MM/YYYY'
  data_vencimento: string | null    // 'YYYY-MM-DD'
  valor: number | null
  chave_pix: string | null
  observacoes: string | null
  campo_gerencial: CampoGerencial   // inferido pela IA ou derivado do tipo
}

/**
 * Envia um arquivo para a API Route server-side que chama o Gemini.
 * Resolve o problema de GEMINI_API_KEY não estar disponível no client-side.
 */
export async function analisarDocumentoComIA(
  arquivo: Buffer | Blob,
  mimeType: string,
): Promise<DadosDocumentoExtraidos> {
  const blob = arquivo instanceof Blob ? arquivo : new Blob([arquivo as unknown as BlobPart], { type: mimeType })
  const form = new FormData()
  form.append('file', blob, 'documento')

  const resp = await fetch('/api/analisar-documento', { method: 'POST', body: form })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText })) as { error?: string }
    throw new Error(err.error ?? `Erro ${resp.status} na análise do documento.`)
  }

  const { dados } = await resp.json() as { dados: DadosDocumentoExtraidos }

  if (dados.campo_gerencial === undefined) {
    dados.campo_gerencial = derivarCampoGerencial(dados.tipo_documento)
  }

  return dados
}

function derivarCampoGerencial(tipo: TipoDocumento): CampoGerencial {
  const mapa: Partial<Record<TipoDocumento, CampoGerencial>> = {
    DAS:              'das',
    GUIA_FGTS:        'fgts',
    GUIA_INSS:        'inss',
    NOTA_FISCAL:      'receita_servicos',
    NFe:              'receita_vendas',
    HOLERITE:         'folha_pagamento',
    FATURA:           'despesas_total',
  }
  return mapa[tipo] ?? null
}

/**
 * Gera mensagem formatada para WhatsApp com os dados do documento e a URL segura.
 */
export function gerarMensagemNotificacaoWhatsApp(
  dados: DadosDocumentoExtraidos,
  urlSegura: string,
): string {
  const tipo = dados.tipo_documento ?? 'Documento'
  const empresa = dados.razao_social_ou_nome ?? 'Cliente'
  const competencia = dados.competencia ? ` referente a ${dados.competencia}` : ''
  const vencimento = dados.data_vencimento
    ? ` com vencimento em *${new Date(dados.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}*`
    : ''
  const valor = dados.valor != null
    ? `\n💰 *Valor:* R$ ${dados.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : ''
  const pix = dados.chave_pix ? `\n🔑 *Chave PIX:* ${dados.chave_pix}` : ''

  return (
    `Olá, *${empresa}*! 👋\n\n` +
    `📄 Segue seu *${tipo}*${competencia}${vencimento}.` +
    valor +
    pix +
    `\n\n🔗 Acesse o documento (link válido por 5 minutos):\n${urlSegura}\n\n` +
    `Em caso de dúvidas, estamos à disposição. ✅`
  )
}
