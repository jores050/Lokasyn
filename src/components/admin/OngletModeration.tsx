'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFCFA } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface LogementEnAttente {
  id: string
  titre: string
  quartier: string
  ville: string
  loyer_mensuel: number
  created_at: string
  profiles: { nom: string; prenom: string } | null
}

export function OngletModeration() {
  const [logements, setLogements] = useState<LogementEnAttente[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { chargerLogements() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function chargerLogements() {
    const { data, error } = await supabase
      .from('logements')
      .select('id, titre, quartier, ville, loyer_mensuel, created_at, profiles!bailleur_id(nom, prenom)')
      .eq('statut', 'en_moderation')
      .order('created_at', { ascending: true })

    if (!error && data) setLogements(data as unknown as LogementEnAttente[])
    setLoading(false)
  }

  async function approuver(id: string) {
    const { error } = await supabase
      .from('logements')
      .update({ statut: 'libre', verifie: true, verifie_le: new Date().toISOString() })
      .eq('id', id)
    if (error) { showToast('Erreur : ' + error.message, 'error'); return }
    setLogements(prev => prev.filter(l => l.id !== id))
    showToast('Annonce approuvée ✓', 'success')
  }

  async function rejeter(id: string) {
    const motif = window.prompt('Motif du rejet :')
    if (!motif) return
    const { error } = await supabase
      .from('logements')
      .update({ statut: 'archive' })
      .eq('id', id)
    if (error) { showToast('Erreur : ' + error.message, 'error'); return }
    setLogements(prev => prev.filter(l => l.id !== id))
    showToast('Annonce rejetée', 'info')
  }

  if (loading) return <div className="admin-loading">Chargement…</div>
  if (!logements.length) return (
    <div className="admin-empty">Aucune annonce en attente de modération ✓</div>
  )

  return (
    <div className="admin-list">
      {logements.map(l => (
        <div key={l.id} className="admin-card">
          <div className="admin-card-info">
            <div className="admin-card-title">{l.titre}</div>
            <div className="admin-card-sub">
              {l.quartier}, {l.ville} · {formatFCFA(l.loyer_mensuel)}/mois
            </div>
            <div className="admin-card-meta">
              Par {l.profiles?.prenom} {l.profiles?.nom} · {new Date(l.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <div className="admin-card-actions">
            <button className="btn btn-primary btn-sm" onClick={() => approuver(l.id)}>Approuver</button>
            <button className="btn btn-secondary btn-sm" onClick={() => rejeter(l.id)}>Rejeter</button>
          </div>
        </div>
      ))}
    </div>
  )
}
