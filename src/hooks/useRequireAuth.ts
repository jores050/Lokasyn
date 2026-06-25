'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'

/**
 * Redirige vers /auth si l'utilisateur n'est pas connecté,
 * mais ATTEND que isAuthChecked soit true pour décider.
 * Sans ce guard, le store Zustand (user: null au démarrage)
 * déclencherait un redirect prématuré avant que getSession() résolve.
 */
export function useRequireAuth(redirectPath: string) {
  const { user, isAuthChecked } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthChecked) return
    if (!user?.id) {
      router.push(`/auth?redirect=${redirectPath}`)
    }
  }, [user?.id, isAuthChecked, router, redirectPath])

  return {
    user,
    isAuthChecked,
    isReady: isAuthChecked && !!user?.id,
  }
}
