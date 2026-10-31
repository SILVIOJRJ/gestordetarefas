import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

const supabaseUrl  = process.env['NEXT_PUBLIC_SUPABASE_URL']!
const supabaseKey  = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não definidas. ' +
    'Copie .env.local.example para .env.local e preencha os valores.',
  )
}

// Cliente tipado com o schema unificado do Passo 1
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseKey)
