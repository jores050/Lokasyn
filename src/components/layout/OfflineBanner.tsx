'use client'

import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const onOffline = () => setIsOffline(true)
    const onOnline = () => setIsOffline(false)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return (
    <div className={`offline-banner${isOffline ? ' show' : ''}`}>
      📡 Connexion perdue — certaines fonctionnalités peuvent être indisponibles
    </div>
  )
}
