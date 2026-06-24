'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { ListingCard } from '@/components/listing/ListingCard'
import type { Logement } from '@/types/database'

export default function FavorisPage() {
  const { user } = useAppStore()
  const supabase = createClient()
  const [favoris, setFavoris] = useState<Logement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    supabase
      .from('favoris')
      .select('logements(*, profiles!bailleur_id(nom, prenom, note_moyenne, photo_url))')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const list = (data || [])
          .map((row: Record<string, unknown>) => row.logements)
          .filter(Boolean) as Logement[]
        setFavoris(list)
        setLoading(false)
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user?.id) return (
    <div className="favoris-screen">
      <div className="empty-state" style={{ paddingTop: 60 }}>
        <div className="empty-icon"><Heart size={40} strokeWidth={1.25} /></div>
        <h3>Connectez-vous</h3>
        <p>Sauvegardez vos logements préférés</p>
        <Link href="/auth?redirect=/favoris" className="btn btn-primary">Se connecter</Link>
      </div>
    </div>
  )

  return (
    <div className="favoris-screen">
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ margin: 0 }}>Mes favoris</h2>
      </div>

      {loading ? (
        <div className="listings-grid" style={{ padding: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="listing-card">
              <div className="skeleton" style={{ aspectRatio: '4/3' }} />
              <div style={{ padding: 12 }}>
                <div className="skeleton" style={{ height: 18, marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : favoris.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Heart size={40} strokeWidth={1.25} /></div>
          <h3>Aucun favori</h3>
          <p>Appuyez sur ♥ pour sauvegarder un logement</p>
          <Link href="/" className="btn btn-primary">Explorer</Link>
        </div>
      ) : (
        <div className="listings-grid" style={{ padding: 16 }}>
          {favoris.map(l => <ListingCard key={l.id} logement={l} />)}
        </div>
      )}
    </div>
  )
}
