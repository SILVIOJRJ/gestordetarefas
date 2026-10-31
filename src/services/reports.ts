// reports.ts — Geração de PDFs timbrados via print window
// Padrão: HTML estilizado → window.print() → salva como PDF

import { supabase } from '@/lib/supabase'
import type { OrdemServico, Contrato, Cliente } from '@/types/database.types'

// ─── Dados do escritório (timbrado) ──────────────────────────

const ESCRITORIO = {
  razao: 'Nascente Contábil',
  cnpj: '00.000.000/0001-00',
  endereco: 'Rua Exemplo, 123 — Centro — Blumenau/SC',
  telefone: '(47) 3333-0000',
  email: 'contato@nascentecontabil.com.br',
  site: 'www.nascentecontabil.com.br',
}

// ─── CSS base para todos os PDFs ─────────────────────────────

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #1a1a2e; background: white; }
  @page { margin: 20mm 15mm; size: A4; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #1a1a2e; margin-bottom: 20px; }
  .header-logo { font-size: 18px; font-weight: 900; color: #1a1a2e; letter-spacing: -0.5px; }
  .header-logo span { color: #10b981; }
  .header-info { text-align: right; font-size: 9px; color: #555; line-height: 1.6; }

  .doc-title { text-align: center; font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
  .doc-num { text-align: center; font-size: 10px; color: #666; margin-top: -14px; margin-bottom: 20px; }

  .section { margin-bottom: 16px; }
  .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #10b981; font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 8px; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .field { margin-bottom: 6px; }
  .field-label { font-size: 8px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .field-value { font-size: 11px; color: #1a1a2e; font-weight: 500; margin-top: 1px; }

  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
  th { background: #1a1a2e; color: white; padding: 6px 8px; text-align: left; font-size: 9px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }
  tr:nth-child(even) td { background: #f9fafb; }

  .total-row td { font-weight: bold; background: #f0fdf4 !important; border-top: 2px solid #10b981; }

  .assinaturas { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .assinatura-box { text-align: center; }
  .assinatura-linha { border-top: 1px solid #333; padding-top: 6px; font-size: 9px; color: #666; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; }
  .badge-ok { background: #d1fae5; color: #065f46; }
  .badge-pending { background: #fef3c7; color: #92400e; }

  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 8px; color: #999; }
`

function fmt(v: number | null | undefined) {
  if (v == null) return 'R$ 0,00'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR')
}

function numOS() {
  return `OS-${Date.now().toString().slice(-8)}`
}

// ─── Timbrado compartilhado ───────────────────────────────────

function headerHtml(subtitulo?: string) {
  return `
    <div class="header">
      <div>
        <div class="header-logo">Nascente<span>Contábil</span></div>
        <div style="font-size:9px;color:#666;margin-top:4px">${ESCRITORIO.endereco}</div>
      </div>
      <div class="header-info">
        CNPJ: ${ESCRITORIO.cnpj}<br>
        Tel: ${ESCRITORIO.telefone}<br>
        ${ESCRITORIO.email}<br>
        ${ESCRITORIO.site}
        ${subtitulo ? `<br><br><strong>${subtitulo}</strong>` : ''}
      </div>
    </div>
  `
}

function footerHtml() {
  return `
    <div class="footer">
      Documento gerado em ${new Date().toLocaleString('pt-BR')} — ${ESCRITORIO.razao} · ${ESCRITORIO.cnpj}
    </div>
  `
}

function abrirPrint(html: string) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Habilite pop-ups para gerar o PDF.'); return }
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>${BASE_CSS}</style></head><body>${html}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 600)
}

// ─── Ordem de Serviço ─────────────────────────────────────────

export interface OSPayload {
  os: OrdemServico
  cliente: Cliente
  itens?: Array<{ descricao: string; qtd: number; valor: number }>
}

export function imprimirOS({ os, cliente, itens = [] }: OSPayload) {
  const num = os.numero ?? numOS()
  const subtotal = itens.reduce((a, i) => a + i.qtd * i.valor, 0)
  const itensHtml = itens.length > 0 ? `
    <table>
      <tr><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr>
      ${itens.map(i => `<tr><td>${i.descricao}</td><td>${i.qtd}</td><td>${fmt(i.valor)}</td><td>${fmt(i.qtd * i.valor)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="3"><strong>Total</strong></td><td><strong>${fmt(subtotal)}</strong></td></tr>
    </table>
  ` : '<p style="color:#999;font-size:10px">Sem itens discriminados.</p>'

  const html = `
    ${headerHtml()}
    <div class="doc-title">Ordem de Serviço</div>
    <div class="doc-num">Nº ${num} · Status: ${os.status} · Abertura: ${fmtDate(os.data_abertura)}</div>

    <div class="section">
      <div class="section-title">Dados do Cliente</div>
      <div class="grid-2">
        <div class="field"><div class="field-label">Razão Social</div><div class="field-value">${cliente.nome}</div></div>
        <div class="field"><div class="field-label">CNPJ/CPF</div><div class="field-value">${cliente.cnpj ?? '—'}</div></div>
        <div class="field"><div class="field-label">Regime Tributário</div><div class="field-value">${cliente.regime ?? '—'}</div></div>
        <div class="field"><div class="field-label">E-mail</div><div class="field-value">${cliente.email ?? '—'}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Descrição do Serviço</div>
      <div class="field-value" style="white-space:pre-wrap;line-height:1.6">${os.descricao}</div>
    </div>

    <div class="section">
      <div class="section-title">Itens / Honorários</div>
      ${itensHtml}
    </div>

    ${os.obs ? `<div class="section"><div class="section-title">Observações</div><div style="white-space:pre-wrap;font-size:10px;color:#555">${os.obs}</div></div>` : ''}

    <div class="assinaturas">
      <div class="assinatura-box">
        <div class="assinatura-linha">Cliente — ${cliente.nome}</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-linha">${ESCRITORIO.razao} — Responsável</div>
      </div>
    </div>
    ${footerHtml()}
  `
  abrirPrint(html)
}

// ─── Contrato de Prestação de Serviços ───────────────────────

export interface ContratoPayload {
  contrato: Contrato
  cliente: Cliente
  servicosDetalhados?: string[]
}

export function imprimirContrato({ contrato, cliente, servicosDetalhados = [] }: ContratoPayload) {
  const servicosHtml = servicosDetalhados.length > 0
    ? servicosDetalhados.map((s, i) => `<div style="padding:3px 0;border-bottom:1px solid #f0f0f0">${i + 1}. ${s}</div>`).join('')
    : '<p style="color:#999;font-size:10px">Conforme proposta comercial anexa.</p>'

  const html = `
    ${headerHtml('CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS')}

    <div class="doc-title">Contrato de Prestação de Serviços</div>
    <div class="doc-num">${contrato.titulo} · Início: ${fmtDate(contrato.inicio)}</div>

    <div class="section">
      <div class="section-title">Partes Contratantes</div>
      <p><strong>CONTRATANTE:</strong> ${cliente.nome} — CNPJ/CPF: ${cliente.cnpj ?? '—'}</p>
      <p style="margin-top:6px"><strong>CONTRATADA:</strong> ${ESCRITORIO.razao} — CNPJ: ${ESCRITORIO.cnpj} — ${ESCRITORIO.endereco}</p>
    </div>

    <div class="section">
      <div class="section-title">Objeto do Contrato</div>
      <p style="line-height:1.7">${contrato.descricao ?? 'Prestação de serviços contábeis, fiscais e trabalhistas conforme legislação vigente.'}</p>
    </div>

    <div class="section">
      <div class="section-title">Serviços Inclusos</div>
      ${servicosHtml}
    </div>

    <div class="section">
      <div class="section-title">Honorários e Vigência</div>
      <div class="grid-3">
        <div class="field"><div class="field-label">Honorário Mensal</div><div class="field-value" style="font-size:14px;color:#10b981;font-weight:900">${fmt(contrato.valor_mensal)}</div></div>
        <div class="field"><div class="field-label">Início da Vigência</div><div class="field-value">${fmtDate(contrato.inicio)}</div></div>
        <div class="field"><div class="field-label">Término / Renovação</div><div class="field-value">${contrato.termino ? fmtDate(contrato.termino) : contrato.renovacao_auto ? 'Renovação automática anual' : 'Indeterminado'}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cláusulas Gerais</div>
      <div style="font-size:9px;color:#555;line-height:1.8">
        <p><strong>1. OBRIGAÇÕES DA CONTRATADA:</strong> A ${ESCRITORIO.razao} obriga-se a prestar os serviços descritos com zelo, pontualidade e de acordo com as normas do CFC.</p>
        <p><strong>2. OBRIGAÇÕES DO CONTRATANTE:</strong> Fornecer documentos até o dia 5 de cada mês, assinar guias e declarações em tempo hábil.</p>
        <p><strong>3. RESCISÃO:</strong> Qualquer das partes pode rescindir com aviso prévio de 30 dias.</p>
        <p><strong>4. FORO:</strong> Comarca de Blumenau/SC.</p>
      </div>
    </div>

    <p style="text-align:center;font-size:9px;color:#888;margin:16px 0">
      Blumenau/SC, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
    </p>

    <div class="assinaturas">
      <div class="assinatura-box">
        <div class="assinatura-linha">CONTRATANTE — ${cliente.nome}</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-linha">CONTRATADA — ${ESCRITORIO.razao}</div>
      </div>
    </div>
    ${footerHtml()}
  `
  abrirPrint(html)
}

// ─── Relatório Gerencial ──────────────────────────────────────

export interface LancamentoFinanceiro {
  data: string
  descricao: string
  tipo: 'entrada' | 'saida'
  forma: string
  valor: number
  cliente?: string
}

export async function buscarLancamentosDoMes(mes: number, ano: number): Promise<LancamentoFinanceiro[]> {
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`

  // Usa honorários dos contratos ativos como "entradas" do mês
  const { data: contratos } = await (supabase.from('contratos') as any)
    .select('*, clientes(nome)')
    .eq('status', 'ativo')

  const lancamentos: LancamentoFinanceiro[] = []
  for (const ct of (contratos ?? []) as Array<Contrato & { clientes?: { nome: string } | null }>) {
    if (!ct.valor_mensal) continue
    lancamentos.push({
      data: `${mesStr}-05`,
      descricao: `Honorário contábil — ${ct.titulo}`,
      tipo: 'entrada',
      forma: 'Transferência',
      valor: ct.valor_mensal,
      cliente: ct.clientes?.nome,
    })
  }

  return lancamentos.sort((a, b) => a.data.localeCompare(b.data))
}

export function imprimirRelatorioGerencial(
  mes: number,
  ano: number,
  lancamentos: LancamentoFinanceiro[]
) {
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const entradas = lancamentos.filter(l => l.tipo === 'entrada')
  const saidas = lancamentos.filter(l => l.tipo === 'saida')
  const totalEntradas = entradas.reduce((a, l) => a + l.valor, 0)
  const totalSaidas = saidas.reduce((a, l) => a + l.valor, 0)
  const saldo = totalEntradas - totalSaidas

  function tabelaLancamentos(lista: LancamentoFinanceiro[]) {
    if (lista.length === 0) return '<p style="color:#999;font-size:10px">Nenhum lançamento.</p>'
    return `
      <table>
        <tr><th>Data</th><th>Descrição</th><th>Cliente</th><th>Forma</th><th>Valor</th></tr>
        ${lista.map(l => `<tr>
          <td>${fmtDate(l.data)}</td>
          <td>${l.descricao}</td>
          <td>${l.cliente ?? '—'}</td>
          <td>${l.forma}</td>
          <td style="text-align:right;font-weight:600;color:${l.tipo === 'entrada' ? '#059669' : '#dc2626'}">${fmt(l.valor)}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td colspan="4"><strong>Total</strong></td>
          <td style="text-align:right"><strong>${fmt(lista.reduce((a, l) => a + l.valor, 0))}</strong></td>
        </tr>
      </table>
    `
  }

  const html = `
    ${headerHtml()}
    <div class="doc-title">Relatório Gerencial — ${MESES[mes - 1]} / ${ano}</div>

    <div class="section">
      <div class="section-title">Resumo do Mês</div>
      <div class="grid-3">
        <div class="field"><div class="field-label">Total Entradas</div><div class="field-value" style="font-size:14px;color:#059669;font-weight:900">${fmt(totalEntradas)}</div></div>
        <div class="field"><div class="field-label">Total Saídas</div><div class="field-value" style="font-size:14px;color:#dc2626;font-weight:900">${fmt(totalSaidas)}</div></div>
        <div class="field"><div class="field-label">Saldo do Mês</div><div class="field-value" style="font-size:14px;color:${saldo >= 0 ? '#059669' : '#dc2626'};font-weight:900">${fmt(saldo)}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Entradas</div>
      ${tabelaLancamentos(entradas)}
    </div>

    <div class="section">
      <div class="section-title">Saídas</div>
      ${tabelaLancamentos(saidas)}
    </div>

    ${footerHtml()}
  `
  abrirPrint(html)
}
