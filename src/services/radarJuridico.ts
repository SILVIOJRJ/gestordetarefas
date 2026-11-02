export type TipoNorma =
  | 'Lei Complementar'
  | 'Resolução CGSN'
  | 'Instrução Normativa'
  | 'Decisão STF'
  | 'Decisão STJ'
  | 'Portaria'
  | 'Emenda Constitucional'

export type RegimeImpactado =
  | 'Simples Nacional'
  | 'Lucro Presumido'
  | 'Lucro Real'
  | 'MEI'
  | 'Todos'

export interface AlertaJuridico {
  id: string
  titulo: string
  norma: string
  tipo: TipoNorma
  data: string
  regimesImpactados: RegimeImpactado[]
  cnaesImpactados: string[]
  impacto: string
  acaoPreventiva: string
  urgente: boolean
  tags: string[]
}

export const ALERTAS_JURIDICOS: AlertaJuridico[] = [
  {
    id: 'lc214-cbs-ibs',
    titulo: 'Reforma Tributária — CBS e IBS substituem PIS/Cofins e ICMS/ISS',
    norma: 'LC 214/2025',
    tipo: 'Lei Complementar',
    data: '2025-01-16',
    regimesImpactados: ['Todos'],
    cnaesImpactados: [],
    impacto:
      'A CBS (federal) substitui PIS/Cofins e o IBS (subnacional) substitui ICMS e ISS. Período de testes em 2026 com alíquotas reduzidas; transição plena de 2027 a 2033.',
    acaoPreventiva:
      'Mapear créditos de PIS/Cofins existentes, revisar precificação de produtos/serviços e acompanhar regulamentação complementar da CBS e do IBS para cada cliente.',
    urgente: true,
    tags: ['CBS', 'IBS', 'Reforma Tributária', 'PIS', 'Cofins', 'ICMS', 'ISS'],
  },
  {
    id: 'cgsn-175-sublimites-2025',
    titulo: 'Simples Nacional — Novos Sublimites Estaduais 2025',
    norma: 'Resolução CGSN 175/2024',
    tipo: 'Resolução CGSN',
    data: '2024-12-20',
    regimesImpactados: ['Simples Nacional', 'MEI'],
    cnaesImpactados: [],
    impacto:
      'Reajuste dos sublimites estaduais do Simples Nacional para recolhimento do ICMS/ISS no próprio Simples. Empresas com receita acima do sublimite passam a recolher ICMS/ISS fora do DAS.',
    acaoPreventiva:
      'Verificar o faturamento acumulado de cada cliente do Simples Nacional em relação ao novo sublimite estadual do Paraná e orientar sobre eventual separação do ICMS/ISS.',
    urgente: false,
    tags: ['Simples Nacional', 'sublimites', 'ICMS', 'ISS', 'DAS'],
  },
  {
    id: 'cgsn-176-simei-exclusao',
    titulo: 'CGSN 176/2025 — Extinção do SIMEI para Atividades de Risco',
    norma: 'Resolução CGSN 176/2025',
    tipo: 'Resolução CGSN',
    data: '2025-03-01',
    regimesImpactados: ['MEI'],
    cnaesImpactados: [],
    impacto:
      'Determinadas atividades consideradas de risco (construção civil pesada, transporte interestadual e atividades regulamentadas) foram excluídas do enquadramento como MEI/SIMEI, obrigando a migração para ME no Simples Nacional.',
    acaoPreventiva:
      'Identificar clientes MEI nessas atividades, antecipar o desenquadramento e planejar a migração para ME antes da data-limite para evitar exclusão de ofício e multas.',
    urgente: true,
    tags: ['MEI', 'SIMEI', 'exclusão', 'atividades de risco'],
  },
  {
    id: 'stf-adc84-icms-pis-cofins',
    titulo: 'STF ADC 84 — Extensão da Tese de Exclusão do ICMS do PIS/Cofins',
    norma: 'STF ADC 84',
    tipo: 'Decisão STF',
    data: '2025-04-10',
    regimesImpactados: ['Lucro Presumido', 'Lucro Real'],
    cnaesImpactados: [],
    impacto:
      'O STF estendeu a tese do RE 574.706 (exclusão do ICMS da base do PIS/Cofins) para outros tributos "de fora" como ISS e IPI sobre entradas, ampliando o direito a créditos e restituições.',
    acaoPreventiva:
      'Revisar apurações de PIS/Cofins dos últimos 5 anos para identificar possibilidade de pedido de restituição ou compensação do excesso recolhido sobre ISS e IPI.',
    urgente: false,
    tags: ['STF', 'PIS', 'Cofins', 'ICMS', 'exclusão', 'restituição', 'crédito'],
  },
  {
    id: 'in-rfb-2201-esocial-mei',
    titulo: 'IN RFB 2.201/2024 — eSocial Obrigatório para MEI com Empregado',
    norma: 'IN RFB 2.201/2024',
    tipo: 'Instrução Normativa',
    data: '2024-11-15',
    regimesImpactados: ['MEI', 'Simples Nacional'],
    cnaesImpactados: [],
    impacto:
      'MEIs com empregado doméstico ou CLT passam a ser obrigados ao eSocial para eventos de folha, férias, admissão e desligamento, com penalidades para envios em atraso.',
    acaoPreventiva:
      'Cadastrar imediatamente no eSocial os clientes MEI que possuem empregados, configurar rotina mensal de envio de eventos e orientar sobre as multas por omissão.',
    urgente: true,
    tags: ['eSocial', 'MEI', 'folha', 'empregado'],
  },
  {
    id: 'lc204-jcp-restricoes',
    titulo: 'LC 204/2023 — Restrições aos Juros sobre Capital Próprio (JCP)',
    norma: 'LC 204/2023',
    tipo: 'Lei Complementar',
    data: '2023-12-28',
    regimesImpactados: ['Lucro Real'],
    cnaesImpactados: [],
    impacto:
      'Vedação à dedução de JCP calculado sobre reservas de lucros e lucros acumulados de exercícios anteriores ao apurado, reduzindo significativamente o benefício fiscal para empresas do Lucro Real.',
    acaoPreventiva:
      'Reavaliar planejamento de distribuição de JCP para clientes do Lucro Real, quantificar o impacto na carga tributária e considerar alternativas de remuneração do capital.',
    urgente: false,
    tags: ['JCP', 'Lucro Real', 'IRPJ', 'CSLL', 'planejamento'],
  },
  {
    id: 'stj-resp-2024-irpj-selic',
    titulo: 'STJ — IRPJ/CSLL Incidem sobre Selic na Repetição de Indébito',
    norma: 'STJ REsp 1.945.110',
    tipo: 'Decisão STJ',
    data: '2025-02-20',
    regimesImpactados: ['Lucro Presumido', 'Lucro Real'],
    cnaesImpactados: [],
    impacto:
      'O STJ fixou que os juros Selic recebidos em restituições tributárias têm natureza de acréscimo patrimonial e compõem a base do IRPJ e da CSLL no período de recebimento.',
    acaoPreventiva:
      'Alertar clientes com pedidos de restituição ou compensação em curso sobre a tributação dos juros Selic recebidos e provisionar o imposto para evitar autuações.',
    urgente: true,
    tags: ['IRPJ', 'CSLL', 'Selic', 'restituição', 'STJ'],
  },
  {
    id: 'portaria-mte-3659-jornada-4x3',
    titulo: 'Portaria MTE 3.659/2024 — Regulamentação da Jornada 4x3',
    norma: 'Portaria MTE 3.659/2024',
    tipo: 'Portaria',
    data: '2024-12-05',
    regimesImpactados: ['Todos'],
    cnaesImpactados: [],
    impacto:
      'A portaria regulamentou a jornada 4x3 (4 dias trabalhados, 3 de folga) como modalidade opcional via acordo coletivo, impactando o cálculo de folha, banco de horas e encargos trabalhistas.',
    acaoPreventiva:
      'Informar clientes com sindicatos ativos sobre a possibilidade de negociação coletiva da jornada 4x3 e revisar contratos de trabalho e sistemas de ponto para adequação.',
    urgente: false,
    tags: ['jornada', 'folha', 'CLT', 'acordo coletivo', 'trabalhista'],
  },
  {
    id: 'ec132-reforma-constitucional',
    titulo: 'EC 132/2023 — Emenda Constitucional da Reforma Tributária',
    norma: 'EC 132/2023',
    tipo: 'Emenda Constitucional',
    data: '2023-12-21',
    regimesImpactados: ['Todos'],
    cnaesImpactados: [],
    impacto:
      'Base constitucional da Reforma Tributária que criou o IBS, CBS e o Imposto Seletivo, além do Fundo de Desenvolvimento Regional. Todas as empresas serão afetadas na transição 2026-2033.',
    acaoPreventiva:
      'Acompanhar a regulamentação por lei complementar (LC 214/2025 e seguintes) e iniciar diagnóstico de impacto por cliente, especialmente nos setores com ICMS diferenciado.',
    urgente: false,
    tags: ['EC 132', 'IBS', 'CBS', 'Imposto Seletivo', 'Reforma Tributária'],
  },
  {
    id: 'in-rfb-2180-dctfweb-todos',
    titulo: 'IN RFB 2.180/2024 — DCTFWeb Obrigatória para Todas as Empresas',
    norma: 'IN RFB 2.180/2024',
    tipo: 'Instrução Normativa',
    data: '2024-06-01',
    regimesImpactados: ['Todos'],
    cnaesImpactados: [],
    impacto:
      'A DCTFWeb passa a ser obrigatória para todas as empresas, inclusive Simples Nacional e MEI com empregado, substituindo a GFIP na confissão de débitos previdenciários.',
    acaoPreventiva:
      'Garantir que todos os clientes com folha de pagamento estejam emitindo DCTFWeb mensalmente, configurar o e-CAC e validar o cruzamento com o eSocial para evitar inconsistências.',
    urgente: true,
    tags: ['DCTFWeb', 'GFIP', 'folha', 'previdenciário', 'obrigação acessória'],
  },
  {
    id: 'cgsn-173-parcelamento-simples',
    titulo: 'CGSN 173/2024 — Parcelamento Especial de Débitos do Simples Nacional',
    norma: 'Resolução CGSN 173/2024',
    tipo: 'Resolução CGSN',
    data: '2024-08-30',
    regimesImpactados: ['Simples Nacional', 'MEI'],
    cnaesImpactados: [],
    impacto:
      'Abertura de programa especial de parcelamento de débitos do Simples Nacional e MEI com redução de multas e juros, com prazo limitado de adesão.',
    acaoPreventiva:
      'Identificar clientes do Simples Nacional e MEI com débitos em aberto, calcular o benefício do parcelamento especial e orientar a adesão antes do encerramento do prazo.',
    urgente: true,
    tags: ['parcelamento', 'Simples Nacional', 'MEI', 'débito', 'multa'],
  },
  {
    id: 'cgsn-174-tabelas-simples-2025',
    titulo: 'Resolução CGSN 174/2024 — Novas Tabelas do Simples Nacional 2025',
    norma: 'Resolução CGSN 174/2024',
    tipo: 'Resolução CGSN',
    data: '2024-12-15',
    regimesImpactados: ['Simples Nacional'],
    cnaesImpactados: [],
    impacto:
      'Atualização das tabelas e faixas de alíquotas do Simples Nacional para o exercício de 2025, com ajustes nas alíquotas efetivas dos Anexos I a V.',
    acaoPreventiva:
      'Recalcular a carga tributária estimada de todos os clientes do Simples Nacional com as novas tabelas e comunicar eventuais impactos no planejamento financeiro.',
    urgente: false,
    tags: ['Simples Nacional', 'alíquota', 'tabela', 'DAS', 'planejamento'],
  },
  {
    id: 'stf-re659412-iss-leasing',
    titulo: 'STF RE 659.412 — ISS Incide sobre Operações de Leasing',
    norma: 'STF RE 659.412',
    tipo: 'Decisão STF',
    data: '2025-01-28',
    regimesImpactados: ['Todos'],
    cnaesImpactados: ['64', '65', '66'],
    impacto:
      'O STF confirmou que o ISS incide sobre operações de leasing financeiro e operacional, com possibilidade de cobrança retroativa pelos municípios.',
    acaoPreventiva:
      'Avaliar clientes dos CNAEs 64, 65 e 66 (serviços financeiros) para verificar exposição ao ISS sobre leasing e provisionar eventuais contingências passivas.',
    urgente: false,
    tags: ['ISS', 'leasing', 'STF', 'serviços financeiros'],
  },
  {
    id: 'in-rfb-2198-nfe-prestadores',
    titulo: 'IN RFB 2.198/2024 — NF-e Obrigatória para Prestadores de Serviços',
    norma: 'IN RFB 2.198/2024',
    tipo: 'Instrução Normativa',
    data: '2024-10-01',
    regimesImpactados: ['Todos'],
    cnaesImpactados: [],
    impacto:
      'Obrigatoriedade de emissão de NF-e ou NFS-e para prestadores de serviços ainda não obrigados, com prazo escalonado por faturamento.',
    acaoPreventiva:
      'Identificar clientes prestadores de serviços que ainda emitem recibo ou nota manual e providenciar cadastro no sistema de NFS-e municipal ou NF-e conforme o caso.',
    urgente: true,
    tags: ['NF-e', 'NFS-e', 'obrigação acessória', 'prestador de serviços'],
  },
  {
    id: 'pgfn-1383-transacao-simples',
    titulo: 'Portaria PGFN 1.383/2024 — Transação Tributária para Simples Nacional',
    norma: 'Portaria PGFN 1.383/2024',
    tipo: 'Portaria',
    data: '2024-05-15',
    regimesImpactados: ['Simples Nacional', 'MEI'],
    cnaesImpactados: [],
    impacto:
      'Abertura de modalidade especial de transação tributária da PGFN exclusiva para optantes do Simples Nacional e MEI, com descontos progressivos conforme capacidade de pagamento.',
    acaoPreventiva:
      'Verificar clientes com dívidas na PGFN e avaliar a viabilidade da transação, comparando os descontos oferecidos com o custo financeiro da dívida.',
    urgente: false,
    tags: ['PGFN', 'transação', 'Simples Nacional', 'MEI', 'débito'],
  },
  {
    id: 'stj-tema1231-irpj-csll-selic',
    titulo: 'STJ Tema 1.231 — IRPJ e CSLL sobre Juros SELIC em Restituições',
    norma: 'STJ Tema 1.231',
    tipo: 'Decisão STJ',
    data: '2025-03-10',
    regimesImpactados: ['Lucro Presumido', 'Lucro Real'],
    cnaesImpactados: [],
    impacto:
      'Repetição de precedente consolidando que os juros Selic recebidos em qualquer restituição tributária são tributáveis pelo IRPJ e CSLL, com aplicação retroativa às compensações já realizadas.',
    acaoPreventiva:
      'Revisar todas as compensações e restituições com Selic recebidas nos últimos 5 anos, verificar se o IRPJ/CSLL foi recolhido e regularizar antes de eventual fiscalização.',
    urgente: true,
    tags: ['IRPJ', 'CSLL', 'Selic', 'restituição', 'compensação', 'STJ'],
  },
  {
    id: 'lc214-art382-cashback-ibs',
    titulo: 'LC 214/2025 Art. 382 — Cashback do IBS para Contribuintes de Baixa Renda',
    norma: 'LC 214/2025 art. 382',
    tipo: 'Lei Complementar',
    data: '2025-06-01',
    regimesImpactados: ['Todos'],
    cnaesImpactados: [],
    impacto:
      'Implementação do mecanismo de cashback do IBS para pessoas de baixa renda em setores como alimentos, energia elétrica e gás, impactando a precificação e a cadeia de consumo dos clientes.',
    acaoPreventiva:
      'Orientar clientes dos setores de consumo final (alimentação, varejo, energia) sobre o impacto do cashback na política de preços e no relacionamento com consumidores de baixa renda.',
    urgente: false,
    tags: ['IBS', 'cashback', 'baixa renda', 'consumo', 'Reforma Tributária'],
  },
  {
    id: 'in-rfb-2219-efinanceira',
    titulo: 'IN RFB 2.219/2025 — e-Financeira: Reforço nas Obrigações de Informação',
    norma: 'IN RFB 2.219/2025',
    tipo: 'Instrução Normativa',
    data: '2025-05-20',
    regimesImpactados: ['Lucro Real', 'Lucro Presumido'],
    cnaesImpactados: [],
    impacto:
      'Ampliação do escopo da e-Financeira para incluir novas operações financeiras obrigatórias, com redução dos limites mínimos de declaração e penalidades elevadas por omissão.',
    acaoPreventiva:
      'Revisar com clientes do Lucro Real e Presumido todas as operações financeiras sujeitas à e-Financeira e garantir entrega correta e tempestiva das informações ampliadas.',
    urgente: true,
    tags: ['e-Financeira', 'obrigação acessória', 'Lucro Real', 'Lucro Presumido', 'sigilo financeiro'],
  },
]

// ─── Análise de impacto por cliente ───────────────────────────

export interface AlertaComClientes extends AlertaJuridico {
  clientesAfetados: Array<{ id: string; nome: string }>
}

export function analisarClientes(
  clientes: Array<{ id: string; nome: string; regime: string | null; cnae?: string | null }>,
): AlertaComClientes[] {
  const resultado: AlertaComClientes[] = []

  for (const alerta of ALERTAS_JURIDICOS) {
    const afetados = clientes.filter((c) => {
      const regimeOk =
        alerta.regimesImpactados.includes('Todos') ||
        (c.regime !== null && alerta.regimesImpactados.includes(c.regime as RegimeImpactado))

      const cnaeOk =
        alerta.cnaesImpactados.length === 0 ||
        (c.cnae != null &&
          alerta.cnaesImpactados.some((prefixo) => (c.cnae as string).startsWith(prefixo)))

      return regimeOk && cnaeOk
    })

    if (afetados.length > 0) {
      resultado.push({
        ...alerta,
        clientesAfetados: afetados.slice(0, 5).map((c) => ({ id: c.id, nome: c.nome })),
      })
    }
  }

  return resultado.sort((a, b) => {
    if (a.urgente !== b.urgente) return a.urgente ? -1 : 1
    return b.data.localeCompare(a.data)
  })
}
