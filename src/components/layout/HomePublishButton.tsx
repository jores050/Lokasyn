'use client'

import Link from 'next/link'
import { useAppStore } from '@/lib/store'

export function HomePublishButton() {
  const { profile } = useAppStore()
  const peutPublier = profile && (profile.role === 'bailleur' || profile.role === 'agence')
  if (!peutPublier) return null
  return (
    <Link href="/publish" className="btn btn-primary btn-sm">+ Publier</Link>
  )
}
