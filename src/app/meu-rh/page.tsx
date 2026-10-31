'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, Download, Calendar, LogOut, User, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

interface PerfilColaborador {
  nome: string
  email: string
  funcionario_id: string | null
  cpf?: string
}

interface Holerite {
  id: string
  competencia: string
  url: string | null
  nome_arquivo?: string
  criado_em: string
}

interface InformeRendimentos {
  id: string
  ano_base: number
  url: string | null
  nome_arquivo?: string
  criado_em: string
}

interface ComprovanteFeriasItem {
  id: string
  periodo_aquisitivo: string
  data_inicio: string
  data_fim: string
  dias: number
  url: string | null
  nome_arquivo?: string
  criado_em: string
}

type AbaRH = 'holerites' | 'informes' | 'ferias'

// ─── Componente ───────────────────────────────────────────────

export default function MeuRHPage() {
  const [perfil, setPerfil]           = useState<PerfilColaborador | null>(null)
  const [loading, setLoading]         = useState(true)
  const [aba, setAba]                 = useState<AbaRH>('holerites')

  const [holerites, setHolerites]     = useState<Holerite[]>([])
  const [informes, setInformes]       = useState<InformeRendimentos[]>([])
  const [ferias, setFerias]           = useState<ComprovanteFeriasItem[]>([])

  const [expandido, setExpandido]     = useState<string | null>(null)
  const [loadingAba, setLoadingAba]   = useState(false)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/login'; return }

        const { data: p } = await (supabase.from('perfis_usuarios') as any)
          .select('nome, email, funcionario_id, cpf, role')
          .eq('id', user.id)
          .single()

        if (!p) { window.location.href = '/login'; return }

        // Redireciona se não for colaborador_cliente
        if (p.role === 'admin' || p.role === 'gestor_cliente') {
          window.location.href = '/dashboard'
          return
        }

        setPerfil({ nome: p.nome, email: p.email, funcionario_id: p.funcionario_id, cpf: p.cpf })
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  useEffect(() => {
    if (!perfil) return
    carregarAba(aba)
  }, [perfil, aba])

  async function carregarAba(a: AbaRH) {
    if (!perfil) return
    setLoadingAba(true)
    try {
      const filtro = perfil.funcionario_id
        ? { col: 'funcionario_id', val: perfil.funcionario_id }
        : perfil.cpf
          ? { col: 'cpf', val: perfil.cpf }
          : null

      if (!filtro) return

      if (a === 'holerites') {
        const { data } = await (supabase.from('holerites') as any)
          .select('id, competencia, url, nome_arquivo, criado_em')
          .eq(filtro.col, filtro.val)
          .order('competencia', { ascending: false })
          .limit(36)
        setHolerites((data ?? []) as Holerite[])
      } else if (a === 'informes') {
        const { data } = await (supabase.from('informes_rendimentos') as any)
          .select('id, ano_base, url, nome_arquivo, criado_em')
          .eq(filtro.col, filtro.val)
          .order('ano_base', { ascending: false })
        setInformes((data ?? []) as InformeRendimentos[])
      } else {
        const { data } = await (supabase.from('comprovantes_ferias') as any)
          .select('id, periodo_aquisitivo, data_inicio, data_fim, dias, url, nome_arquivo, criado_em')
          .eq(filtro.col, filtro.val)
          .order('data_inicio', { ascending: false })
        setFerias((data ?? []) as ComprovanteFeriasItem[])
      }
    } finally {
      setLoadingAba(false)
    }
  }

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <div className="text-brand-400 text-sm">Carregando…</div>
      </div>
    )
  }

  const ABAS: { id: AbaRH; label: string; icon: React.ElementType }[] = [
    { id: 'holerites', label: 'Holerites',              icon: FileText },
    { id: 'informes',  label: 'Informes de Rendimentos', icon: FileText },
    { id: 'ferias',    label: 'Comprovantes de Férias',  icon: Calendar },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100">
      {/* Topbar */}
      <header className="bg-brand-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center font-bold text-brand-900 text-sm">N</div>
          <div>
            <p className="text-xs text-brand-300">Autoatendimento RH</p>
            <p className="text-sm font-semibold">{perfil?.nome}</p>
          </div>
        </div>
        <button onClick={sair} className="flex items-center gap-1 text-xs text-brand-300 hover:text-white transition">
          <LogOut size={14} /> Sair
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header pessoal */}
        <div className="bg-white rounded-xl border border-brand-100 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
            <User size={22} className="text-brand-500" />
          </div>
          <div>
            <p className="font-semibold text-brand-800">{perfil?.nome}</p>
            <p className="text-xs text-brand-400">{perfil?.email}</p>
            {perfil?.cpf && <p className="text-xs text-brand-400 mt-0.5">CPF: {perfil.cpf}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-brand-100 p-1">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all
                ${aba === id ? 'bg-brand-900 text-white shadow-sm' : 'text-brand-500 hover:text-brand-700 hover:bg-brand-50'}`}
            >
              <Icon size={13} className="shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Conteúdo da aba */}
        <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">

          {/* Holerites */}
          {aba === 'holerites' && (
            <>
              <div className="px-4 py-3 border-b border-brand-50">
                <h2 className="text-sm font-semibold text-brand-700">Holerites</h2>
                <p className="text-xs text-brand-400 mt-0.5">Seus recibos de pagamento mensais</p>
              </div>
              {loadingAba ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
              ) : holerites.length === 0 ? (
                <div className="py-12 text-center text-brand-300 text-sm">
                  <FileText size={28} className="mx-auto mb-3 opacity-30" />
                  Nenhum holerite disponível ainda.
                </div>
              ) : (
                <div className="divide-y divide-brand-50">
                  {holerites.map(h => (
                    <div key={h.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-brand-800">{h.competencia}</p>
                        <p className="text-xs text-brand-400">
                          {new Date(h.criado_em).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      {h.url ? (
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-800 bg-accent-50 hover:bg-accent-100 px-3 py-1.5 rounded-lg transition"
                        >
                          <Download size={13} /> Baixar
                        </a>
                      ) : (
                        <span className="text-xs text-brand-300">Indisponível</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Informes de Rendimentos */}
          {aba === 'informes' && (
            <>
              <div className="px-4 py-3 border-b border-brand-50">
                <h2 className="text-sm font-semibold text-brand-700">Informes de Rendimentos</h2>
                <p className="text-xs text-brand-400 mt-0.5">Declaração anual para imposto de renda</p>
              </div>
              {loadingAba ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
              ) : informes.length === 0 ? (
                <div className="py-12 text-center text-brand-300 text-sm">
                  <FileText size={28} className="mx-auto mb-3 opacity-30" />
                  Nenhum informe disponível ainda.
                </div>
              ) : (
                <div className="divide-y divide-brand-50">
                  {informes.map(i => (
                    <div key={i.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-brand-800">Ano-base {i.ano_base}</p>
                        <p className="text-xs text-brand-400">
                          Disponível em {new Date(i.criado_em).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      {i.url ? (
                        <a
                          href={i.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-800 bg-accent-50 hover:bg-accent-100 px-3 py-1.5 rounded-lg transition"
                        >
                          <Download size={13} /> Baixar
                        </a>
                      ) : (
                        <span className="text-xs text-brand-300">Indisponível</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Comprovantes de Férias */}
          {aba === 'ferias' && (
            <>
              <div className="px-4 py-3 border-b border-brand-50">
                <h2 className="text-sm font-semibold text-brand-700">Comprovantes de Férias</h2>
                <p className="text-xs text-brand-400 mt-0.5">Períodos de férias e aviso/recibo</p>
              </div>
              {loadingAba ? (
                <div className="py-10 text-center text-brand-300 text-sm">Carregando…</div>
              ) : ferias.length === 0 ? (
                <div className="py-12 text-center text-brand-300 text-sm">
                  <Calendar size={28} className="mx-auto mb-3 opacity-30" />
                  Nenhum comprovante de férias disponível ainda.
                </div>
              ) : (
                <div className="divide-y divide-brand-50">
                  {ferias.map(f => {
                    const aberto = expandido === f.id
                    return (
                      <div key={f.id}>
                        <button
                          onClick={() => setExpandido(aberto ? null : f.id)}
                          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-brand-50 transition text-left"
                        >
                          <div>
                            <p className="text-sm font-medium text-brand-800">
                              {new Date(f.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} — {new Date(f.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-xs text-brand-400">{f.dias} dias · Período: {f.periodo_aquisitivo}</p>
                          </div>
                          {aberto ? <ChevronUp size={14} className="text-brand-400 shrink-0" /> : <ChevronDown size={14} className="text-brand-400 shrink-0" />}
                        </button>
                        {aberto && (
                          <div className="px-4 pb-3 flex items-center gap-3 bg-brand-50">
                            <div className="flex-1 text-xs text-brand-500">
                              <span>Início: {new Date(f.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              <span className="mx-2">·</span>
                              <span>Fim: {new Date(f.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              <span className="mx-2">·</span>
                              <span>{f.dias} dias corridos</span>
                            </div>
                            {f.url ? (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-800 bg-white hover:bg-accent-50 border border-accent-200 px-3 py-1.5 rounded-lg transition"
                              >
                                <Download size={13} /> Baixar Aviso
                              </a>
                            ) : (
                              <span className="text-xs text-brand-300">Documento indisponível</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Informativo */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-700">
            <strong>Precisa de algo mais?</strong> Entre em contato com o escritório para solicitar segunda via, esclarecimentos ou qualquer outra necessidade de RH.
          </p>
        </div>

        {/* Rodapé */}
        <div className="text-center py-2">
          <p className="text-xs text-brand-400">
            <strong>NascenteContábil</strong> · Autoatendimento RH · Dados filtrados por CPF/matrícula
          </p>
        </div>
      </div>
    </div>
  )
}
