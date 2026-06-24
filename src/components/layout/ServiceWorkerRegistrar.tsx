'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Enregistré:', reg.scope))
        .catch((err) => console.error('[SW] Erreur:', err))
    }
  }, [])

  return null
}
