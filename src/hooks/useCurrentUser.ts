'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import type { Profile } from '@/types/database'

export function useCurrentUser() {
  const { user, profile, setUser, setProfile, setUnreadCount } = useAppStore()
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  async function chargerUnread(userId: string) {
    const supabase = createClient()
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('utilisateur_id', userId)
      .eq('lue', false)
      .eq('type', 'nouveau_message')
    setUnreadCount(count || 0)
  }

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const uid = session.user.id
        setUser({ id: uid, email: session.user.email! })
        supabase.from('profiles').select('*').eq('id', uid).single()
          .then(({ data }) => { if (data) setProfile(data as Profile) })

        chargerUnread(uid)

        // Realtime : badge se met à jour instantanément à chaque INSERT ou UPDATE
        channelRef.current = supabase
          .channel(`notif-badge:${uid}`)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'notifications',
            filter: `utilisateur_id=eq.${uid}`,
          }, () => chargerUnread(uid))
          .subscribe()
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
        chargerUnread(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setUnreadCount(0)
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
      }
    })

    return () => {
      subscription.unsubscribe()
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    }
  }, [setUser, setProfile, setUnreadCount]) // eslint-disable-line react-hooks/exhaustive-deps

  return { user, profile, isLoading: user === null && profile === null }
}
