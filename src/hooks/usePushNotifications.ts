'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/components/ui/Toast'

// Retourne Uint8Array au runtime (requis par pushManager.subscribe),
// casté en ArrayBuffer pour contourner la contrainte TS sur les génériques.
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray as unknown as ArrayBuffer
}

export function usePushNotifications(userId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    setIsSupported(supported)
    if ('Notification' in window) {
      const perm = Notification.permission
      setPermission(perm)
      // Si permission déjà accordée → s'assurer que la souscription est en DB
      if (supported && perm === 'granted' && userId) {
        souscrire().catch(e => console.warn('[PUSH] Auto-souscription:', e))
      }
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function souscrire(): Promise<boolean> {
    if (!userId) { console.warn('[PUSH] souscrire: userId manquant'); return false }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    console.log('[PUSH] VAPID KEY:', vapidKey ? vapidKey.slice(0, 20) + '…' : 'UNDEFINED')
    if (!vapidKey) {
      console.error('[PUSH] NEXT_PUBLIC_VAPID_PUBLIC_KEY manquant')
      showToast('Clé VAPID manquante — vérifier les variables Vercel', 'error')
      return false
    }

    console.log('[PUSH] Attente serviceWorker.ready…')
    const registration = await navigator.serviceWorker.ready
    console.log('[PUSH] SW prêt:', registration.scope)

    let subscription: PushSubscription
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      console.log('[PUSH] PushSubscription créée:', subscription.endpoint)
    } catch (e) {
      console.error('[PUSH] pushManager.subscribe échoué:', e)
      showToast('Impossible de s\'abonner aux notifications push', 'error')
      return false
    }

    const sub = subscription.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        utilisateur_id: userId,
        endpoint: sub.endpoint!,
        p256dh: sub.keys!.p256dh,
        auth: sub.keys!.auth,
      },
      { onConflict: 'utilisateur_id,endpoint' }
    )

    if (error) {
      console.error('[PUSH] Erreur upsert push_subscriptions:', error)
      showToast(`Erreur DB push_subscriptions : ${error.message}`, 'error')
      return false
    }

    console.log('[PUSH] Souscription enregistrée en DB ✓')
    return true
  }

  async function demanderPermission(): Promise<boolean> {
    if (!isSupported) {
      showToast('Notifications non supportées sur ce navigateur', 'info')
      return false
    }
    if (!userId) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result === 'denied') {
        showToast('Permission refusée — modifiez les paramètres du navigateur', 'error')
        return false
      }
      if (result !== 'granted') return false

      const ok = await souscrire()
      if (ok) showToast('Notifications activées ✓', 'success')
      return ok
    } catch (e) {
      console.error('[PUSH] Erreur demanderPermission:', e)
      showToast('Erreur lors de l\'activation des notifications', 'error')
      return false
    }
  }

  return { permission, isSupported, demanderPermission }
}
