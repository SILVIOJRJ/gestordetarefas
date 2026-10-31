import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Fallback evita erro "supabaseUrl is required" durante prerender no build do Vercel.
// Em produção, as variáveis reais são usadas via Environment Variables do Vercel.
const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'https://placeholder.supabase.co'
const supabaseKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? 'placeholder-anon-key'

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
