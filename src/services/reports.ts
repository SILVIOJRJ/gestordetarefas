// ─── Types ────────────────────────────────────────────────────

export type ModalidadeContrato =
  | 'Prestação de Serviços Contábeis'
  | 'Assessoria e Consultoria'
  | 'Sociedade em Conta de Participação (SCP)'

export type IndiceReajuste = 'IPCA' | 'IGPM' | 'Fixo'

export interface DadosSCP {
  socioOstensivo: string
  socioParticipante: string
  percentualResultados: number
  capitalizacaoOstensivo: number
  capitalizacaoParticipante: number
}

export interface ClausulaContrato {
  objeto: boolean
  limiteDocumentos: boolean
  multaClienteAtraso: boolean
  reajusteAnual: boolean
  vigencia: boolean
  foro: boolean
}

export interface DadosContrato {
  modalidade: ModalidadeContrato
  dataAssinatura: string
  vigenciaInicio: string
  vigenciaFim: string
  valorMensal: number
  diaVencimento: number
  indiceReajuste: IndiceReajuste
  percentualFixo?: number
  limiteNotasMensais: number
  multaAtraso: number
  foroComarca: string
  clausulas: ClausulaContrato
  scp?: DadosSCP
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtData(iso: string): string {
  if (!iso) return '___/___/______'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function extensoData(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Gerar HTML da Minuta ─────────────────────────────────────

export function gerarMinutaHtml(
  contrato: DadosContrato,
  cliente: { nome: string; cnpj?: string | null; responsavel?: string | null },
): string {
  const isSCP = contrato.modalidade === 'Sociedade em Conta de Participação (SCP)'
  const c = contrato.clausulas

  const clausulaObjeto = c.objeto ? `
    <div class="clausula">
      <p class="clausula-titulo">CLÁUSULA 1ª – DO OBJETO</p>
      <p>A CONTRATADA obriga-se a prestar à CONTRATANTE os serviços de ${contrato.modalidade.toLowerCase()},
      compreendendo: escrituração contábil, apuração de impostos e obrigações acessórias, elaboração de
      demonstrações financeiras e demais serviços inerentes à atividade contábil, conforme regime tributário
      aplicável e legislação vigente.</p>
    </div>` : ''

  const clausulaLimite = c.limiteDocumentos ? `
    <div class="clausula">
      <p class="clausula-titulo">CLÁUSULA – LIMITE DE DOCUMENTOS</p>
      <p>O valor mensal contratado abrange o processamento de até <strong>${contrato.limiteNotasMensais} (${contrato.limiteNotasMensais})
      documentos fiscais/mês</strong>. O volume excedente será cobrado proporcionalmente, mediante acordo prévio entre as partes.</p>
    </div>` : ''

  const clausulaMulta = c.multaClienteAtraso ? `
    <div class="clausula">
      <p class="clausula-titulo">CLÁUSULA – RESPONSABILIDADE POR ATRASO NA ENTREGA DE DOCUMENTOS</p>
      <p>A CONTRATANTE compromete-se a entregar todos os documentos necessários à execução dos serviços até o
      5º (quinto) dia útil de cada mês. O descumprimento deste prazo implica em multa de
      <strong>${contrato.multaAtraso}% (${contrato.multaAtraso} por cento)</strong> sobre o valor da mensalidade,
      além de isentar a CONTRATADA de responsabilidade por eventuais multas e penalidades decorrentes do
      atraso na entrega de obrigações acessórias ao Fisco.</p>
    </div>` : ''

  const reajusteDesc = contrato.indiceReajuste === 'Fixo'
    ? `reajuste fixo de ${contrato.percentualFixo ?? 0}% ao ano`
    : `variação acumulada do índice ${contrato.indiceReajuste} no período`

  const clausulaReajuste = c.reajusteAnual ? `
    <div class="clausula">
      <p class="clausula-titulo">CLÁUSULA – REAJUSTE ANUAL</p>
      <p>Os valores contratados serão reajustados anualmente, na data de aniversário do contrato, com base na
      <strong>${reajusteDesc}</strong>. O reajuste será comunicado à CONTRATANTE com antecedência mínima de 30 (trinta) dias.</p>
    </div>` : ''

  const clausulaVigencia = c.vigencia ? `
    <div class="clausula">
      <p class="clausula-titulo">CLÁUSULA – VIGÊNCIA</p>
      <p>O presente contrato vigorará por prazo ${contrato.vigenciaFim ? 'determinado' : 'indeterminado'},
      com início em <strong>${fmtData(contrato.vigenciaInicio)}</strong>${contrato.vigenciaFim ? ` e término em <strong>${fmtData(contrato.vigenciaFim)}</strong>` : ''},
      podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, por escrito.</p>
    </div>` : ''

  const clausulaForo = c.foro ? `
    <div class="clausula">
      <p class="clausula-titulo">CLÁUSULA – FORO</p>
      <p>Para dirimir quaisquer controvérsias oriundas do presente instrumento, as partes elegem o foro da
      Comarca de <strong>${contrato.foroComarca}</strong>, com renúncia expressa a qualquer outro, por mais
      privilegiado que seja.</p>
    </div>` : ''

  const secaoSCP = isSCP && contrato.scp ? `
    <div class="secao">
      <p class="secao-titulo">SOCIEDADE EM CONTA DE PARTICIPAÇÃO</p>
      <div class="clausula">
        <p class="clausula-titulo">CLÁUSULA – DA SOCIEDADE EM CONTA DE PARTICIPAÇÃO</p>
        <p>O presente instrumento formaliza a constituição de Sociedade em Conta de Participação (SCP),
        nos termos dos artigos 991 a 996 do Código Civil Brasileiro (Lei nº 10.406/2002), nos seguintes termos:</p>
        <table class="tabela-scp">
          <tr><th>Sócio Ostensivo</th><td>${contrato.scp.socioOstensivo}</td></tr>
          <tr><th>Sócio Participante</th><td>${contrato.scp.socioParticipante}</td></tr>
          <tr><th>Participação nos Resultados</th>
              <td>Ostensivo: ${100 - contrato.scp.percentualResultados}% | Participante: ${contrato.scp.percentualResultados}%</td></tr>
          <tr><th>Integralização – Sócio Ostensivo</th><td>${fmtMoeda(contrato.scp.capitalizacaoOstensivo)}</td></tr>
          <tr><th>Integralização – Sócio Participante</th><td>${fmtMoeda(contrato.scp.capitalizacaoParticipante)}</td></tr>
        </table>
        <p style="margin-top:12px">A existência da SCP é reservada aos sócios, não podendo ser invocada contra terceiros,
        sendo o Sócio Ostensivo o único que se obriga perante terceiros pelos atos e contratos praticados no exercício da atividade.</p>
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minuta de Contrato – ${contrato.modalidade}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
    }
    @media screen {
      body { padding: 20px; background: #e5e7eb; }
      .pagina { background: #fff; max-width: 210mm; margin: 0 auto; padding: 25mm 20mm; box-shadow: 0 4px 24px rgba(0,0,0,.15); }
    }
    @media print {
      body { margin: 0; background: #fff; }
      .pagina { padding: 20mm 20mm; }
    }
    .cabecalho { border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 16px; }
    .cabecalho-logo { width: 52px; height: 52px; background: #1e3a5f; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .cabecalho-logo span { color: #fff; font-size: 22pt; font-weight: bold; font-family: Arial, sans-serif; }
    .cabecalho-info h1 { font-size: 16pt; font-weight: bold; color: #1e3a5f; font-family: Arial, sans-serif; }
    .cabecalho-info p { font-size: 9pt; color: #555; margin-top: 2px; }
    .titulo-contrato { text-align: center; margin: 24px 0 20px; }
    .titulo-contrato h2 { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #1e3a5f; }
    .titulo-contrato p { font-size: 10pt; color: #555; margin-top: 4px; }
    .partes { border: 1px solid #c0c8d4; border-radius: 6px; padding: 16px; margin-bottom: 24px; background: #f8fafc; }
    .partes h3 { font-size: 10pt; font-weight: bold; color: #1e3a5f; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; font-family: Arial, sans-serif; }
    .parte { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
    .parte:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .parte-role { font-size: 9pt; font-weight: bold; color: #1e3a5f; text-transform: uppercase; }
    .parte-nome { font-size: 11pt; font-weight: bold; }
    .parte-detalhe { font-size: 9.5pt; color: #555; }
    .condicoes { border: 1px solid #c0c8d4; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; background: #f0f7ff; }
    .condicoes h3 { font-size: 10pt; font-weight: bold; color: #1e3a5f; text-transform: uppercase; margin-bottom: 8px; font-family: Arial, sans-serif; }
    .condicoes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; font-size: 10pt; }
    .cond-item strong { color: #1e3a5f; }
    .secao-titulo { font-size: 11pt; font-weight: bold; text-transform: uppercase; color: #1e3a5f; letter-spacing: .5px; border-bottom: 1px solid #c0c8d4; padding-bottom: 4px; margin: 24px 0 12px; font-family: Arial, sans-serif; }
    .clausula { margin-bottom: 14px; }
    .clausula-titulo { font-size: 10.5pt; font-weight: bold; margin-bottom: 4px; color: #1e3a5f; }
    .clausula p { text-align: justify; font-size: 11pt; }
    .tabela-scp { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5pt; }
    .tabela-scp th, .tabela-scp td { border: 1px solid #c0c8d4; padding: 6px 10px; text-align: left; }
    .tabela-scp th { background: #e8eff7; font-weight: bold; width: 45%; }
    .assinaturas { margin-top: 48px; page-break-inside: avoid; }
    .assinaturas-data { text-align: center; margin-bottom: 32px; font-size: 10.5pt; }
    .assinaturas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .ass-bloco { text-align: center; }
    .ass-linha { border-top: 1px solid #1a1a1a; padding-top: 6px; margin-top: 48px; font-size: 10pt; }
    .ass-nome { font-weight: bold; font-size: 10.5pt; }
    .ass-cargo { font-size: 9.5pt; color: #555; }
    .rodape { margin-top: 32px; border-top: 1px solid #c0c8d4; padding-top: 8px; text-align: center; font-size: 8pt; color: #888; }
  </style>
</head>
<body>
<div class="pagina">

  <!-- Cabeçalho / Timbrado -->
  <div class="cabecalho">
    <div class="cabecalho-logo"><span>N</span></div>
    <div class="cabecalho-info">
      <h1>Nascente Contábil Ltda</h1>
      <p>Rua das Flores, 123, Centro – Jacarezinho/PR – CEP 86.400-000</p>
      <p>CNPJ: 00.000.000/0001-00 &nbsp;|&nbsp; CRC/PR: 000000/O-0</p>
      <p>contato@nascentecontabil.com.br &nbsp;|&nbsp; (43) 9 9000-0000</p>
    </div>
  </div>

  <!-- Título -->
  <div class="titulo-contrato">
    <h2>Contrato de ${contrato.modalidade}</h2>
    <p>Instrumento Particular – Data de Assinatura: ${fmtData(contrato.dataAssinatura)}</p>
  </div>

  <!-- Das Partes -->
  <div class="partes">
    <h3>Das Partes Contratantes</h3>
    <div class="parte">
      <p class="parte-role">Contratante</p>
      <p class="parte-nome">${cliente.nome}</p>
      ${cliente.cnpj ? `<p class="parte-detalhe">CNPJ/CPF: ${cliente.cnpj}</p>` : ''}
      ${cliente.responsavel ? `<p class="parte-detalhe">Representante: ${cliente.responsavel}</p>` : ''}
    </div>
    <div class="parte">
      <p class="parte-role">Contratada</p>
      <p class="parte-nome">Nascente Contábil Ltda</p>
      <p class="parte-detalhe">CNPJ: 00.000.000/0001-00 | CRC/PR: 000000/O-0</p>
      <p class="parte-detalhe">Rua das Flores, 123, Centro – Jacarezinho/PR</p>
    </div>
  </div>

  <!-- Condições Gerais -->
  <div class="condicoes">
    <h3>Condições Comerciais</h3>
    <div class="condicoes-grid">
      <div class="cond-item"><strong>Valor Mensal:</strong> ${fmtMoeda(contrato.valorMensal)}</div>
      <div class="cond-item"><strong>Vencimento:</strong> Dia ${contrato.diaVencimento} de cada mês</div>
      <div class="cond-item"><strong>Início da Vigência:</strong> ${fmtData(contrato.vigenciaInicio)}</div>
      <div class="cond-item"><strong>Término:</strong> ${contrato.vigenciaFim ? fmtData(contrato.vigenciaFim) : 'Prazo Indeterminado'}</div>
      <div class="cond-item"><strong>Reajuste Anual:</strong> ${contrato.indiceReajuste === 'Fixo' ? `Fixo ${contrato.percentualFixo ?? 0}%` : contrato.indiceReajuste}</div>
      <div class="cond-item"><strong>Limite de Docs:</strong> ${contrato.limiteNotasMensais} documentos/mês</div>
    </div>
  </div>

  <!-- Cláusulas -->
  <p class="secao-titulo">Das Cláusulas e Condições</p>
  ${clausulaObjeto}
  ${clausulaLimite}
  ${clausulaMulta}
  ${clausulaReajuste}
  ${clausulaVigencia}
  ${clausulaForo}

  <!-- Seção SCP -->
  ${secaoSCP}

  <!-- Assinaturas -->
  <div class="assinaturas">
    <p class="assinaturas-data">
      ${contrato.foroComarca}, ${extensoData(contrato.dataAssinatura)}
    </p>
    <div class="assinaturas-grid">
      <div class="ass-bloco">
        <div class="ass-linha">
          <p class="ass-nome">${cliente.nome}</p>
          <p class="ass-cargo">CONTRATANTE</p>
          ${cliente.responsavel ? `<p class="ass-cargo">${cliente.responsavel}</p>` : ''}
        </div>
      </div>
      <div class="ass-bloco">
        <div class="ass-linha">
          <p class="ass-nome">Nascente Contábil Ltda</p>
          <p class="ass-cargo">CONTRATADA</p>
        </div>
      </div>
    </div>
  </div>

  <div class="rodape">
    Documento gerado pelo Portal Nascente Contábil – ${new Date().toLocaleDateString('pt-BR')} – MINUTA SUJEITA A REVISÃO JURÍDICA
  </div>

</div>
</body>
</html>`
}

// ─── Imprimir / PDF ───────────────────────────────────────────

export function imprimirMinuta(html: string): void {
  const newWindow = window.open('', '_blank')
  if (!newWindow) {
    alert('Permita pop-ups para gerar o PDF da minuta.')
    return
  }
  newWindow.document.open()
  newWindow.document.write(html)
  newWindow.document.close()
  newWindow.focus()
  setTimeout(() => { newWindow.print() }, 500)
}
