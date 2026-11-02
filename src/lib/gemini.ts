// Integração com Gemini 2.5 Flash para análise de documentos e OCR
// Chave via GEMINI_API_KEY (variável de ambiente server-side apenas)

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Envia um PDF, imagem ou OFX para o Gemini 2.5 Flash e extrai metadados estruturados.
 */
export async function analisarDocumentoComIA(
  arquivo: Buffer | Blob,
  mimeType: string,
): Promise<DadosDocumentoExtraidos> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.')

  let base64Data: string
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(arquivo)) {
    base64Data = arquivo.toString('base64')
  } else {
    base64Data = await blobToBase64(arquivo as Blob)
  }

  const prompt = `
Você é um sistema especializado em análise de documentos fiscais e contábeis brasileiros.
Analise o documento fornecido e extraia as informações no formato JSON abaixo.
Se um campo não existir no documento, use null.

Tipos de documento possíveis:
- DAS: Documento de Arrecadação do Simples Nacional
- DARF: Documento de Arrecadação de Receitas Federais
- HOLERITE: Contracheque/folha de pagamento
- FATURA: Boleto, fatura de fornecedor ou despesa operacional
- CONTRATO_SOCIAL: Contrato social, alteração contratual, atos constitutivos
- NOTA_FISCAL: Nota Fiscal de Serviço (NFS-e) — receita de serviços
- NFe: Nota Fiscal Eletrônica de Produto (NF-e) — receita de vendas
- GUIA_FGTS: GFIP, SEFIP, guia de recolhimento de FGTS
- GUIA_INSS: GPS, guia de recolhimento de INSS/Previdência
- EXTRATO_BANCARIO: Extrato bancário (PDF ou OFX), conciliação bancária
- BALANCETE: Balancete, DRE, demonstrativo contábil
- OUTRO: Qualquer outro documento não enquadrado acima

Para campo_gerencial, use a coluna correspondente em gerencial_mensal:
- DAS → "das"
- GUIA_FGTS → "fgts"
- GUIA_INSS → "inss"
- NOTA_FISCAL → "receita_servicos"
- NFe → "receita_vendas"
- HOLERITE → "folha_pagamento"
- FATURA → "despesas_total"
- Demais → null

Retorne APENAS o JSON, sem markdown ou explicações:

{
  "tipo_documento": "<tipo>",
  "cnpj_cpf": "<apenas dígitos ou null>",
  "razao_social_ou_nome": "<nome da empresa ou pessoa ou null>",
  "competencia": "<MM/YYYY ou null>",
  "data_vencimento": "<YYYY-MM-DD ou null>",
  "valor": <número decimal ou null>,
  "chave_pix": "<chave pix se houver ou null>",
  "observacoes": "<informação relevante extra ou null>",
  "campo_gerencial": "<coluna ou null>"
}
`

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const json = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const dados = JSON.parse(text) as DadosDocumentoExtraidos

  // Garante campo_gerencial mesmo se a IA omitir
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
