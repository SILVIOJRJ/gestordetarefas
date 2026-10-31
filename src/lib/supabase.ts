import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const supabaseKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''

// Cliente tipado com o schema unificado
export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
