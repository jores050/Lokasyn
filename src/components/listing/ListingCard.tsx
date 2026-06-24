'use client'

import Link from 'next/link'
import { Heart, MapPin, Home, BedSingle, Building2, Building, Landmark, Store, BadgeCheck, Sparkles, GraduationCap } from 'lucide-react'
import { formatFCFA, truncate } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { saveScroll } from '@/lib/scrollStore'
import type { Logement } from '@/types/database'

const LOGEMENT_ICON: Record<string, React.ElementType> = {
  chambre: BedSingle, studio: Home, f2: Building2, f3: Building,
  f4plus: Building, villa: Landmark, local: Store,
}

interface ListingCardProps {
  logement: Logement
  compact?: boolean
}

export function ListingCard({ logement, compact = false }: ListingCardProps) {
  const { isFavorite, toggleFavorite } = useAppStore()
  const photo = logement.photos?.[0]
  const isFav = isFavorite(logement.id)
  const Icon = LOGEMENT_ICON[logement.type] || Home

  async function handleFavToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const nowFav = toggleFavorite(logement.id)
    if (nowFav) {
      await supabase.from('favoris').insert({ utilisateur_id: user.id, logement_id: logement.id })
    } else {
      await supabase.from('favoris').delete().eq('utilisateur_id', user.id).eq('logement_id', logement.id)
    }
  }

  return (
    <Link href={`/listing/${logement.id}`} className="listing-card fade-in" data-id={logement.id} onClick={() => saveScroll('home')}>
      <div className="listing-card-media">
        {photo
          ? <img src={photo} alt={logement.titre} loading="lazy" />
          : <div className="listing-card-placeholder"><Icon size={40} strokeWidth={1.25} /></div>
        }
        <button
          className={`listing-card-fav${isFav ? ' active' : ''}`}
          onClick={handleFavToggle}
          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>
        {(logement.boost_actif || logement.verifie || logement.badge_etudiant) && (
          <div className="listing-card-badges">
            {logement.boost_actif && <span className="badge badge-amber"><Sparkles size={12} /> Mis en avant</span>}
            {logement.verifie && <span className="badge badge-green"><BadgeCheck size={12} /> Vérifié</span>}
            {logement.badge_etudiant && <span className="badge badge-ink"><GraduationCap size={12} /> Étudiant OK</span>}
          </div>
        )}
      </div>
      <div className="listing-card-body">
        <div className="listing-card-price">
          {formatFCFA(logement.loyer_mensuel)}
          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--ink-light)' }}>/mois</span>
        </div>
        <div className="listing-card-title">{compact ? truncate(logement.titre, 30) : logement.titre}</div>
        <div className="listing-card-location">
          <MapPin size={12} />
          {logement.quartier}, {logement.ville}
        </div>
      </div>
    </Link>
  )
}
