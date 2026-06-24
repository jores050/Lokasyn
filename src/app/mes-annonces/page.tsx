'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA } from '@/lib/utils'
import type { Logement } from '@/types/database'

const STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  libre:         { label: 'Libre',         cls: 'badge-green' },
  loue:          { label: 'Loué',          cls: 'badge-amber' },
  en_moderation: { label: 'En modération', cls: 'badge-ink'   },
  sous_reserve:  { label: 'Sous réserve',  cls: 'badge-amber' },
  archive:       { label: 'Archivé',       cls: 'badge-ink'   },
}

export default function MesAnnoncesPage() {
  const { user } = useAppStore()
  const supabase = createClient()
  const [annonces, setAnnonces] = useState<Logement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('logements')
      .select('*').eq('bailleur_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setAnnonces((data || []) as Logement[])
        setLoading(false)
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="mes-annonces-screen">
      <div style={{ padding: 16 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="boost-listing-item" style={{ marginBottom: 12 }}>
            <div className="skeleton" style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div className="empty-state">
      <div className="empty-icon"><AlertTriangle size={40} strokeWidth={1.25} /></div>
      <h3>Erreur</h3><p>{error}</p>
    </div>
  )

  return (
    <div className="mes-annonces-screen">
      <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Mes annonces</h2>
        <Link href="/publish" className="btn btn-primary btn-sm">+ Publier</Link>
      </div>

      {annonces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Building2 size={40} strokeWidth={1.25} /></div>
          <h3>Aucune annonce</h3>
          <p>Publiez votre première annonce !</p>
          <Link href="/publish" className="btn btn-primary">+ Publier</Link>
        </div>
      ) : (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {annonces.map(l => {
            const st = STATUT_LABELS[l.statut] || { label: l.statut, cls: 'badge-ink' }
            return (
              <div key={l.id} className="boost-listing-item">
                <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: 'var(--sand-dark)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {l.photos?.[0]
                    ? <img src={l.photos[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" alt="" />
                    : <Building2 size={24} strokeWidth={1.5} color="var(--ink-light)" />
                  }
                </div>
                <div className="boost-listing-info">
                  <div className="boost-listing-title">{l.titre}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    <span style={{ color: 'var(--ink-light)', fontSize: '0.8125rem' }}>· {l.vues || 0} vues · {l.contacts || 0} contacts</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--green)', marginTop: 4 }}>
                    {formatFCFA(l.loyer_mensuel)}/mois
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <Link href={`/listing/${l.id}`} className="btn btn-secondary btn-sm">Voir</Link>
                  {l.statut === 'libre' && !l.boost_actif && (
                    <Link href={`/boost`} className="btn btn-sm" style={{ background: 'var(--amber)', color: 'white', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', textAlign: 'center' }}>Booster</Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
