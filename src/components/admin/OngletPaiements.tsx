'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFCFA } from '@/lib/utils'

interface PaiementRow {
  id: string
  type: string
  montant: number
  statut: string
  created_at: string
  payeur: { nom: string; prenom: string } | null
  logements: { titre: string } | null
}

const STATUT_CLS: Record<string, string> = {
  confirme: 'success', en_attente: 'warning',
  en_cours: 'warning', echec: 'danger', rembourse: 'info',
}

export function OngletPaiements() {
  const [paiements, setPaiements] = useState<PaiementRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('paiements')
      .select('id, type, montant, statut, created_at, payeur:profiles!payeur_id(nom, prenom), logements(titre)')
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (data) setPaiements(data as unknown as PaiementRow[])
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="admin-loading">Chargement…</div>

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Payeur</th><th>Logement</th><th>Type</th>
            <th>Montant</th><th>Statut</th><th>Date</th>
          </tr>
        </thead>
        <tbody>
          {paiements.map(p => (
            <tr key={p.id}>
              <td>{p.payeur?.prenom} {p.payeur?.nom}</td>
              <td>{p.logements?.titre || '—'}</td>
              <td>{p.type}</td>
              <td>{formatFCFA(p.montant)}</td>
              <td>
                <span className={`statut-badge statut-${STATUT_CLS[p.statut] || 'neutral'}`}>
                  {p.statut}
                </span>
              </td>
              <td>{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
