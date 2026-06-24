'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFCFA } from '@/lib/utils'

interface Stats {
  totalLogements: number
  logementsLibres: number
  totalUtilisateurs: number
  totalPaiementsConfirmes: number
  caTotal: number
}

export function OngletStats() {
  const [stats, setStats] = useState<Stats>({
    totalLogements: 0, logementsLibres: 0,
    totalUtilisateurs: 0, totalPaiementsConfirmes: 0, caTotal: 0,
  })
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('logements').select('*', { count: 'exact', head: true }),
      supabase.from('logements').select('*', { count: 'exact', head: true }).eq('statut', 'libre'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('paiements').select('montant').eq('statut', 'confirme'),
    ]).then(([total, libres, users, paiements]) => {
      const caTotal = (paiements.data || []).reduce((sum, p) => sum + (p.montant as number), 0)
      setStats({
        totalLogements:          total.count   || 0,
        logementsLibres:         libres.count  || 0,
        totalUtilisateurs:       users.count   || 0,
        totalPaiementsConfirmes: paiements.data?.length || 0,
        caTotal,
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cards = [
    { label: 'Logements publiés',    value: stats.totalLogements },
    { label: 'Logements disponibles', value: stats.logementsLibres },
    { label: 'Utilisateurs',          value: stats.totalUtilisateurs },
    { label: 'Paiements confirmés',   value: stats.totalPaiementsConfirmes },
    { label: 'CA total',              value: formatFCFA(stats.caTotal), wide: true },
  ]

  return (
    <div className="stats-grid">
      {cards.map(({ label, value, wide }) => (
        <div key={label} className={`stat-card${wide ? ' stat-card--wide' : ''}`}>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
      ))}
    </div>
  )
}
