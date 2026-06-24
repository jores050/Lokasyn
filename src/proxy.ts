import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROUTES_BAILLEUR = ['/publish', '/mes-annonces', '/loyers', '/boost', '/solde']
const ROUTES_AUTH = [
  ...ROUTES_BAILLEUR,
  '/messages', '/chat', '/profile', '/contrats', '/favoris',
]

export async function proxy(request: NextRequest) {
  // CRITIQUE : supabaseResponse doit être réassignable dans setAll
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Étape 1 : propager dans la requête (pour les Server Components en aval)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Étape 2 : recréer la réponse avec les headers mis à jour
          supabaseResponse = NextResponse.next({ request })
          // Étape 3 : propager dans la réponse (pour le navigateur)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITIQUE : getUser() rafraîchit le token et déclenche setAll si nécessaire
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Redirect non-authentifiés vers /auth
  if (ROUTES_AUTH.some(r => path.startsWith(r)) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('redirect', path)
    const redirectResponse = NextResponse.redirect(url)
    // Copier les cookies Supabase dans la réponse de redirection
    supabaseResponse.cookies.getAll().forEach(cookie =>
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    )
    return redirectResponse
  }

  // Restriction rôle bailleur/agence
  if (ROUTES_BAILLEUR.some(r => path.startsWith(r)) && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['bailleur', 'agence'].includes(profile.role)) {
      const redirectResponse = NextResponse.redirect(new URL('/', request.url))
      supabaseResponse.cookies.getAll().forEach(cookie =>
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      )
      return redirectResponse
    }
  }

  // Admin
  if (path.startsWith('/admin')) {
    if (!user) {
      const redirectResponse = NextResponse.redirect(new URL('/auth', request.url))
      supabaseResponse.cookies.getAll().forEach(cookie =>
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      )
      return redirectResponse
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role !== 'admin') {
      const redirectResponse = NextResponse.redirect(new URL('/', request.url))
      supabaseResponse.cookies.getAll().forEach(cookie =>
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      )
      return redirectResponse
    }
  }

  // Retourner supabaseResponse (pas NextResponse.next()) pour conserver les cookies
  return supabaseResponse
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
  ],
}
