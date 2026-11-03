'use client'

import { useEffect, useState, useRef } from 'react'
import Shell from '@/components/layout/Shell'
import { supabase } from '@/lib/supabase'
import { Camera, Save, Loader2, User } from 'lucide-react'

const SETORES = ['Legalização', 'Fiscal', 'RH', 'Office Boy', 'Gerencial', 'Administrativo']

export default function PerfilPage() {
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [salvo, setSalvo]       = useState(false)
  const [userId, setUserId]     = useState('')
  const [nome, setNome]         = useState('')
  const [email, setEmail]       = useState('')
  const [setor, setSetor]       = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro]           = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? '')

      const { data: p } = await (supabase.from('perfis_usuarios') as any)
        .select('nome, email, setor, avatar_url')
        .eq('id', user.id)
        .single()

      if (p) {
        setNome(p.nome ?? '')
        setEmail(p.email ?? user.email ?? '')
        setSetor(p.setor ?? '')
        setAvatarUrl(p.avatar_url ?? null)
      }
      setLoading(false)
    })()
  }, [])

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${userId}.${ext}`
      await supabase.storage.from('documentos').upload(path, file, { upsert: true })
      const { data: signed } = await supabase.storage.from('documentos').createSignedUrl(path, 60 * 60 * 24 * 365)
      const url = signed?.signedUrl ?? null
      if (url) {
        await (supabase.from('perfis_usuarios') as any).update({ avatar_url: url }).eq('id', userId)
        setAvatarUrl(url)
      }
    } finally {
      setUploading(false)
    }
  }

  async function salvar() {
    if (!userId) return
    setErro(null)
    setSaving(true)
    try {
      const { error } = await (supabase.from('perfis_usuarios') as any)
        .update({ nome, setor: setor || null })
        .eq('id', userId)
      if (error) {
        setErro(error.message)
      } else {
        setSalvo(true)
        setTimeout(() => setSalvo(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <User size={22} className="text-brand-600" />
          <h1 className="text-xl font-bold text-brand-800">Meu Perfil</h1>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover ring-4 ring-brand-100" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-brand-700 flex items-center justify-center text-3xl font-bold text-white">
                {nome.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent-600 hover:bg-accent-700 text-white rounded-full flex items-center justify-center shadow-lg transition"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <p className="text-xs text-brand-400">Clique no ícone para alterar a foto</p>
        </div>

        {/* Campos */}
        <div className="bg-white border border-brand-100 rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-xs text-brand-500 block mb-1">Nome</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full border border-brand-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="text-xs text-brand-500 block mb-1">E-mail</label>
            <input
              value={email}
              disabled
              className="w-full border border-brand-100 rounded-xl px-3 py-2 text-sm text-brand-400 bg-brand-50 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs text-brand-500 block mb-1">Setor</label>
            <select
              value={setor}
              onChange={e => setSetor(e.target.value)}
              className="w-full border border-brand-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
            >
              <option value="">— não informado —</option>
              {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {erro && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
            {erro}
          </div>
        )}

        <button
          onClick={salvar}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium py-3 rounded-xl transition disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {salvo ? 'Salvo!' : 'Salvar alterações'}
        </button>
      </div>
    </Shell>
  )
}
