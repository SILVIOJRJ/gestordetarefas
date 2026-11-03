import { NextResponse, type NextRequest } from 'next/server'

// Auth é verificada em cada página individualmente via supabase.auth.getUser()
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
