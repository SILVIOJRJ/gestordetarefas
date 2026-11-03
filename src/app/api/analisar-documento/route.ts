import { NextRequest, NextResponse } from 'next/server'
import type { DadosDocumentoExtraidos } from '@/lib/gemini'

const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash-lite',
]

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

    // Tenta cada modelo em sequência; pula para o próximo em 503/404
    let resp: Response | null = null
    let lastErr = ''
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      for (let attempt = 0; attempt < 2; attempt++) {
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (resp.ok) break
        if (resp.status === 503) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000))
          continue
        }
        break // 404, 400, etc — tenta próximo modelo
      }
      if (resp?.ok) break
      lastErr = await resp?.text() ?? ''
    }

    if (!resp || !resp.ok) {
      return NextResponse.json({ error: `Gemini error: ${lastErr}` }, { status: resp?.status ?? 500 })
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
