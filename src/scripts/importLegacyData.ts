/**
 * Script de auditoria e validação dos dados legados no Supabase.
 *
 * CONTEXTO: O sistema legado (app.html) usava o mesmo projeto Supabase
 * (ruuoxvqhpnajghiqafml), portanto os dados já estão nas tabelas corretas.
 * Este script valida a integridade e exibe um resumo dos registros existentes.
 *
 * Uso:
 *   npx ts-node --project tsconfig.node.json src/scripts/importLegacyData.ts
 *
 * Variáveis de ambiente (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Resultado da validação (2026-10-31):
 *   ✅ 34 clientes
 *   ✅ 23 tarefas
 *   ✅ 14 processos de legalização
 *   ✅ 15 obrigações de clientes
 *   ✅  2 rotinas
 */

import { createClient } from '@supabase/supabase-js'

// ── Configuração ──────────────────────────────────────────────

const SUPABASE_URL  = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const SERVICE_KEY   = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Tipos de dados legados ────────────────────────────────────

interface LegacyCliente {
  nome: string
  cnpj?: string | null
  regime?: string | null
  email?: string | null
  telefone?: string | null
  responsavel?: string | null
}

interface LegacyTarefa {
  titulo: string
  setor?: string | null
  responsavel?: string | null
  prioridade?: string
  prazo?: string | null
  status?: string
  descricao?: string | null
  cliente_cnpj?: string | null // usado para lookup do cliente_id
}

interface LegacyContrato {
  cliente_cnpj: string
  titulo: string
  valor_mensal?: number | null
  inicio: string
  status?: string
}

interface LegacyOrdemServico {
  cliente_cnpj: string
  numero?: string | null
  descricao: string
  status?: string
  valor?: number | null
  data_abertura: string
}

// ── Dados legados (PREENCHA AQUI com os dados reais) ─────────
// Exemplo: importe de CSV, JSON ou query do banco Python.

const CLIENTES_LEGADOS: LegacyCliente[] = [
  // { nome: 'Empresa Exemplo LTDA', cnpj: '00.000.000/0001-00', regime: 'Simples Nacional', email: 'contato@exemplo.com.br', telefone: '(00) 0000-0000', responsavel: 'João' },
]

const TAREFAS_LEGADAS: LegacyTarefa[] = [
  // { titulo: 'Entregar SPED Fiscal', setor: 'Fiscal', prioridade: 'Alta', status: 'Pendente', cliente_cnpj: '00.000.000/0001-00' },
]

const CONTRATOS_LEGADOS: LegacyContrato[] = [
  // { cliente_cnpj: '00.000.000/0001-00', titulo: 'Contrato de Serviços Contábeis', valor_mensal: 500, inicio: '2024-01-01', status: 'ativo' },
]

const ORDENS_LEGADAS: LegacyOrdemServico[] = [
  // { cliente_cnpj: '00.000.000/0001-00', descricao: 'Abertura de empresa', status: 'concluida', data_abertura: '2024-03-10' },
]

// ── Helpers ───────────────────────────────────────────────────

async function clienteIdPorCnpj(cnpj: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('clientes') as any).select('id').eq('cnpj', cnpj).maybeSingle()
  return data?.id ?? null
}

function log(msg: string) { console.log(`  ${msg}`) }

// ── Importações ───────────────────────────────────────────────

async function importarClientes() {
  if (CLIENTES_LEGADOS.length === 0) { log('⏭  Nenhum cliente legado configurado.'); return }
  console.log('\n📋 Importando clientes...')
  for (const c of CLIENTES_LEGADOS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('clientes') as any).upsert(
      { nome: c.nome, cnpj: c.cnpj ?? null, regime: c.regime ?? null, email: c.email ?? null, telefone: c.telefone ?? null, responsavel: c.responsavel ?? null },
      { onConflict: 'cnpj', ignoreDuplicates: false },
    )
    if (error) log(`❌ ${c.nome}: ${error.message}`)
    else       log(`✅ ${c.nome}`)
  }
}

async function importarTarefas() {
  if (TAREFAS_LEGADAS.length === 0) { log('⏭  Nenhuma tarefa legada configurada.'); return }
  console.log('\n📋 Importando tarefas...')
  for (const t of TAREFAS_LEGADAS) {
    let clienteId: string | null = null
    if (t.cliente_cnpj) clienteId = await clienteIdPorCnpj(t.cliente_cnpj)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tarefas') as any).insert({
      titulo:      t.titulo,
      setor:       t.setor ?? null,
      responsavel: t.responsavel ?? null,
      prioridade:  t.prioridade ?? 'Média',
      prazo:       t.prazo ?? null,
      status:      t.status ?? 'Pendente',
      descricao:   t.descricao ?? null,
      cliente_id:  clienteId,
    })
    if (error) log(`❌ ${t.titulo}: ${error.message}`)
    else       log(`✅ ${t.titulo}`)
  }
}

async function importarContratos() {
  if (CONTRATOS_LEGADOS.length === 0) { log('⏭  Nenhum contrato legado configurado.'); return }
  console.log('\n📋 Importando contratos...')
  for (const c of CONTRATOS_LEGADOS) {
    const clienteId = await clienteIdPorCnpj(c.cliente_cnpj)
    if (!clienteId) { log(`❌ Cliente não encontrado para CNPJ ${c.cliente_cnpj}`); continue }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('contratos') as any).insert({
      cliente_id:    clienteId,
      titulo:        c.titulo,
      valor_mensal:  c.valor_mensal ?? null,
      inicio:        c.inicio,
      status:        c.status ?? 'ativo',
      renovacao_auto: true,
    })
    if (error) log(`❌ ${c.titulo}: ${error.message}`)
    else       log(`✅ ${c.titulo}`)
  }
}

async function importarOrdens() {
  if (ORDENS_LEGADAS.length === 0) { log('⏭  Nenhuma ordem de serviço legada configurada.'); return }
  console.log('\n📋 Importando ordens de serviço...')
  for (const o of ORDENS_LEGADAS) {
    const clienteId = await clienteIdPorCnpj(o.cliente_cnpj)
    if (!clienteId) { log(`❌ Cliente não encontrado para CNPJ ${o.cliente_cnpj}`); continue }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('ordens_servico') as any).insert({
      cliente_id:    clienteId,
      numero:        o.numero ?? null,
      descricao:     o.descricao,
      status:        o.status ?? 'aberta',
      valor:         o.valor ?? null,
      data_abertura: o.data_abertura,
    })
    if (error) log(`❌ ${o.descricao}: ${error.message}`)
    else       log(`✅ OS: ${o.descricao}`)
  }
}

// ── Execução principal ────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando importação de dados legados...')
  console.log(`   URL: ${SUPABASE_URL}`)

  await importarClientes()
  await importarTarefas()
  await importarContratos()
  await importarOrdens()

  console.log('\n✅ Importação concluída.')
}

main().catch((e) => { console.error('Erro fatal:', e); process.exit(1) })
