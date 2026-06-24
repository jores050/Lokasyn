'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function StatsStrip() {
  const [stats, setStats] = useState({ logements: 0, bailleurs: 0, contacts: 0 })
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('logements').select('*', { count: 'exact', head: true }).eq('statut', 'libre'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['bailleur', 'agence']),
      supabase.from('logements').select('contacts'),
    ]).then(([logements, bailleurs, contactsRes]) => {
      const totalContacts = contactsRes.data?.reduce((s, l) => s + (l.contacts || 0), 0) || 0
      setStats({
        logements: logements.count || 0,
        bailleurs: bailleurs.count || 0,
        contacts: totalContacts,
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stats-strip">
      <div className="stats-strip-item">
        <div className="stats-strip-value">{stats.logements}</div>
        <div className="stats-strip-label">logements</div>
      </div>
      <div className="stats-strip-item">
        <div className="stats-strip-value">{stats.bailleurs}</div>
        <div className="stats-strip-label">bailleurs</div>
      </div>
      <div className="stats-strip-item">
        <div className="stats-strip-value">{stats.contacts}</div>
        <div className="stats-strip-label">mises en relation</div>
      </div>
    </div>
  )
}
