'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Lock, Mail, Eye, EyeOff, Loader2, Zap } from 'lucide-react'

type Mode = 'password' | 'magic-link'

export default function LoginPage() {
  const [mode, setMode]           = useState<Mode>('password')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'magic-link') {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        })
        if (err) throw err
        setSuccess('Link mágico enviado! Verifique sua caixa de entrada.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        window.location.href = '/dashboard'
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar.'
      setError(
        msg === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : msg,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Painel esquerdo (branding) — oculto em mobile ─── */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center font-bold text-brand-900">
            N
          </div>
          <span className="text-white font-semibold text-lg">Nascente Contábil</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Portal Enterprise<br />
            <span className="text-accent-400">unificado.</span>
          </h1>
          <p className="text-brand-400 text-lg max-w-sm">
            Gerencie tarefas, clientes, obrigações e documentos com segurança e eficiência.
          </p>
        </div>

        <p className="text-brand-600 text-sm">
          © {new Date().getFullYear()} Nascente Contábil. Todos os direitos reservados.
        </p>
      </div>

      {/* ── Painel direito (formulário) ────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-brand-50">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-brand-900 flex items-center justify-center font-bold text-accent-400">
              N
            </div>
            <span className="font-semibold text-brand-900">Nascente Contábil</span>
          </div>

          <h2 className="text-2xl font-bold text-brand-900 mb-1">Bem-vindo de volta</h2>
          <p className="text-brand-500 text-sm mb-8">Acesse seu portal de gestão.</p>

          {/* Tabs de modo */}
          <div className="flex rounded-lg bg-brand-200 p-1 mb-6">
            {(['password', 'magic-link'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                className={[
                  'flex-1 py-2 rounded-md text-sm font-medium transition-all',
                  mode === m
                    ? 'bg-white text-brand-900 shadow-sm'
                    : 'text-brand-500 hover:text-brand-700',
                ].join(' ')}
              >
                {m === 'password' ? (
                  <span className="flex items-center justify-center gap-1.5"><Lock size={14} />Senha</span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5"><Zap size={14} />Magic Link</span>
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div>
              <label className="input-label" htmlFor="email">E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@escritorio.com.br"
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Senha — só no modo password */}
            {mode === 'password' && (
              <div>
                <label className="input-label" htmlFor="password">Senha</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-700"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Feedback */}
            {error   && <p className="text-sm text-danger-600 bg-danger-100 px-3 py-2 rounded-lg">{error}</p>}
            {success && <p className="text-sm text-accent-700 bg-accent-100 px-3 py-2 rounded-lg">{success}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : mode === 'password' ? 'Entrar' : 'Enviar link mágico'
              }
            </button>
          </form>

          {mode === 'password' && (
            <p className="text-center text-sm text-brand-400 mt-6">
              Esqueceu a senha?{' '}
              <button
                onClick={() => setMode('magic-link')}
                className="text-brand-700 font-medium hover:underline"
              >
                Use o Magic Link
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
