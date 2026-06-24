'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function PaiementRetourInner() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  useEffect(() => {
    const msg = { type: 'fedapay_retour', status: status || 'annule' }
    if (window.parent !== window) {
      // Dans un iframe — notifie le parent puis se ferme
      window.parent.postMessage(msg, window.location.origin)
    } else {
      // Navigation directe (pas d'iframe) — redirection normale
      window.location.replace(
        status === 'confirme' ? '/messages?paiement=confirme' : '/messages?paiement=annule'
      )
    }
  }, [status])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#555' }}>
      Retour en cours…
    </div>
  )
}

export default function PaiementRetour() {
  return (
    <Suspense>
      <PaiementRetourInner />
    </Suspense>
  )
}
