// ============================================================
// database.types.ts — Schema unificado gestordetarefas + microsasesc
// Gerado a partir de schema.sql e migrations/*.sql
// ============================================================

// ─── Enums ───────────────────────────────────────────────────

export type Prioridade = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export type StatusTarefa =
  | 'Pendente'
  | 'Em andamento'
  | 'Aguardando'
  | 'Concluída'
  | 'Cancelada';

export type StatusProcesso =
  | 'Pendente'
  | 'Em andamento'
  | 'Aguardando'
  | 'Concluído'
  | 'Cancelado';

export type TipoAtoProcesso =
  | 'Abertura'
  | 'Alteração Contratual'
  | 'Consolidação'
  | 'Baixa'
  | 'Licenciamento Isolado'
  | 'Outro';

export type EtapaProcesso =
  | 'Viabilidade'
  | 'DBE / Redesim'
  | 'Junta Comercial'
  | 'Insc. Municipal/Estadual'
  | 'Licenciamento'
  | 'Concluído';

export interface Exigencia {
  id: string;
  descricao: string;
  data_limite: string | null;
  responsavel: string | null;
  sanado: boolean;
  sanado_em: string | null;
}

export type StatusRotina = 'ativa' | 'pausada' | 'encerrada';

export type FrequenciaRotina =
  | 'diaria'
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'anual'
  | 'data_fixa';

export type TipoEventoTarefa =
  | 'progresso'
  | 'protocolo'
  | 'situacao'
  | 'conclusao'
  | 'abertura';

export type ReferenciaTipoAnexo =
  | 'tarefa'
  | 'processo'
  | 'obrigacao'
  | 'cliente'
  | 'rotina';

export type Setor =
  | 'Legalização'
  | 'Fiscal'
  | 'RH'
  | 'Office Boy'
  | 'Gerencial'
  | 'Administrativo';

export type RegimeTributario = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI';

export type RoleUsuario = 'admin' | 'gestor_cliente' | 'colaborador_cliente';

// ─── Tabelas base ─────────────────────────────────────────────

export interface Cliente {
  id: string; // uuid
  nome: string;
  cnpj: string | null;
  regime: RegimeTributario | null;
  email: string | null;
  telefone: string | null;
  responsavel: string | null;
  responsavel_id: string | null; // uuid → funcionarios.id
  ie: string | null;
  im: string | null;
  cnae: string | null;
  limite_nfe: number | null;
  limite_faturamento: number | null;
  taxa_recalculo: number | null;
  vinculo_atendimento: 'Exclusivo Denazaré' | 'Exclusivo Silvio' | 'Carteira Conjunta' | null;
  contatos_chave: Array<{ nome: string; cargo: string; whatsapp: string; email_guias: string }> | null;
  manual_costumes: string | null;
  municipio: string | null;
  criado_por: string | null;
  created_at: string; // timestamptz
  updated_at: string;
}

export interface Funcionario {
  id: string; // uuid
  nome: string;
  email: string;
  setor: Setor | null;
  setores_ids: string[] | null; // múltiplos setores
  cargo: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  setor: Setor | null;
  responsavel: string | null;
  responsaveis_conjuntos: string[];
  setores_visibilidade: string[] | null;
  prioridade: Prioridade;
  prazo: string | null; // date ISO
  status: StatusTarefa;
  descricao: string | null;
  cliente_id: string | null; // uuid → clientes.id
  created_at: string;
  updated_at: string;
}

export interface TaskEvento {
  id: string;
  tarefa_id: string; // uuid → tarefas.id
  tipo: TipoEventoTarefa;
  titulo: string | null;
  protocolo: string | null;
  situacao: string | null;
  descricao: string | null;
  autor: string | null;
  created_at: string;
}

export interface Anexo {
  id: string;
  referencia_tipo: ReferenciaTipoAnexo;
  referencia_id: string; // uuid
  nome_original: string | null;
  url: string | null;
  criado_por: string | null;
  criado_em: string; // timestamptz
  // Colunas adicionadas na migration de legalização:
  nome_arquivo?: string | null;
  tamanho?: number | null;
  tipo_mime?: string | null;
}

export interface ProcessoLegalizacao {
  id: string;
  cliente_id: string | null;
  tipo: string | null;
  tipo_ato: TipoAtoProcesso | null;
  descricao: string | null;
  status: StatusProcesso;
  prazo: string | null;
  responsavel: string | null;
  responsaveis_conjuntos: string[];
  protocolo: string | null;
  protocolo_viabilidade: string | null;
  protocolo_dbe_redesim: string | null;
  protocolo_junta: string | null;
  inscricao_municipal: string | null;
  inscricao_estadual: string | null;
  protocolo_vigilancia: string | null;
  protocolo_bombeiros: string | null;
  protocolo_meio_ambiente: string | null;
  exigencias: Exigencia[];
  etapa_atual: EtapaProcesso;
  lembrar_antes_dias: number;
  retorno_confirmado: boolean;
  obs: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObrigacaoCliente {
  id: string;
  cliente_id: string; // uuid → clientes.id
  descricao: string;
  competencia: string | null; // 'MM/YYYY'
  vencimento: string | null; // date ISO
  valor: number | null;
  valor_consignado: number | null;
  status: string;
  responsavel: string | null;
  obs: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rotina {
  id: string;
  titulo: string;
  descricao: string | null;
  frequencia: FrequenciaRotina;
  dia_semana: number | null; // 0=Dom … 6=Sáb
  dia_mes: number | null; // 1-28
  dia_ano: string | null; // 'MM-DD'
  data_fixa: string | null; // date ISO
  lembrar_antes_dias: number;
  prioridade: Prioridade;
  setor: Setor | null;
  responsavel: string | null;
  status: StatusRotina;
  obs: string | null;
  criado_por: string | null;
  ultima_validacao: string | null;
  setores_visibilidade: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Parcelamento {
  id: string;
  empresa: string;
  codigo: string | null;
  tipo: string | null;
  orgao: string | null;
  modalidade: string | null;
  instancia: string | null;
  parcela: string | null;
  total_parcelas: string | null;
  valor: string | null;
  vencimento: string | null; // date ISO
  login_acesso: string | null;
  senha: string | null;
  status: string;
  competencia: string | null;
  obs: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParcelaHistorico {
  id: string;
  parcelamento_id: string; // uuid → parcelamentos.id
  numero_parcela: number;
  vencimento: string | null;
  pago: boolean;
  enviado_cliente: boolean;
  data_envio: string | null;
  confirmado_por: string | null;
  observacao: string | null;
  created_at: string;
}

export interface GerencialMensal {
  id: string;
  cliente_id: string; // uuid → clientes.id
  competencia: string; // 'MM/YYYY'
  folha_pagamento: number | null;
  pis_cofins: number | null;
  receita_servicos: number | null;
  receita_vendas: number | null;
  despesas_total: number | null;
  caixa_atual: number | null;
  obs: string | null;
  atualizado_por: string | null;
  updated_at: string;
}

export interface CmObs {
  id: string;
  cliente_id: string;
  competencia: string;
  obs: string | null;
  updated_at: string;
}

export interface InssP {
  id: string;
  nome: string;
  nit: string | null;
  codigo: string | null;
  categoria: string | null;
  aliquota: string | null;
  salario: string | null;
  valor: string | null;
  competencia: string | null;
  vencimento: string | null;
  envio: string | null;
  status: string;
  obs: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entrega {
  id: string;
  cliente_id: string | null;
  descricao: string | null;
  status: string;
  responsavel: string | null;
  conferido_por: string | null;
  conferido_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcessoLog {
  id: string;
  funcionario_nome: string | null;
  funcionario_email: string | null;
  user_id: string | null;
  setor: string | null;
  ip: string | null;
  acessado_em: string;
}

export interface LancamentoFinanceiro {
  id: string;
  cliente_id: string | null;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  categoria: string;
  cliente: string | null;
  forma: string | null;
  data: string;
  competencia: string | null;
  criado_por: string | null;
  created_at: string;
}

export interface CofreCredencial {
  id: string;
  cliente_id: string;
  titulo: string;
  payload_enc: string; // JSON cifrado AES-GCM (E2EE)
  criado_por: string;  // uuid → auth.users.id
  created_at: string;
  updated_at: string;
}

export interface OrdemServico {
  id: string;
  cliente_id: string | null;
  numero: string | null;
  descricao: string;
  status: string;
  responsavel_id: string | null;
  valor: number | null;
  data_abertura: string;
  data_conclusao: string | null;
  obs: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  titulo: string;
  descricao: string | null;
  valor_mensal: number | null;
  inicio: string;
  termino: string | null;
  renovacao_auto: boolean;
  status: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Permissões modulares ─────────────────────────────────────

export interface PermissoesModulos {
  modulo_pessoal:          boolean;
  modulo_fiscal:           boolean;
  modulo_contabil:         boolean;
  modulo_societario:       boolean;
  modulo_financeiro:       boolean;
  acoes_financeiras:       boolean;
  modulo_gestao_contratos: boolean;
}

export const PERMISSOES_DEFAULT: PermissoesModulos = {
  modulo_pessoal:          true,
  modulo_fiscal:           true,
  modulo_contabil:         true,
  modulo_societario:       true,
  modulo_financeiro:       false,
  acoes_financeiras:       false,
  modulo_gestao_contratos: false,
}

// ─── Multi-tenant / Auth ──────────────────────────────────────

export interface PerfilUsuario {
  id: string; // uuid — corresponde ao auth.users.id
  email: string;
  nome: string;
  role: RoleUsuario;
  cliente_id: string | null; // preenchido para gestor_cliente e colaborador_cliente
  funcionario_id: string | null; // preenchido para admin/escritório
  cpf: string | null; // preenchido para colaborador_cliente
  ativo: boolean;
  permissoes_modulos: PermissoesModulos | null;
  ultimo_acesso: string | null; // timestamptz
  created_at: string;
  updated_at: string;
}

// ─── Tipos auxiliares / DTO ───────────────────────────────────

/** Payload para criação de tarefa */
export type TarefaInsert = Omit<Tarefa, 'id' | 'created_at' | 'updated_at'>;

/** Payload para atualização parcial de tarefa */
export type TarefaUpdate = Partial<TarefaInsert>;

/** Payload para criação de processo */
export type ProcessoInsert = Omit<ProcessoLegalizacao, 'id' | 'created_at' | 'updated_at'>;

/** Payload para criação de cliente */
export type ClienteInsert = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>;

/** Payload para upload de anexo */
export interface AnexoInsert {
  referencia_tipo: ReferenciaTipoAnexo;
  referencia_id: string;
  nome_original: string;
  url: string;
  criado_por: string;
  tipo_mime?: string;
  tamanho?: number;
}

// ─── Schema map (para uso com supabase-js generics) ──────────

export interface Database {
  public: {
    Tables: {
      clientes: { Row: Cliente; Insert: ClienteInsert; Update: Partial<ClienteInsert> };
      funcionarios: { Row: Funcionario; Insert: Omit<Funcionario, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Funcionario> };
      tarefas: { Row: Tarefa; Insert: TarefaInsert; Update: TarefaUpdate };
      task_eventos: { Row: TaskEvento; Insert: Omit<TaskEvento, 'id' | 'created_at'>; Update: Partial<TaskEvento> };
      anexos: { Row: Anexo; Insert: AnexoInsert; Update: Partial<AnexoInsert> };
      processos_legalizacao: { Row: ProcessoLegalizacao; Insert: ProcessoInsert; Update: Partial<ProcessoInsert> };
      obrigacoes_clientes: { Row: ObrigacaoCliente; Insert: Omit<ObrigacaoCliente, 'id' | 'created_at' | 'updated_at'>; Update: Partial<ObrigacaoCliente> };
      rotinas: { Row: Rotina; Insert: Omit<Rotina, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Rotina> };
      parcelamentos: { Row: Parcelamento; Insert: Omit<Parcelamento, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Parcelamento> };
      parcelas_historico: { Row: ParcelaHistorico; Insert: Omit<ParcelaHistorico, 'id' | 'created_at'>; Update: Partial<ParcelaHistorico> };
      gerencial_mensal: { Row: GerencialMensal; Insert: Omit<GerencialMensal, 'id'>; Update: Partial<GerencialMensal> };
      cm_obs: { Row: CmObs; Insert: Omit<CmObs, 'id'>; Update: Partial<CmObs> };
      inss_pf: { Row: InssP; Insert: Omit<InssP, 'id' | 'created_at' | 'updated_at'>; Update: Partial<InssP> };
      entregas: { Row: Entrega; Insert: Omit<Entrega, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Entrega> };
      acessos_log: { Row: AcessoLog; Insert: Omit<AcessoLog, 'id' | 'acessado_em'>; Update: never };
      perfis_usuarios: { Row: PerfilUsuario; Insert: Omit<PerfilUsuario, 'id' | 'created_at' | 'updated_at'>; Update: Partial<PerfilUsuario> };
      cofre_credenciais: { Row: CofreCredencial; Insert: Omit<CofreCredencial, 'id' | 'created_at' | 'updated_at'>; Update: Partial<CofreCredencial> };
      ordens_servico: { Row: OrdemServico; Insert: Omit<OrdemServico, 'id' | 'created_at' | 'updated_at'>; Update: Partial<OrdemServico> };
      contratos: { Row: Contrato; Insert: Omit<Contrato, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Contrato> };
      lancamentos_financeiros: { Row: LancamentoFinanceiro; Insert: Omit<LancamentoFinanceiro, 'id' | 'created_at'>; Update: Partial<LancamentoFinanceiro> };
    };
  };
}
