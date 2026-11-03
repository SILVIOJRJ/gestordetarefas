import { NextRequest, NextResponse } from 'next/server'
import type { DadosDocumentoExtraidos } from '@/lib/gemini'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'

const PROMPT = `
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

export async function POST(req: NextRequest) {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'application/octet-stream'

    const body = {
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }

    // Retry até 3x em caso de 503 (sobrecarga temporária do Gemini)
    let resp: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (resp.status !== 503) break
      await new Promise(r => setTimeout(r, (attempt + 1) * 1500))
    }

    if (!resp || !resp.ok) {
      const txt = await resp?.text() ?? 'sem resposta'
      return NextResponse.json({ error: `Gemini error: ${txt}` }, { status: resp?.status ?? 500 })
    }

    const json = await resp.json()
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const dados: DadosDocumentoExtraidos = JSON.parse(clean)

    return NextResponse.json({ dados })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno.' }, { status: 500 })
  }
}
