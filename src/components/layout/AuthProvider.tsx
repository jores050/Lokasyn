'use client'

import { useCurrentUser } from '@/hooks/useCurrentUser'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useCurrentUser()
  return <>{children}</>
}
