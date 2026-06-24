'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ListingCard } from './ListingCard'
import { Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { restoreScroll } from '@/lib/scrollStore'
import type { Logement } from '@/types/database'

const PAGE_SIZE = 8

const FILTER_PILLS = [
  { label: 'Tous',       filter: '' },
  { label: 'Studios',    filter: 'studio' },
  { label: 'Chambres',   filter: 'chambre' },
  { label: 'F2',         filter: 'f2' },
  { label: 'F3',         filter: 'f3' },
  { label: 'Villas',     filter: 'villa' },
  { label: 'Meublé',     meuble: true },
  { label: 'Vérifié',    verifie: true },
  { label: 'Étudiant OK', etudiant: true },
]

interface Filters {
  type?: string
  meuble?: boolean
  verifie?: boolean
  etudiant?: boolean
  loyer_max?: number
}

async function fetchListings(filters: Filters, offset: number) {
  const supabase = createClient()
  let query = supabase
    .from('logements')
    .select('*, profiles!bailleur_id(nom, prenom, photo_url)')
    .eq('statut', 'libre')
    .order('boost_actif', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (filters.type) query = query.eq('type', filters.type)
  if (filters.meuble) query = query.eq('meuble', true)
  if (filters.verifie) query = query.eq('verifie', true)
  if (filters.etudiant) query = query.eq('badge_etudiant', true)
  if (filters.loyer_max) query = query.lte('loyer_mensuel', filters.loyer_max)

  return query
}

export function ListingGrid() {
  const [listings, setListings] = useState<Logement[]>([])
  const [featured, setFeatured] = useState<Logement[]>([])
  const [filters, setFilters] = useState<Filters>({})
  const [activeFilter, setActiveFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const { loadFavorites } = useAppStore()
  const supabase = createClient()

  const loadListings = useCallback(async (f: Filters, off: number, reset: boolean) => {
    setLoading(true)
    const { data } = await fetchListings(f, off)
    if (reset) {
      setListings(data || [])
    } else {
      setListings(prev => [...prev, ...(data || [])])
    }
    setHasMore((data?.length || 0) === PAGE_SIZE)
    setLoading(false)
  }, [])

  useEffect(() => {
    restoreScroll('home')
  }, [])

  useEffect(() => {
    // Featured boostés
    supabase
      .from('logements')
      .select('*, profiles!bailleur_id(nom, prenom, photo_url)')
      .eq('statut', 'libre')
      .eq('boost_actif', true)
      .limit(5)
      .then(({ data }) => setFeatured(data || []))

    // Favoris utilisateur
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('favoris').select('logement_id').eq('utilisateur_id', user.id)
          .then(({ data }) => loadFavorites((data || []).map((f: { logement_id: string }) => f.logement_id)))
      }
    })

    loadListings({}, 0, true)
  }, [loadListings, loadFavorites]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(pill: typeof FILTER_PILLS[number]) {
    const newFilters: Filters = {}
    let key = ''
    if ('filter' in pill && pill.filter) { newFilters.type = pill.filter; key = pill.filter }
    if ('meuble' in pill && pill.meuble) { newFilters.meuble = true; key = 'meuble' }
    if ('verifie' in pill && pill.verifie) { newFilters.verifie = true; key = 'verifie' }
    if ('etudiant' in pill && pill.etudiant) { newFilters.etudiant = true; key = 'etudiant' }
    setFilters(newFilters)
    setActiveFilter(key)
    setOffset(0)
    loadListings(newFilters, 0, true)
  }

  function loadMore() {
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    loadListings(filters, newOffset, false)
  }

  return (
    <>
      {/* Filtres pills */}
      <div className="scroll-x" style={{ paddingTop: 16 }}>
        {FILTER_PILLS.map(pill => (
          <button
            key={pill.label}
            className={`pill ${activeFilter === (('filter' in pill && pill.filter) || ('meuble' in pill && pill.meuble ? 'meuble' : '') || ('verifie' in pill && pill.verifie ? 'verifie' : '') || ('etudiant' in pill && pill.etudiant ? 'etudiant' : '')) ? 'active' : ''}`}
            onClick={() => applyFilter(pill)}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Filtre budget */}
      <div style={{ padding: '0 16px 4px' }}>
        <select
          className="form-select"
          style={{ fontSize: '0.8125rem', padding: '7px 32px 7px 10px' }}
          value={filters.loyer_max ?? ''}
          onChange={e => {
            const val = e.target.value ? parseInt(e.target.value) : undefined
            const next = { ...filters, loyer_max: val }
            setFilters(next)
            setOffset(0)
            loadListings(next, 0, true)
          }}
        >
          <option value="">Budget — Tous</option>
          {[15000, 25000, 40000, 60000, 100000].map(v => (
            <option key={v} value={v}>≤ {v.toLocaleString('fr')} FCFA</option>
          ))}
        </select>
      </div>

      {/* Section à la une */}
      {featured.length > 0 && (
        <div id="section-une">
          <div className="section-header">
            <div className="section-title"><Sparkles size={14} /> À la une</div>
          </div>
          <div className="featured-scroll">
            {featured.map(l => (
              <div key={l.id} className="featured-card-wrap">
                <ListingCard logement={l} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logements récents */}
      <div className="section-header">
        <div className="section-title">Logements récents</div>
      </div>

      {loading && listings.length === 0 ? (
        <div className="listings-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ aspectRatio: '4/3' }} />
              <div className="card-body">
                <div className="skeleton" style={{ height: 20, marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="listings-grid">
          {listings.map(l => <ListingCard key={l.id} logement={l} />)}
        </div>
      )}

      {hasMore && !loading && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <button className="btn btn-secondary" onClick={loadMore}>Voir plus de logements</button>
        </div>
      )}
    </>
  )
}
