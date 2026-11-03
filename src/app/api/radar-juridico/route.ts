import { NextResponse } from 'next/server'

const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-1.5-flash']

const PROMPT = `Hoje é 03 de novembro de 2026. Você é um especialista em legislação tributária e trabalhista brasileira.

Liste as 10 normas mais relevantes publicadas nos ÚLTIMOS 60 DIAS (setembro e outubro de 2026) que impactam escritórios de contabilidade e seus clientes empresariais (Simples Nacional, MEI, Lucro Presumido, Lucro Real).

Foque em: Receita Federal, PGDAS, eSocial, SPED, FGTS Digital, Reforma Tributária (CBS/IBS), prazos obrigatórios, e-Social, INSS, alterações no Simples Nacional.

Retorne APENAS um JSON array, sem markdown:

[
  {
    "id": "slug-unico",
    "titulo": "Título claro e objetivo da norma",
    "norma": "Ex: IN RFB 2.200/2026",
    "tipo": "Lei Complementar|Resolução CGSN|Instrução Normativa|Decisão STF|Decisão STJ|Portaria|Emenda Constitucional",
    "data": "YYYY-MM-DD",
    "regimesImpactados": ["Simples Nacional|MEI|Lucro Presumido|Lucro Real|Todos"],
    "impacto": "Descrição clara do impacto prático para empresas e contadores (2-3 frases)",
    "acaoPreventiva": "O que o contador deve fazer agora (1-2 frases práticas)",
    "urgente": true|false,
    "tags": ["tag1","tag2","tag3"]
  }
]`

export async function GET() {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 })
  }

  const body = {
    contents: [{ parts: [{ text: PROMPT }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  }

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
      break
    }
    if (resp?.ok) break
    lastErr = await resp?.text() ?? ''
  }

  if (!resp || !resp.ok) {
    return NextResponse.json({ error: `Gemini error: ${lastErr}` }, { status: resp?.status ?? 500 })
  }

  try {
    const json = await resp.json()
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const alertas = JSON.parse(clean)
    return NextResponse.json({ alertas, geradoEm: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao parsear resposta.' }, { status: 500 })
  }
}
