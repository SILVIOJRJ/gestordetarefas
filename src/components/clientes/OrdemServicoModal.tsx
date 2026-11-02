'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente, Setor } from '@/types/database.types'
import {
  X, Printer, CheckSquare, Loader2, ClipboardCheck, AlertTriangle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────

type TipoAtendimento = 'Abertura de Empresa (CNPJ)' | 'Transferência' | 'CAEPF' | 'eSocial Doméstica (CEI)'
type StatusDados     = 'Cliente possui todos os dados' | 'Escritório fará a pesquisa/abertura do zero'

interface TarefaTemplate { setor: Setor; titulo: string; diasPrazo: number }

// ─── Templates de tarefas por tipo de atendimento ─────────────

const TAREFAS_POR_TIPO: Record<TipoAtendimento, TarefaTemplate[]> = {
  'Abertura de Empresa (CNPJ)': [
    { setor: 'Legalização',  titulo: 'Abertura de CNPJ',                        diasPrazo: 30 },
    { setor: 'Fiscal',       titulo: 'Configuração Tributária e Regimes Fiscais', diasPrazo: 15 },
    { setor: 'RH',           titulo: 'Cadastro Departamento Pessoal e eSocial',   diasPrazo: 15 },
    { setor: 'Gerencial',    titulo: 'Onboarding Contábil — Abertura de Livros',  diasPrazo: 20 },
  ],
  'Transferência': [
    { setor: 'Legalização',  titulo: 'Transferência de Responsabilidade Técnica', diasPrazo: 20 },
    { setor: 'Fiscal',       titulo: 'Migração Fiscal e Recadastramento',          diasPrazo: 10 },
    { setor: 'RH',           titulo: 'Migração Departamento Pessoal',              diasPrazo: 10 },
    { setor: 'Gerencial',    titulo: 'Reconstrução de Histórico Contábil',         diasPrazo: 30 },
  ],
  'CAEPF': [
    { setor: 'Legalização',  titulo: 'Inscrição CAEPF junto à Receita Federal',   diasPrazo: 15 },
    { setor: 'Fiscal',       titulo: 'Configuração Fiscal CAEPF',                  diasPrazo: 10 },
  ],
  'eSocial Doméstica (CEI)': [
    { setor: 'RH',           titulo: 'Cadastro e Configuração eSocial Doméstico',  diasPrazo: 10 },
  ],
}

// ─── Gerador HTML da OS ───────────────────────────────────────

function gerarHtmlOS(params: {
  cliente: Cliente
  tipo: TipoAtendimento
  statusDados: StatusDados
  honorarioInstalacao: number
  honorarioMensal: number
  numeroOS: string
  dataEmissao: string
}): string {
  const { cliente, tipo, statusDados, honorarioInstalacao, honorarioMensal, numeroOS, dataEmissao } = params
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dataFmt = new Date(dataEmissao + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>OS Nº ${numeroOS}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; }
    .page { max-width: 750px; margin: 0 auto; padding: 32px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 18px; }
    .logo-block h1 { font-size: 17pt; font-weight: 800; color: #1e3a5f; }
    .logo-block p  { font-size: 8pt; color: #555; }
    .os-block { text-align: right; }
    .os-block .os-num  { font-size: 13pt; font-weight: 700; color: #1e3a5f; }
    .os-block .os-date { font-size: 9pt; color: #777; margin-top: 2px; }
    h2 { font-size: 10pt; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: .05em;
         border-bottom: 1px solid #dde3ea; padding-bottom: 4px; margin: 16px 0 8px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 6px; }
    .field label { font-size: 8pt; color: #888; display: block; margin-bottom: 1px; }
    .field span  { font-size: 10pt; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 8.5pt;
             font-weight: 700; background: #e8f0fe; color: #1a56db; }
    .honor-row { display: flex; justify-content: space-between; align-items: center;
                 padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; }
    .honor-row.instalacao { background: #fff8e1; border: 1px solid #fde68a; }
    .honor-row.mensal     { background: #e8f5e9; border: 1px solid #a7f3d0; }
    .honor-label { font-size: 9pt; color: #555; }
    .honor-value { font-size: 13pt; font-weight: 800; color: #1a1a1a; }
    .termo { background: #f7f9fc; border-left: 3px solid #1e3a5f; padding: 8px 12px;
             border-radius: 0 6px 6px 0; margin-bottom: 8px; font-size: 9pt; color: #333; line-height: 1.5; }
    .termo strong { display: block; font-size: 9pt; font-weight: 700; color: #1e3a5f; margin-bottom: 3px; }
    .aviso { background: #fff3cd; border: 1px solid #fde68a; border-radius: 6px;
             padding: 8px 12px; font-size: 9pt; color: #856404; margin-bottom: 6px; line-height: 1.5; }
    .aviso strong { color: #92400e; }
    .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; }
    .sig-line { border-top: 1px solid #888; padding-top: 5px; text-align: center; font-size: 8.5pt; color: #555; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #dde3ea;
              font-size: 7.5pt; color: #aaa; text-align: center; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { padding: 16px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Cabeçalho -->
  <div class="header">
    <div class="logo-block">
      <h1>NASCENTE CONTÁBIL</h1>
      <p>Assessoria e Consultoria Contábil Ltda</p>
      <p>CNPJ: 00.000.000/0001-00 · CRC/PR 0000000</p>
      <p>Jacarezinho/PR · (43) 0000-0000</p>
    </div>
    <div class="os-block">
      <div class="os-num">OS Nº ${numeroOS}</div>
      <div class="os-date">Emitida em ${dataFmt}</div>
    </div>
  </div>

  <h2>1. Identificação do Contratante</h2>
  <div class="grid2">
    <div class="field"><label>Razão Social / Nome</label><span>${cliente.nome}</span></div>
    <div class="field"><label>CNPJ / CPF</label><span>${cliente.cnpj ?? 'A definir'}</span></div>
    <div class="field"><label>Regime Tributário</label><span>${cliente.regime ?? 'A definir'}</span></div>
    <div class="field"><label>Responsável</label><span>${cliente.responsavel ?? '—'}</span></div>
    <div class="field"><label>E-mail</label><span>${cliente.email ?? '—'}</span></div>
    <div class="field"><label>Telefone / WhatsApp</label><span>${cliente.telefone ?? '—'}</span></div>
    ${cliente.municipio ? `<div class="field"><label>Município</label><span>${cliente.municipio}</span></div>` : ''}
  </div>

  <h2>2. Tipo de Atendimento</h2>
  <div style="margin-bottom:8px">
    <span class="badge">${tipo}</span>
  </div>
  <div class="field" style="margin-bottom:6px">
    <label>Status dos Dados do Cliente</label>
    <span style="font-size:10pt">${statusDados}</span>
  </div>

  <h2>3. Honorários</h2>
  <div class="honor-row instalacao">
    <span class="honor-label">⚡ Honorário de Instalação / Custo Inicial (pago na assinatura)</span>
    <span class="honor-value">${fmtBRL(honorarioInstalacao)}</span>
  </div>
  <div class="honor-row mensal">
    <span class="honor-label">📅 Honorário Mensal Recorrente</span>
    <span class="honor-value">${fmtBRL(honorarioMensal)}</span>
  </div>

  <h2>4. Termos e Condições</h2>

  <div class="termo">
    <strong>4.1 Termo de Ciência de Prazos e Responsabilidade Mútua</strong>
    O CONTRATANTE declara ter ciência de que os prazos legais e administrativos junto aos órgãos públicos
    (Junta Comercial, Receita Federal, SEFAZ, Prefeitura e demais) dependem de fatores externos ao controle
    do ESCRITÓRIO, incluindo demandas, greves e sistemas indisponíveis. O CONTRATANTE compromete-se a fornecer
    todos os documentos e informações solicitados no prazo máximo de <strong>5 (cinco) dias úteis</strong>,
    sob pena de suspensão do atendimento sem desconto dos honorários.
  </div>

  <div class="termo">
    <strong>4.2 Termo de Entrega de Acessos e Procurações</strong>
    Para execução dos serviços, o CONTRATANTE autoriza o ESCRITÓRIO a utilizar as credenciais de acesso
    ao portal <strong>Gov.BR</strong>, emitir e gerenciar <strong>Procurações Eletrônicas</strong>
    junto à Receita Federal (e-CAC), e operar senhas fiscais (Estaduais e Municipais) em nome da empresa
    contratante, exclusivamente para fins contábeis e fiscais. Os acessos são de uso restrito ao escritório
    e não serão compartilhados com terceiros.
  </div>

  <div class="aviso">
    <strong>⚠️ 4.3 Aviso de Custeio — Taxas de Órgãos Públicos</strong><br>
    Os honorários contratados cobrem exclusivamente a prestação de serviços contábeis, administrativos e de
    assessoria do ESCRITÓRIO. <strong>Taxas, emolumentos e custas de órgãos públicos</strong>
    (DARFs, DAREs, taxas da Junta Comercial, taxas municipais de alvará, DARE-SP, guias de licenciamento,
    reconhecimentos em cartório e similares) <strong>NÃO estão inclusos</strong> nos honorários e são
    de custeio exclusivo do CONTRATANTE, mediante apresentação de guia pelo ESCRITÓRIO.
  </div>

  <!-- Assinaturas -->
  <div class="sigs">
    <div class="sig-line">
      ___________________________________<br>
      <strong>${cliente.nome}</strong><br>
      CONTRATANTE
    </div>
    <div class="sig-line">
      ___________________________________<br>
      <strong>Nascente Contábil Ltda</strong><br>
      CONTRATADA · CRC/PR 0000000
    </div>
  </div>

  <div class="footer">
    OS Nº ${numeroOS} · Emitida pelo Sistema de Gestão Nascente Contábil · ${dataFmt}
  </div>

</div>
</body>
</html>`
}

// ─── Props ────────────────────────────────────────────────────

interface Props {
  cliente: Cliente
  onClose: () => void
  onFinalizado?: () => void
}

// ─── Component ────────────────────────────────────────────────

export default function OrdemServicoModal({ cliente, onClose, onFinalizado }: Props) {
  const [tipo, setTipo]           = useState<TipoAtendimento>('Abertura de Empresa (CNPJ)')
  const [statusDados, setStatus]  = useState<StatusDados>('Cliente possui todos os dados')
  const [honInstal, setHonInstal] = useState(500)
  const [honMensal, setHonMensal] = useState(350)
  const [emitindo, setEmitindo]   = useState(false)
  const [sucesso, setSucesso]     = useState(false)
  const [erro, setErro]           = useState<string | null>(null)
  const [tarefasCriadas, setTarefasCriadas] = useState(0)

  const numeroOS   = `OS${Date.now().toString().slice(-8)}`
  const dataEmissao = new Date().toISOString().slice(0, 10)

  function imprimirOS() {
    const html = gerarHtmlOS({ cliente, tipo, statusDados, honorarioInstalacao: honInstal, honorarioMensal: honMensal, numeroOS, dataEmissao })
    const w = window.open('', '_blank', 'width=820,height=1000')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  async function finalizarOS() {
    setEmitindo(true); setErro(null)
    try {
      // 1. Atualiza status do cliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('clientes') as any)
        .update({ status_onboarding: 'Em Processo de Onboarding' })
        .eq('id', cliente.id)

      // 2. Cria tarefas para os setores correspondentes
      const templates = TAREFAS_POR_TIPO[tipo]
      const hoje = new Date()

      const payloads = templates.map(t => {
        const prazo = new Date(hoje)
        prazo.setDate(prazo.getDate() + t.diasPrazo)
        return {
          titulo:                 `[Onboarding] ${t.titulo} — ${cliente.nome}`,
          setor:                  t.setor,
          cliente_id:             cliente.id,
          prioridade:             'Alta' as const,
          status:                 'Pendente' as const,
          prazo:                  prazo.toISOString().slice(0, 10),
          responsaveis_conjuntos: [] as string[],
          descricao:              `Tarefa gerada automaticamente pela OS Nº ${numeroOS}\nTipo: ${tipo}\nStatus dos dados: ${statusDados}\nHonorário instalação: R$ ${honInstal.toFixed(2)}\nHonorário mensal: R$ ${honMensal.toFixed(2)}`,
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: taskErr, data: tarefasData } = await (supabase.from('tarefas') as any)
        .insert(payloads)
        .select('id')

      if (taskErr) throw taskErr

      setTarefasCriadas((tarefasData as { id: string }[]).length)
      setSucesso(true)

      // Imprime automaticamente ao finalizar
      imprimirOS()

      onFinalizado?.()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao finalizar OS.')
    } finally {
      setEmitindo(false)
    }
  }

  const tarefasPreview = TAREFAS_POR_TIPO[tipo]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-brand-950/60 overflow-y-auto py-4 px-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={20} className="text-brand-700" />
            <div>
              <h2 className="font-bold text-brand-900">Ordem de Serviço</h2>
              <p className="text-xs text-brand-500">{cliente.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-100 text-brand-400">
            <X size={18} />
          </button>
        </div>

        {sucesso ? (
          /* ── Confirmação ── */
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-accent-100 flex items-center justify-center mx-auto">
              <CheckSquare size={26} className="text-accent-600" />
            </div>
            <h3 className="text-lg font-bold text-brand-900">OS emitida com sucesso!</h3>
            <p className="text-sm text-brand-600">
              O cliente foi marcado como <strong>Em Processo de Onboarding</strong> e{' '}
              <strong>{tarefasCriadas} tarefa{tarefasCriadas !== 1 ? 's' : ''}</strong> foram criadas
              nos setores correspondentes com prioridade <span className="text-red-600 font-semibold">Alta</span>.
            </p>
            <div className="text-xs text-brand-400">A OS foi aberta para impressão em nova aba.</div>
            <button onClick={onClose} className="btn-primary mx-auto">Fechar</button>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {/* Tipo de Atendimento */}
            <div>
              <label className="input-label">Tipo de Atendimento *</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(['Abertura de Empresa (CNPJ)', 'Transferência', 'CAEPF', 'eSocial Doméstica (CEI)'] as TipoAtendimento[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      tipo === t
                        ? 'bg-brand-900 text-white border-brand-900'
                        : 'bg-white text-brand-700 border-brand-200 hover:border-brand-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Status dos Dados */}
            <div>
              <label className="input-label">Status dos Dados</label>
              <div className="grid grid-cols-1 gap-2 mt-1">
                {(['Cliente possui todos os dados', 'Escritório fará a pesquisa/abertura do zero'] as StatusDados[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      statusDados === s
                        ? 'bg-accent-600 text-white border-accent-600'
                        : 'bg-white text-brand-700 border-brand-200 hover:border-accent-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Honorários */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Honorário de Instalação (R$)</label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  className="input"
                  value={honInstal}
                  onChange={e => setHonInstal(Number(e.target.value))}
                />
                <p className="text-[11px] text-brand-400 mt-1">Cobrado na assinatura / entrada</p>
              </div>
              <div>
                <label className="input-label">Honorário Mensal (R$)</label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  className="input"
                  value={honMensal}
                  onChange={e => setHonMensal(Number(e.target.value))}
                />
                <p className="text-[11px] text-brand-400 mt-1">Recorrente após início dos serviços</p>
              </div>
            </div>

            {/* Preview de tarefas que serão criadas */}
            <div className="bg-brand-50 rounded-xl p-4 border border-brand-200">
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide mb-2">
                Tarefas que serão criadas automaticamente
              </p>
              <ul className="space-y-1.5">
                {tarefasPreview.map(t => (
                  <li key={t.setor + t.titulo} className="flex items-center gap-2 text-sm text-brand-700">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                      t.setor === 'Legalização' ? 'bg-purple-100 text-purple-700'
                      : t.setor === 'Fiscal'    ? 'bg-blue-100 text-blue-700'
                      : t.setor === 'RH'        ? 'bg-green-100 text-green-700'
                      : 'bg-brand-100 text-brand-600'
                    }`}>{t.setor}</span>
                    <span className="flex-1">{t.titulo} — {cliente.nome}</span>
                    <span className="text-[10px] text-brand-400">{t.diasPrazo}d</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-brand-400 mt-2">
                Todas com prioridade <strong className="text-red-600">Alta</strong> · Status inicial: <strong>Pendente</strong>
              </p>
            </div>

            {/* Aviso de custeio resumido */}
            <div className="flex gap-2 bg-warning-50 border border-warning-200 rounded-xl px-3 py-2.5">
              <AlertTriangle size={15} className="text-warning-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning-700">
                <strong>Aviso de custeio:</strong> A OS incluirá cláusula informando que taxas de órgãos públicos
                (DARFs, DAREs, taxas da Junta, alvarás) <strong>não estão inclusos</strong> nos honorários.
              </p>
            </div>

            {erro && (
              <p className="text-sm text-danger-600 bg-danger-50 px-3 py-2 rounded-lg flex items-center gap-2">
                <AlertTriangle size={14} /> {erro}
              </p>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={imprimirOS}
                className="btn-secondary flex-1"
              >
                <Printer size={14} /> Visualizar / Imprimir OS
              </button>
              <button
                onClick={finalizarOS}
                disabled={emitindo}
                className="btn-primary flex-1"
              >
                {emitindo
                  ? <><Loader2 size={14} className="animate-spin" /> Finalizando...</>
                  : <><CheckSquare size={14} /> Finalizar e Gerar Tarefas</>}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
