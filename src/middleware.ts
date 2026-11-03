import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/portal', '/meu-rh', '/_next', '/favicon', '/api']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Verifica presença do cookie de sessão do Supabase (sb-*-auth-token)
  const hasSession = request.cookies.getAll().some(c => c.name.includes('-auth-token'))

  if (!hasSession) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
