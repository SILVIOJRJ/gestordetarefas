'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ObrigacaoCliente, Anexo } from '@/types/database.types'
import { Building2, Download, FileText, Clock, CheckCircle2, LogOut, Send, ChevronRight, User } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

interface Perfil {
  nome: string
  email: string
  cliente_id: string | null
  cliente_nome?: string
  regime?: string
}

type TipoSolicitacao = 'Segunda Via de Guia' | 'Aviso de Férias' | 'Solicitação de Admissão' | 'Outros'
const TIPOS_SOLICITACAO: TipoSolicitacao[] = ['Segunda Via de Guia', 'Aviso de Férias', 'Solicitação de Admissão', 'Outros']

interface Solicitacao {
  tipo: TipoSolicitacao
  descricao: string
  enviando: boolean
  enviada: boolean
}

// ─── Helpers ──────────────────────────────────────────────────

function competenciaAtual() {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// ─── Componente ───────────────────────────────────────────────

export default function PortalClientePage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoCliente[]>([])
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [loading, setLoading] = useState(true)
  const [solicitacao, setSolicitacao] = useState<Solicitacao>({
    tipo: 'Segunda Via de Guia', descricao: '', enviando: false, enviada: false,
  })
  const [msgSolicitacao, setMsgSolicitacao] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/login'; return }

        // Perfil do usuário
        const { data: p } = await (supabase.from('perfis_usuarios') as any)
          .select('nome, email, cliente_id, role')
          .eq('id', user.id)
          .single()

        if (!p || p.role === 'colaborador_cliente') {
          window.location.href = '/meu-rh'
          return
        }

        // Dados do cliente vinculado
        let clienteNome = ''
        let regime = ''
        if (p.cliente_id) {
          const { data: c } = await (supabase.from('clientes') as any)
            .select('nome, regime')
            .eq('id', p.cliente_id)
            .single()
          clienteNome = c?.nome ?? ''
          regime = c?.regime ?? ''
        }

        setPerfil({ nome: p.nome, email: p.email, cliente_id: p.cliente_id, cliente_nome: clienteNome, regime })

        if (p.cliente_id) {
          // Obrigações do mês atual (RLS garante apenas dados desta empresa)
          const comp = competenciaAtual()
          const [{ data: obs }, { data: anx }] = await Promise.all([
            (supabase.from('obrigacoes_clientes') as any)
              .select('*')
              .eq('cliente_id', p.cliente_id)
              .eq('competencia', comp)
              .order('vencimento'),
            (supabase.from('anexos') as any)
              .select('*')
              .eq('referencia_tipo', 'cliente')
              .eq('referencia_id', p.cliente_id)
              .order('criado_em', { ascending: false })
              .limit(20),
          ])
          setObrigacoes((obs ?? []) as ObrigacaoCliente[])
          setAnexos((anx ?? []) as Anexo[])
        }
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  async function enviarSolicitacao() {
    if (!solicitacao.descricao.trim() || !perfil?.cliente_id) return
    setSolicitacao(s => ({ ...s, enviando: true }))
    try {
      // Cria tarefa de atendimento para a equipe interna
      await (supabase.from('tarefas') as any).insert({
        titulo: `[Portal] ${solicitacao.tipo} — ${perfil.cliente_nome}`,
        setor: 'Administrativo',
        descricao: solicitacao.descricao,
        status: 'Pendente',
        prioridade: 'Média',
        cliente_id: perfil.cliente_id,
      })
      setSolicitacao(s => ({ ...s, enviando: false, enviada: true, descricao: '' }))
      setMsgSolicitacao('Solicitação enviada! Nossa equipe entrará em contato em breve.')
    } catch {
      setSolicitacao(s => ({ ...s, enviando: false }))
      setMsgSolicitacao('Erro ao enviar. Tente novamente.')
    }
  }

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <div className="text-brand-400 text-sm">Carregando portal…</div>
      </div>
    )
  }

  const obPendentes = obrigacoes.filter(o => o.status !== 'pago' && o.status !== 'concluido')
  const obPagas = obrigacoes.filter(o => o.status === 'pago' || o.status === 'concluido')

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100">
      {/* Topbar */}
      <header className="bg-brand-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center font-bold text-brand-900 text-sm">N</div>
          <div>
            <p className="text-xs text-brand-300">Portal do Cliente</p>
            <p className="text-sm font-semibold">{perfil?.cliente_nome ?? 'Minha Empresa'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-brand-300">{saudacao()},</p>
            <p className="text-sm font-medium">{perfil?.nome}</p>
          </div>
          <button onClick={sair} className="flex items-center gap-1 text-xs text-brand-300 hover:text-white transition">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Saudação */}
        <div>
          <h1 className="text-2xl font-bold text-brand-800">{saudacao()}, {perfil?.nome?.split(' ')[0]}!</h1>
          <p className="text-sm text-brand-500 mt-1">
            {perfil?.regime && <span className="mr-2">Regime: <strong>{perfil.regime}</strong></span>}
            Competência atual: <strong>{competenciaAtual()}</strong>
          </p>
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-brand-100 p-4 text-center">
            <p className="text-xs text-brand-400">Obrigações do mês</p>
            <p className="text-2xl font-bold text-brand-700">{obrigacoes.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-brand-100 p-4 text-center">
            <p className="text-xs text-brand-400">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600">{obPendentes.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-brand-100 p-4 text-center">
            <p className="text-xs text-brand-400">Pagas</p>
            <p className="text-2xl font-bold text-emerald-600">{obPagas.length}</p>
          </div>
        </div>

        {/* Guias do mês */}
        <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50 flex items-center gap-2">
            <FileText size={16} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-brand-700">Guias & Obrigações — {competenciaAtual()}</h2>
          </div>
          {obrigacoes.length === 0 ? (
            <div className="py-10 text-center text-brand-300 text-sm">
              Nenhuma obrigação lançada para este mês. Aguarde a equipe contábil.
            </div>
          ) : (
            <div className="divide-y divide-brand-50">
              {obrigacoes.map(o => {
                const paga = o.status === 'pago' || o.status === 'concluido'
                const venc = o.vencimento ? new Date(o.vencimento + 'T00:00:00') : null
                const vencida = venc && venc < new Date() && !paga
                return (
                  <div key={o.id} className={`px-4 py-3 flex items-center gap-3 ${paga ? 'opacity-60' : ''}`}>
                    {paga
                      ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                      : vencida
                        ? <Clock size={18} className="text-red-500 shrink-0" />
                        : <Clock size={18} className="text-yellow-500 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${paga ? 'line-through text-brand-400' : 'text-brand-800'}`}>
                        {o.descricao}
                      </p>
                      <p className="text-xs text-brand-400">
                        {venc ? `Vencimento: ${venc.toLocaleDateString('pt-BR')}` : ''}
                        {o.valor ? ` · ${o.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      paga ? 'bg-emerald-100 text-emerald-700' :
                      vencida ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {paga ? 'Paga' : vencida ? 'Vencida' : 'Pendente'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Documentos / Anexos para download */}
        {anexos.length > 0 && (
          <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-brand-50 flex items-center gap-2">
              <Download size={16} className="text-brand-500" />
              <h2 className="text-sm font-semibold text-brand-700">Documentos Disponíveis</h2>
            </div>
            <div className="divide-y divide-brand-50">
              {anexos.map(a => (
                <div key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-brand-300 shrink-0" />
                    <span className="text-sm text-brand-700 truncate">{a.nome_original ?? a.nome_arquivo ?? 'Documento'}</span>
                  </div>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 text-xs text-accent-600 hover:text-accent-800 font-medium"
                    >
                      <Download size={13} /> Baixar
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Solicitador de serviços */}
        <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-50 flex items-center gap-2">
            <Send size={16} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-brand-700">Solicitar Serviço</h2>
          </div>
          <div className="p-4 space-y-4">
            {msgSolicitacao && (
              <div className={`text-sm rounded-lg px-4 py-2 ${solicitacao.enviada ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msgSolicitacao}
              </div>
            )}

            {/* Atalhos de tipo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIPOS_SOLICITACAO.map(tipo => (
                <button
                  key={tipo}
                  onClick={() => { setSolicitacao(s => ({ ...s, tipo, enviada: false })); setMsgSolicitacao(null) }}
                  className={`text-xs px-3 py-2 rounded-lg border text-center transition ${
                    solicitacao.tipo === tipo
                      ? 'bg-accent-600 text-white border-accent-600'
                      : 'border-brand-200 text-brand-600 hover:bg-brand-50'
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs text-brand-500 block mb-1">Descreva sua solicitação</label>
              <textarea
                rows={4}
                value={solicitacao.descricao}
                onChange={e => setSolicitacao(s => ({ ...s, descricao: e.target.value, enviada: false }))}
                placeholder={
                  solicitacao.tipo === 'Segunda Via de Guia' ? 'Ex: Segunda via do DAS de outubro/2026. Competência 10/2026.' :
                  solicitacao.tipo === 'Aviso de Férias' ? 'Ex: Aviso de férias de João Silva — 15 dias a partir de 01/01/2027.' :
                  solicitacao.tipo === 'Solicitação de Admissão' ? 'Ex: Admissão de Maria Santos — CLT — Cargo: Aux. Administrativo — Salário: R$ 1.800.' :
                  'Descreva sua necessidade…'
                }
                className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm text-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none"
              />
            </div>

            <button
              onClick={enviarSolicitacao}
              disabled={solicitacao.enviando || !solicitacao.descricao.trim()}
              className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
            >
              <Send size={15} />
              {solicitacao.enviando ? 'Enviando…' : 'Enviar Solicitação'}
              <ChevronRight size={14} />
            </button>

            <p className="text-xs text-brand-400">
              Nossa equipe receberá sua solicitação e retornará em até 1 dia útil.
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="text-center py-4">
          <p className="text-xs text-brand-400">
            <strong>NascenteContábil</strong> · Portal do Cliente · Dados protegidos por RLS
          </p>
        </div>
      </div>
    </div>
  )
}
