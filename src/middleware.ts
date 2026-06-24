import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROUTES_AUTH = [
  '/messages', '/chat', '/profile', '/favoris',
  '/contrats', '/publish', '/mes-annonces',
  '/loyers', '/boost', '/solde'
]

const ROUTES_BAILLEUR = [
  '/publish', '/mes-annonces', '/loyers', '/boost', '/solde'
]

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const path = request.nextUrl.pathname

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const needsAuth = ROUTES_AUTH.some(r => path.startsWith(r))
  if (needsAuth && !user) {
    const url = new URL('/auth', request.url)
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  const needsBailleur = ROUTES_BAILLEUR.some(r => path.startsWith(r))
  if (needsBailleur && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['bailleur', 'agence'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (path.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }
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
    '/admin/:path*',
    '/publish/:path*',
    '/mes-annonces/:path*',
    '/loyers/:path*',
    '/boost/:path*',
    '/solde/:path*',
    '/messages/:path*',
    '/chat/:path*',
    '/profile/:path*',
    '/favoris/:path*',
    '/contrats/:path*',
  ]
}
