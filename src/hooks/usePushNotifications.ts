'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const array = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) array[i] = rawData.charCodeAt(i)
  return array.buffer
}

export function usePushNotifications(userId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window)
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  async function souscrire() {
    if (!userId) return

    const registration = await navigator.serviceWorker.ready

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    })

    const sub = subscription.toJSON()

    await supabase.from('push_subscriptions').upsert(
      {
        utilisateur_id: userId,
        endpoint: sub.endpoint!,
        p256dh: sub.keys!.p256dh,
        auth: sub.keys!.auth,
      },
      { onConflict: 'utilisateur_id,endpoint' }
    )

    console.log('[PUSH] Souscription enregistrée')
  }

  async function demanderPermission(): Promise<boolean> {
    if (!isSupported || !userId) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') return false

      await souscrire()
      return true
    } catch (e) {
      console.error('[PUSH] Erreur demande permission:', e)
      return false
    }
  }

  return { permission, isSupported, demanderPermission }
}
