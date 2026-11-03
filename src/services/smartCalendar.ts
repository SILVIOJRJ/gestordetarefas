// ─── Tipos ────────────────────────────────────────────────────

export type TipoEvento =
  | 'obrigacao'
  | 'prazo_tributario'
  | 'reforma'
  | 'feriado_nacional'
  | 'feriado_municipal'
  | 'tarefa'

export type EventoCalendario = {
  data: string
  titulo: string
  tipo: TipoEvento
  setor?: string
  municipio?: string
  urgente?: boolean
  descricao?: string
}

// ─── Páscoa (Meeus/Jones/Butcher) ─────────────────────────────

function calcularPascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

function addDias(data: Date, dias: number): Date {
  const d = new Date(data)
  d.setDate(d.getDate() + dias)
  return d
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function makeDate(ano: number, mes: number, dia: number): Date {
  return new Date(ano, mes - 1, dia)
}

// ─── Feriados nacionais ────────────────────────────────────────

export function feriadosNacionais(ano: number): EventoCalendario[] {
  const pascoa = calcularPascoa(ano)
  const eventos: EventoCalendario[] = [
    { data: `${ano}-01-01`, titulo: 'Confraternização Universal (Ano Novo)', tipo: 'feriado_nacional' },
    { data: isoDate(addDias(pascoa, -47)), titulo: 'Carnaval', tipo: 'feriado_nacional' },
    { data: isoDate(addDias(pascoa, -48)), titulo: 'Carnaval (segunda)', tipo: 'feriado_nacional' },
    { data: isoDate(addDias(pascoa, -2)), titulo: 'Sexta-feira Santa', tipo: 'feriado_nacional' },
    { data: `${ano}-04-21`, titulo: 'Tiradentes', tipo: 'feriado_nacional' },
    { data: `${ano}-05-01`, titulo: 'Dia do Trabalho', tipo: 'feriado_nacional' },
    { data: isoDate(addDias(pascoa, 60)), titulo: 'Corpus Christi', tipo: 'feriado_nacional' },
    { data: `${ano}-09-07`, titulo: 'Independência do Brasil', tipo: 'feriado_nacional' },
    { data: `${ano}-10-12`, titulo: 'Nossa Senhora Aparecida', tipo: 'feriado_nacional' },
    { data: `${ano}-11-02`, titulo: 'Finados', tipo: 'feriado_nacional' },
    { data: `${ano}-11-15`, titulo: 'Proclamação da República', tipo: 'feriado_nacional' },
    { data: `${ano}-11-20`, titulo: 'Consciência Negra', tipo: 'feriado_nacional' },
    { data: `${ano}-12-25`, titulo: 'Natal', tipo: 'feriado_nacional' },
  ]
  return eventos
}

// ─── Feriados municipais ──────────────────────────────────────

export function feriadosMunicipais(ano: number): EventoCalendario[] {
  return [
    // Jacarezinho-PR
    { data: `${ano}-01-20`, titulo: 'São Sebastião', tipo: 'feriado_municipal', municipio: 'Jacarezinho-PR' },
    { data: `${ano}-03-05`, titulo: 'Aniversário de Jacarezinho', tipo: 'feriado_municipal', municipio: 'Jacarezinho-PR' },
    { data: `${ano}-08-15`, titulo: 'Nossa Senhora das Graças', tipo: 'feriado_municipal', municipio: 'Jacarezinho-PR' },
    // Ourinhos-SP
    { data: `${ano}-04-24`, titulo: 'Aniversário de Ourinhos', tipo: 'feriado_municipal', municipio: 'Ourinhos-SP' },
    { data: `${ano}-06-13`, titulo: 'Santo Antônio', tipo: 'feriado_municipal', municipio: 'Ourinhos-SP' },
    // Cambará-PR
    { data: `${ano}-01-20`, titulo: 'São Sebastião', tipo: 'feriado_municipal', municipio: 'Cambará-PR' },
    { data: `${ano}-05-14`, titulo: 'Aniversário de Cambará', tipo: 'feriado_municipal', municipio: 'Cambará-PR' },
    // Andirá-PR
    { data: `${ano}-02-02`, titulo: 'N.Sra. Navegantes', tipo: 'feriado_municipal', municipio: 'Andirá-PR' },
    { data: `${ano}-09-15`, titulo: 'Aniversário de Andirá', tipo: 'feriado_municipal', municipio: 'Andirá-PR' },
  ]
}

// ─── Próximo dia útil ─────────────────────────────────────────

export function proximoDiaUtil(data: Date, feriados: string[]): Date {
  let d = new Date(data)
  while (d.getDay() === 0 || d.getDay() === 6 || feriados.includes(isoDate(d))) {
    d = addDias(d, 1)
  }
  return d
}

function ultimoDiaUtilMes(ano: number, mes: number, feriados: string[]): Date {
  // último dia do mês
  const ultimo = new Date(ano, mes, 0) // dia 0 do próximo mês = último dia deste
  // retrocede se fim de semana/feriado
  let d = new Date(ultimo)
  while (d.getDay() === 0 || d.getDay() === 6 || feriados.includes(isoDate(d))) {
    d = addDias(d, -1)
  }
  return d
}

// ─── Obrigações fiscais ────────────────────────────────────────

export function obrigacoesFiscais(ano: number, mes: number): EventoCalendario[] {
  const nacionais = feriadosNacionais(ano).map(e => e.data)
  const municipais = feriadosMunicipais(ano).map(e => e.data)
  const feriados = [...nacionais, ...municipais]
  const eventos: EventoCalendario[] = []

  function add(d: Date, titulo: string, setor: string, urgente?: boolean, descricao?: string) {
    const du = proximoDiaUtil(d, feriados)
    eventos.push({ data: isoDate(du), titulo, tipo: 'obrigacao', setor, urgente, descricao })
  }

  // PGMEI — dia 20
  add(makeDate(ano, mes, 20), 'PGMEI — Pagamento mensal MEI', 'Fiscal')

  // DAS Simples Nacional — dia 20
  add(makeDate(ano, mes, 20), 'DAS — Simples Nacional', 'Fiscal')

  // IRRF — dia 20
  add(makeDate(ano, mes, 20), 'IRRF — Retenção na fonte', 'Fiscal')

  // DCTFWeb — dia 15
  add(makeDate(ano, mes, 15), 'DCTFWeb — Declaração de Débitos e Créditos Tributários', 'Fiscal')

  // FGTS — dia 7
  add(makeDate(ano, mes, 7), 'FGTS — Recolhimento mensal', 'RH')

  // GFIP/eSocial competência mês anterior — dia 7
  add(makeDate(ano, mes, 7), 'GFIP / eSocial DCTFWeb — Competência mês anterior', 'RH')

  // SPED Fiscal (EFD ICMS/IPI) — dia 25
  add(makeDate(ano, mes, 25), 'EFD ICMS/IPI — SPED Fiscal', 'Fiscal')

  // EFD Contribuições — dia 10 do mês seguinte
  const mesSeguinte = mes === 12 ? 1 : mes + 1
  const anoSeguinte = mes === 12 ? ano + 1 : ano
  add(makeDate(anoSeguinte, mesSeguinte, 10), 'EFD Contribuições (PIS/Cofins)', 'Fiscal')

  // Obrigações específicas por mês
  if (mes === 1) {
    // Simples Nacional — opção/enquadramento
    add(makeDate(ano, 1, 31), 'Simples Nacional — Opção/Enquadramento/Desenquadramento', 'Fiscal',
      true, 'Última data para optantes ou para exclusão voluntária do Simples Nacional')
  }

  if (mes === 2) {
    // DMed — último dia útil de fevereiro
    const dmed = ultimoDiaUtilMes(ano, 2, feriados)
    eventos.push({ data: isoDate(dmed), titulo: 'DMed — Declaração de Serviços Médicos e de Saúde', tipo: 'prazo_tributario', setor: 'Fiscal', urgente: true, descricao: 'Obrigação anual: último dia útil de fevereiro' })

    // DIRF — 28 de fevereiro
    add(makeDate(ano, 2, 28), 'DIRF — Declaração do Imposto de Renda Retido na Fonte', 'Fiscal',
      true, 'Entrega anual da DIRF à Receita Federal')
  }

  if (mes === 5) {
    // DASN-Simei — 31 de maio
    add(makeDate(ano, 5, 31), 'DASN-Simei — Declaração Anual do Simples Nacional (MEI)', 'Fiscal',
      false, 'Entrega anual obrigatória para MEIs')
  }

  if (mes === 7) {
    // ECF — último dia útil de julho
    const ecf = ultimoDiaUtilMes(ano, 7, feriados)
    eventos.push({ data: isoDate(ecf), titulo: 'ECF — Escrituração Contábil Fiscal (IRPJ/CSLL)', tipo: 'prazo_tributario', setor: 'Fiscal', urgente: true, descricao: 'Último dia útil de julho — Lucro Real/Presumido' })
  }

  return eventos
}

// ─── Marcos da Reforma Tributária ─────────────────────────────

export function marcosReformaTributaria(ano: number): EventoCalendario[] {
  const todos: EventoCalendario[] = [
    {
      data: '2026-01-01',
      titulo: 'CBS/IBS — Início do período de teste',
      tipo: 'reforma',
      urgente: true,
      descricao: 'Alíquotas reduzidas de CBS e IBS entram em vigor para o período de apuração de testes (LC 214/2025)',
    },
    {
      data: '2026-12-31',
      titulo: 'CBS/IBS — Fim do período de apuração de testes',
      tipo: 'reforma',
      descricao: 'Encerramento do exercício fiscal de transição CBS/IBS; contribuintes devem registrar créditos acumulados',
    },
    {
      data: '2027-01-01',
      titulo: 'IBS/CBS — Vigência plena fase 1',
      tipo: 'reforma',
      urgente: true,
      descricao: 'Primeira fase de alíquotas definitivas; PIS/Cofins ainda coexistem até 2033',
    },
    {
      data: '2033-01-01',
      titulo: 'Extinção do PIS/Cofins — substituição plena CBS',
      tipo: 'reforma',
      urgente: true,
      descricao: 'PIS e Cofins deixam de existir; CBS substitui integralmente (LC 214/2025, art. 330)',
    },
    {
      data: '2033-01-01',
      titulo: 'Extinção do ICMS/ISS — substituição plena IBS',
      tipo: 'reforma',
      urgente: true,
      descricao: 'ICMS e ISS são extintos; IBS assume competência estadual/municipal (LC 214/2025)',
    },
  ]
  return todos.filter(e => e.data.startsWith(`${ano}-`))
}

// ─── Calendário completo ──────────────────────────────────────

export function calendarioCompleto(ano: number, mes: number): EventoCalendario[] {
  const prefix = `${ano}-${String(mes).padStart(2, '0')}-`

  const nacionais = feriadosNacionais(ano).filter(e => e.data.startsWith(prefix))
  const municipais = feriadosMunicipais(ano).filter(e => e.data.startsWith(prefix))
  const obrigacoes = obrigacoesFiscais(ano, mes).filter(e => e.data.startsWith(prefix))
  const reforma = marcosReformaTributaria(ano).filter(e => e.data.startsWith(prefix))

  const todos = [...nacionais, ...municipais, ...obrigacoes, ...reforma]
  todos.sort((a, b) => a.data.localeCompare(b.data))
  return todos
}
