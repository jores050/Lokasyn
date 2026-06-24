import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROUTES_BAILLEUR = ['/publish', '/mes-annonces', '/loyers', '/boost', '/solde']
const ROUTES_AUTH = [
  ...ROUTES_BAILLEUR,
  '/messages', '/chat', '/profile', '/contrats', '/favoris', '/payment-caution', '/payment-loyer',
]

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Redirect non-authentifiés vers /auth
  if (ROUTES_AUTH.some(r => path.startsWith(r)) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // Restriction rôle bailleur/agence
  if (ROUTES_BAILLEUR.some(r => path.startsWith(r)) && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['bailleur', 'agence'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Admin
  if (path.startsWith('/admin')) {
    if (!user) return NextResponse.redirect(new URL('/auth', request.url))
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/publish/:path*', '/mes-annonces/:path*', '/loyers/:path*',
    '/boost/:path*', '/solde/:path*', '/messages/:path*', '/chat/:path*',
    '/profile/:path*', '/admin/:path*', '/contrats/:path*',
    '/favoris/:path*', '/payment-caution/:path*', '/payment-loyer/:path*',
  ],
}
