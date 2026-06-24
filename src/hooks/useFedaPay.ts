'use client'

import { useEffect, useRef } from 'react'

interface FedaPayOptions {
  token: string
  onComplete: (transaction: { id: number; status: string }) => void
  onError?: (error: unknown) => void
  onCancel?: () => void
}

export function useFedaPay() {
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (scriptLoaded.current) return
    const script = document.createElement('script')
    script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'
    script.async = true
    document.head.appendChild(script)
    scriptLoaded.current = true
  }, [])

  function openWidget({ token, onComplete, onError, onCancel }: FedaPayOptions) {
    if (typeof window === 'undefined' || !(window as any).FedaPay) {
      console.error('[FEDAPAY] Widget non chargé')
      return
    }

    ;(window as any).FedaPay.init({
      public_key: process.env.NEXT_PUBLIC_FEDAPAY_PUBLIC_KEY,
      transaction: { token },
      container: 'body',
      onComplete: (transaction: any) => {
        if (transaction.reason === (window as any).FedaPay.DIALOG_DISMISSED) {
          onCancel?.()
          return
        }
        onComplete({ id: transaction.id, status: transaction.status })
      },
      onError: (err: unknown) => {
        console.error('[FEDAPAY] Erreur widget:', err)
        onError?.(err)
      }
    }).open()
  }

  return { openWidget }
}
