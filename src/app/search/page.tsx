'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Search, BadgeCheck, GraduationCap, List, Map } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ListingCard } from '@/components/listing/ListingCard'
import { debounce } from '@/lib/utils'
import type { Logement } from '@/types/database'

const SearchMap = dynamic(() => import('@/components/map/SearchMap'), {
  ssr: false,
  loading: () => <div style={{ height: 'calc(100vh - 180px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)' }}>Chargement de la carte…</div>,
})

const PAGE_SIZE = 8

interface SearchFilters {
  search: string
  type: string
  loyer_max: string
  meuble: boolean
  verifie: boolean
  badge_etudiant: boolean
}

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const [viewMode, setViewMode] = useState<'liste' | 'carte'>('liste')
  const [filters, setFilters] = useState<SearchFilters>({
    search: searchParams.get('q') || '',
    type: '', loyer_max: '',
    meuble: false, verifie: false, badge_etudiant: false,
  })
  const [results, setResults] = useState<Logement[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)

  async function fetchResults(f: SearchFilters, off: number, append = false) {
    setLoading(true)
    let query = supabase
      .from('logements')
      .select('*, profiles!bailleur_id(nom, prenom, note_moyenne, photo_url)', { count: 'exact' })
      .eq('statut', 'libre')
      .order('boost_actif', { ascending: false })
      .order('created_at', { ascending: false })
      .range(off, off + PAGE_SIZE - 1)

    if (f.type) query = query.eq('type', f.type)
    if (f.loyer_max) query = query.lte('loyer_mensuel', parseInt(f.loyer_max))
    if (f.meuble) query = query.eq('meuble', true)
    if (f.verifie) query = query.eq('verifie', true)
    if (f.badge_etudiant) query = query.eq('badge_etudiant', true)
    if (f.search.trim()) query = query.or(`quartier.ilike.%${f.search}%,titre.ilike.%${f.search}%,ville.ilike.%${f.search}%`)

    const { data, count } = await query
    setTotal(count || 0)
    setResults(prev => append ? [...prev, ...(data || []) as Logement[]] : (data || []) as Logement[])
    setLoading(false)
  }

  const debouncedFetch = useCallback(
    debounce((f: SearchFilters) => { setOffset(0); fetchResults(f, 0) }, 350),
    []
  ) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchResults(filters, 0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    const next = { ...filters, [key]: value }
    setFilters(next)
    if (key === 'search') debouncedFetch(next)
    else { setOffset(0); fetchResults(next, 0) }
  }

  function loadMore() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchResults(filters, next, true)
  }

  return (
    <div className="search-screen">
      <div className="search-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--white)', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
          <Link href="/" style={{ flexShrink: 0, color: 'var(--ink)' }}><ArrowLeft size={24} /></Link>
          <div className="search-bar" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sand)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>
            <Search size={16} style={{ color: 'var(--ink-mid)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Quartier, ville, type…"
              autoComplete="off"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.9375rem' }}
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          <select
            className="form-select"
            style={{ minWidth: 130, padding: '8px 36px 8px 12px', fontSize: '0.8125rem' }}
            value={filters.type}
            onChange={e => setFilter('type', e.target.value)}
          >
            <option value="">Tous types</option>
            {['chambre','studio','f2','f3','f4plus','villa','local'].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ minWidth: 140, padding: '8px 36px 8px 12px', fontSize: '0.8125rem' }}
            value={filters.loyer_max}
            onChange={e => setFilter('loyer_max', e.target.value)}
          >
            <option value="">Budget max</option>
            {[15000,25000,40000,60000,100000].map(v => (
              <option key={v} value={String(v)}>≤ {v.toLocaleString('fr')} FCFA</option>
            ))}
          </select>
        </div>

        <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {([
            { key: 'verifie', label: 'Vérifié', icon: <BadgeCheck size={14} /> },
            { key: 'meuble', label: 'Meublé', icon: null },
            { key: 'badge_etudiant', label: 'Étudiant OK', icon: <GraduationCap size={14} /> },
          ] as const).map(({ key, label, icon }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--ink-mid)' }}>
              <input
                type="checkbox"
                style={{ accentColor: 'var(--green)' }}
                checked={filters[key]}
                onChange={e => setFilter(key, e.target.checked)}
              />
              {icon} {label}
            </label>
          ))}
        </div>

        <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-light)' }}>
            {loading ? 'Recherche en cours…' : `${total} résultat${total !== 1 ? 's' : ''}`}
          </span>
          <div style={{ display: 'flex', border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('liste')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', background: viewMode === 'liste' ? 'var(--green)' : 'transparent', color: viewMode === 'liste' ? 'white' : 'var(--ink-mid)' }}
            >
              <List size={14} /> Liste
            </button>
            <button
              onClick={() => setViewMode('carte')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: 'none', borderLeft: '1px solid var(--border-light)', cursor: 'pointer', fontSize: '0.8125rem', background: viewMode === 'carte' ? 'var(--green)' : 'transparent', color: viewMode === 'carte' ? 'white' : 'var(--ink-mid)' }}
            >
              <Map size={14} /> Carte
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'carte' ? (
        <SearchMap logements={results} onMarkerClick={id => router.push(`/listing/${id}`)} />
      ) : (
        <>
          <div className="listings-grid" style={{ padding: '12px 16px' }}>
            {loading && results.length === 0
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="listing-card">
                    <div className="skeleton" style={{ aspectRatio: '4/3' }} />
                    <div style={{ padding: 12 }}>
                      <div className="skeleton" style={{ height: 18, marginBottom: 8 }} />
                      <div className="skeleton" style={{ height: 14, width: '60%' }} />
                    </div>
                  </div>
                ))
              : results.map(l => <ListingCard key={l.id} logement={l} />)
            }
          </div>

          {!loading && results.length === 0 && (
            <div className="empty-state">
              <h3>Aucun résultat</h3>
              <p>Essayez de modifier vos filtres</p>
            </div>
          )}

          {results.length < total && !loading && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <button className="btn btn-secondary" onClick={loadMore}>Charger plus</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function SearchPage() {
  return <Suspense><SearchContent /></Suspense>
}
