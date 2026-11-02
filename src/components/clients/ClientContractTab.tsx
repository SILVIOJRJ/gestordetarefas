'use client'

import { useState } from 'react'
import { FileText, Printer, Building2 } from 'lucide-react'
import type { Cliente } from '@/types/database.types'
import {
  gerarMinutaHtml,
  imprimirMinuta,
  type DadosContrato,
  type ModalidadeContrato,
  type IndiceReajuste,
} from '@/services/reports'

interface Props {
  cliente: Cliente
}

const MODALIDADES: ModalidadeContrato[] = [
  'Prestação de Serviços Contábeis',
  'Assessoria e Consultoria',
  'Sociedade em Conta de Participação (SCP)',
]

const INDICES: IndiceReajuste[] = ['IPCA', 'IGPM', 'Fixo']

const DEFAULT_CONTRATO: DadosContrato = {
  modalidade: 'Prestação de Serviços Contábeis',
  dataAssinatura: new Date().toISOString().slice(0, 10),
  vigenciaInicio: new Date().toISOString().slice(0, 10),
  vigenciaFim: '',
  valorMensal: 0,
  diaVencimento: 10,
  indiceReajuste: 'IPCA',
  percentualFixo: 5,
  limiteNotasMensais: 50,
  multaAtraso: 2,
  foroComarca: 'Jacarezinho/PR',
  clausulas: {
    objeto: true,
    limiteDocumentos: true,
    multaClienteAtraso: true,
    reajusteAnual: true,
    vigencia: true,
    foro: true,
  },
  scp: {
    socioOstensivo: 'Nascente Contábil Ltda',
    socioParticipante: '',
    percentualResultados: 50,
    capitalizacaoOstensivo: 0,
    capitalizacaoParticipante: 0,
  },
}

const CLAUSULAS_LABELS: { key: keyof DadosContrato['clausulas']; label: string }[] = [
  { key: 'objeto',            label: 'Cláusula de Objeto e Escopo dos Serviços' },
  { key: 'limiteDocumentos',  label: 'Limite de Notas/Documentos por Mês' },
  { key: 'multaClienteAtraso', label: 'Multa por Atraso de Entrega de Documentos pelo Cliente' },
  { key: 'reajusteAnual',     label: 'Reajuste Anual pelo Índice Selecionado' },
  { key: 'vigencia',          label: 'Prazo de Vigência Determinado' },
  { key: 'foro',              label: 'Eleição de Foro' },
]

export default function ClientContractTab({ cliente }: Props) {
  const [contrato, setContrato] = useState<DadosContrato>(DEFAULT_CONTRATO)

  const isSCP = contrato.modalidade === 'Sociedade em Conta de Participação (SCP)'

  function set<K extends keyof DadosContrato>(key: K, value: DadosContrato[K]) {
    setContrato(prev => ({ ...prev, [key]: value }))
  }

  function setClausula(key: keyof DadosContrato['clausulas'], value: boolean) {
    setContrato(prev => ({ ...prev, clausulas: { ...prev.clausulas, [key]: value } }))
  }

  function setSCP<K extends keyof NonNullable<DadosContrato['scp']>>(
    key: K,
    value: NonNullable<DadosContrato['scp']>[K],
  ) {
    setContrato(prev => ({
      ...prev,
      scp: { ...(prev.scp ?? DEFAULT_CONTRATO.scp!), [key]: value },
    }))
  }

  function handleGerar() {
    const html = gerarMinutaHtml(contrato, {
      nome: cliente.nome,
      cnpj: cliente.cnpj,
      responsavel: cliente.responsavel,
    })
    imprimirMinuta(html)
  }

  return (
    <div className="space-y-4">

      {/* ── Seção 1: Modalidade e Vigência ─────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={16} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-brand-800">Modalidade e Vigência</h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs text-brand-500 mb-1">Modalidade do Contrato</label>
            <select
              className="input"
              value={contrato.modalidade}
              onChange={e => set('modalidade', e.target.value as ModalidadeContrato)}
            >
              {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-brand-500 mb-1">Data de Assinatura</label>
            <input
              type="date"
              className="input"
              value={contrato.dataAssinatura}
              onChange={e => set('dataAssinatura', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-brand-500 mb-1">Início da Vigência</label>
            <input
              type="date"
              className="input"
              value={contrato.vigenciaInicio}
              onChange={e => set('vigenciaInicio', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-brand-500 mb-1">Término (vazio = indeterminado)</label>
            <input
              type="date"
              className="input"
              value={contrato.vigenciaFim}
              onChange={e => set('vigenciaFim', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Seção 2: Valores e Condições ───────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={16} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-brand-800">Valores e Condições</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-brand-500 mb-1">Valor Mensal (R$)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="input"
              value={contrato.valorMensal}
              onChange={e => set('valorMensal', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-xs text-brand-500 mb-1">Dia de Vencimento</label>
            <input
              type="number"
              min={1}
              max={31}
              className="input"
              value={contrato.diaVencimento}
              onChange={e => set('diaVencimento', parseInt(e.target.value) || 10)}
            />
          </div>
          <div>
            <label className="block text-xs text-brand-500 mb-1">Limite de Docs/Mês</label>
            <input
              type="number"
              min={1}
              className="input"
              value={contrato.limiteNotasMensais}
              onChange={e => set('limiteNotasMensais', parseInt(e.target.value) || 50)}
            />
          </div>
          <div>
            <label className="block text-xs text-brand-500 mb-1">Índice de Reajuste</label>
            <select
              className="input"
              value={contrato.indiceReajuste}
              onChange={e => set('indiceReajuste', e.target.value as IndiceReajuste)}
            >
              {INDICES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          {contrato.indiceReajuste === 'Fixo' && (
            <div>
              <label className="block text-xs text-brand-500 mb-1">Percentual Fixo (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="input"
                value={contrato.percentualFixo ?? 5}
                onChange={e => set('percentualFixo', parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-brand-500 mb-1">Multa por Atraso de Docs (%/mês)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="input"
              value={contrato.multaAtraso}
              onChange={e => set('multaAtraso', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* ── Seção 3: SCP ───────────────────────────────────── */}
      {isSCP && (
        <div className="card space-y-4 border-l-4 border-accent-500">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-accent-600" />
            <h3 className="text-sm font-semibold text-brand-800">SCP — Dados da Sociedade</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-500 mb-1">Sócio Ostensivo</label>
              <input
                type="text"
                className="input"
                value={contrato.scp?.socioOstensivo ?? 'Nascente Contábil Ltda'}
                onChange={e => setSCP('socioOstensivo', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-brand-500 mb-1">Sócio Participante</label>
              <input
                type="text"
                className="input"
                placeholder="Nome do sócio participante"
                value={contrato.scp?.socioParticipante ?? ''}
                onChange={e => setSCP('socioParticipante', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-brand-500 mb-1">Participação do Sócio Participante (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="input"
                value={contrato.scp?.percentualResultados ?? 50}
                onChange={e => setSCP('percentualResultados', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="text-xs text-brand-500 flex items-end pb-2">
              Sócio Ostensivo terá <strong className="text-brand-800 mx-1">{100 - (contrato.scp?.percentualResultados ?? 50)}%</strong> dos resultados
            </div>
            <div>
              <label className="block text-xs text-brand-500 mb-1">Integralização – Ostensivo (R$)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input"
                value={contrato.scp?.capitalizacaoOstensivo ?? 0}
                onChange={e => setSCP('capitalizacaoOstensivo', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs text-brand-500 mb-1">Integralização – Participante (R$)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input"
                value={contrato.scp?.capitalizacaoParticipante ?? 0}
                onChange={e => setSCP('capitalizacaoParticipante', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Seção 4: Cláusulas ─────────────────────────────── */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-800">Cláusulas a Incluir na Minuta</h3>

        <div className="space-y-2">
          {CLAUSULAS_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-brand-300 text-accent-600 focus:ring-accent-500"
                checked={contrato.clausulas[key]}
                onChange={e => setClausula(key, e.target.checked)}
              />
              <span className="text-sm text-brand-700 group-hover:text-brand-900">{label}</span>
            </label>
          ))}
        </div>

        <div className="pt-2 border-t border-brand-100">
          <label className="block text-xs text-brand-500 mb-1">Comarca do Foro Eleito</label>
          <input
            type="text"
            className="input max-w-xs"
            value={contrato.foroComarca}
            onChange={e => set('foroComarca', e.target.value)}
          />
        </div>
      </div>

      {/* ── Botão Gerar Minuta ─────────────────────────────── */}
      <button
        onClick={handleGerar}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-brand-900 text-white rounded-xl font-semibold text-sm hover:bg-brand-800 transition-colors shadow-sm"
      >
        <Printer size={16} />
        Gerar Minuta de Contrato Timbrada
      </button>

      <p className="text-xs text-brand-400 text-center">
        A minuta será aberta em nova aba para impressão/salvamento como PDF. Sujeita a revisão jurídica.
      </p>
    </div>
  )
}
