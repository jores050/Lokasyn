'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const ROLE_LABELS: Record<string, string> = {
  locataire: 'Locataire', bailleur: 'Bailleur', agence: 'Agence', admin: 'Admin',
}

export function OngletUtilisateurs() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('profiles')
      .select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setProfiles(data as Profile[]); setLoading(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="admin-loading">Chargement…</div>

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Nom</th><th>Rôle</th><th>Ville</th><th>KYC</th><th>Inscrit le</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map(p => (
            <tr key={p.id}>
              <td>{p.prenom} {p.nom}</td>
              <td><span className={`role-badge role-${p.role}`}>{ROLE_LABELS[p.role] || p.role}</span></td>
              <td>{p.ville || '—'}</td>
              <td>{p.kyc_verifie ? '✓' : '—'}</td>
              <td>{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
