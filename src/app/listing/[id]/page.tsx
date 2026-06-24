'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, Heart, MapPin, Ruler, AlertCircle, FileText, Calendar,
  BadgeCheck, GraduationCap, Sofa, Sparkles, Droplet, Zap,
  ChevronLeft, ChevronRight, MessageCircle, Star, Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA, initiales, avatarColor, LOGEMENT_LABEL } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import type { Logement, Profile } from '@/types/database'

const ListingMiniMap = dynamic(() => import('@/components/listing/ListingMiniMap'), { ssr: false })

interface LogementDetail extends Omit<Logement, 'profiles'> {
  profiles: Pick<Profile, 'id' | 'nom' | 'prenom' | 'note_moyenne' | 'photo_url'> | null
}

function formatDateFr(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const BAIL_LABELS: Record<string, string> = {
  mensuel: 'Bail mensuel', annuel: 'Bail annuel',
  etudiant: 'Logement étudiant', court_terme: 'Court terme',
}

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, isFavorite, toggleFavorite } = useAppStore()
  const router = useRouter()
  const supabase = createClient()

  const [logement, setLogement] = useState<LogementDetail | null>(null)
  const [similar, setSimilar] = useState<Logement[]>([])
  const [loading, setLoading] = useState(true)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [isFav, setIsFav] = useState(false)
  const [contacting, setContacting] = useState(false)
  const [visiting, setVisiting] = useState(false)

  const startXRef = useRef(0)

  useEffect(() => {
    async function load() {
      const [{ data: l, error }, { data: sim }] = await Promise.all([
        supabase.from('logements')
          .select('*, profiles!bailleur_id(id, nom, prenom, note_moyenne, photo_url)')
          .eq('id', id).single(),
        supabase.from('logements')
          .select('id, titre, loyer_mensuel, quartier, ville, type, photos, boost_actif, verifie, badge_etudiant')
          .eq('statut', 'libre').neq('id', id).limit(5),
      ])

      if (error || !l) { setLoading(false); return }
      setLogement(l as unknown as LogementDetail)
      setSimilar((sim || []) as unknown as Logement[])
      setIsFav(isFavorite(id))
      setLoading(false)

      // Incrémenter vues (debounce 30 min)
      const key = `viewed_${id}`
      const last = localStorage.getItem(key)
      if (!last || Date.now() - parseInt(last) > 1_800_000) {
        supabase.rpc('increment_vues', { logement_id: id }).then(() => {
          localStorage.setItem(key, Date.now().toString())
        })
      }
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function getOrCreateConversation() {
    if (!user?.id || !logement) return null
    if (user.id === logement.bailleur_id) {
      showToast('Vous êtes le bailleur de ce logement', 'warning'); return null
    }
    const { data: existing } = await supabase.from('conversations')
      .select('id').eq('logement_id', id).eq('locataire_id', user.id).maybeSingle()
    if (existing) return existing.id

    const { data: newConv, error } = await supabase.from('conversations')
      .insert({ logement_id: id, locataire_id: user.id, bailleur_id: logement.bailleur_id })
      .select('id').single()
    if (error) throw error
    supabase.rpc('increment_contacts', { logement_id: id }).then(null, () => {})
    return newConv.id
  }

  async function handleContact() {
    if (!user?.id) { router.push(`/auth?redirect=/listing/${id}`); return }
    setContacting(true)
    try {
      const convId = await getOrCreateConversation()
      if (convId) router.push(`/chat/${convId}`)
    } catch { showToast('Erreur lors de la mise en relation', 'error') }
    setContacting(false)
  }

  async function handleVisit() {
    if (!user?.id) { router.push(`/auth?redirect=/listing/${id}`); return }
    setVisiting(true)
    try {
      const convId = await getOrCreateConversation()
      if (!convId) { setVisiting(false); return }
      await supabase.from('messages').insert({
        conversation_id: convId, expediteur_id: user.id,
        contenu: "Bonjour, j'aimerais visiter ce logement. Vous êtes disponible quand ?", type: 'texte',
      })
      router.push(`/chat/${convId}`)
    } catch { showToast('Erreur lors de la demande de visite', 'error') }
    setVisiting(false)
  }

  async function handleFav() {
    if (!user?.id) { router.push('/auth'); return }
    const next = await toggleFavorite(id)
    setIsFav(next)
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="skeleton" style={{ aspectRatio: '16/9', width: '100%' }} />
        <div style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 28, width: '70%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 20, width: '40%' }} />
        </div>
      </div>
    )
  }

  if (!logement) {
    return (
      <div className="empty-state" style={{ paddingTop: 80 }}>
        <h3>Logement introuvable</h3>
        <button className="btn btn-primary" onClick={() => router.back()}>Retour</button>
      </div>
    )
  }

  const photos = logement.photos || []
  const bailleur = logement.profiles
  const cautiontxt = `Caution : ${logement.caution_mois} mois (${formatFCFA(logement.loyer_mensuel * logement.caution_mois)})`
  const bailleurNom = bailleur ? `${bailleur.prenom || ''} ${bailleur.nom || ''}`.trim() : ''
  const bailleurColor = avatarColor(bailleurNom)
  const bailleurInis = initiales(bailleur?.nom || '', bailleur?.prenom || '')

  return (
    <div className="listing-detail-screen">
      {/* Header overlay */}
      <div className="listing-detail-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.9)', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <ArrowLeft size={20} />
        </button>
        <button onClick={handleFav} style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.9)', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <Heart size={20} fill={isFav ? 'var(--color-red)' : 'none'} color={isFav ? 'var(--color-red)' : 'inherit'} />
        </button>
      </div>

      {/* Galerie */}
      <div className="listing-gallery" style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: 'var(--sand-dark)', marginTop: 0 }}>
        <div
          className="listing-gallery-track"
          style={{ transform: `translateX(-${photoIdx * 100}%)`, display: 'flex', height: '100%', transition: 'transform 0.3s' }}
          onTouchStart={e => { startXRef.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            const diff = startXRef.current - e.changedTouches[0].clientX
            if (Math.abs(diff) > 40) setPhotoIdx(i => Math.max(0, Math.min(photos.length - 1, i + (diff > 0 ? 1 : -1))))
          }}
          onMouseDown={e => { startXRef.current = e.clientX }}
          onMouseUp={e => {
            const diff = startXRef.current - e.clientX
            if (Math.abs(diff) > 40) setPhotoIdx(i => Math.max(0, Math.min(photos.length - 1, i + (diff > 0 ? 1 : -1))))
          }}
        >
          {photos.length
            ? photos.map((p, i) => (
                <div key={i} style={{ flex: '0 0 100%', height: '100%' }}>
                  <img src={p} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading={i === 0 ? 'eager' : 'lazy'} />
                </div>
              ))
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🏠</div>
          }
        </div>
        {photos.length > 1 && (
          <>
            <button className="gallery-btn gallery-btn--prev" onClick={() => setPhotoIdx(i => Math.max(0, i - 1))} style={{ opacity: photoIdx === 0 ? 0.3 : 1 }}><ChevronLeft size={24} /></button>
            <button className="gallery-btn gallery-btn--next" onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))} style={{ opacity: photoIdx === photos.length - 1 ? 0.3 : 1 }}><ChevronRight size={24} /></button>
            <div className="listing-gallery-counter">{photoIdx + 1} / {photos.length}</div>
          </>
        )}
      </div>

      {/* Infos */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {logement.boost_actif && <span className="badge badge-amber"><Sparkles size={12} /> Mis en avant</span>}
          {logement.verifie && <span className="badge badge-green"><BadgeCheck size={12} /> Vérifié</span>}
          {logement.badge_etudiant && <span className="badge badge-ink"><GraduationCap size={12} /> Étudiant OK</span>}
          {logement.meuble && <span className="badge badge-ink"><Sofa size={12} /> Meublé</span>}
        </div>
        <div className="listing-price">{formatFCFA(logement.loyer_mensuel)}<span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--ink-light)' }}>/mois</span></div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '6px 0 4px' }}>{logement.titre}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-mid)', fontSize: '0.9375rem' }}>
          <MapPin size={14} /> {logement.quartier}, {logement.ville}
        </div>
        {logement.surface_m2 && <div style={{ marginTop: 6, fontSize: '0.875rem', color: 'var(--ink-mid)', display: 'flex', alignItems: 'center', gap: 4 }}><Ruler size={14} /> {logement.surface_m2} m²</div>}
        <div style={{ marginTop: 6, fontSize: '0.875rem', color: 'var(--ink-mid)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={14} /> {cautiontxt}</div>
        {logement.type_bail && <div style={{ marginTop: 6, fontSize: '0.875rem', color: 'var(--ink-mid)', display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={14} /> {BAIL_LABELS[logement.type_bail] || logement.type_bail}</div>}
        {logement.disponible_le && <div style={{ marginTop: 6, fontSize: '0.875rem', color: 'var(--ink-mid)', display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={14} /> Disponible le {formatDateFr(logement.disponible_le)}</div>}
      </div>

      {/* Charges incluses */}
      {(logement.eau_incluse || logement.electricite_incluse) && (
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
          {logement.eau_incluse && <span className="badge badge-green"><Droplet size={12} /> Eau incluse</span>}
          {logement.electricite_incluse && <span className="badge badge-green"><Zap size={12} /> Électricité incluse</span>}
        </div>
      )}

      {/* Équipements */}
      {(logement.equipements || []).length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>Équipements</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(logement.equipements || []).map(eq => (
              <span key={eq} className="badge badge-ink"><Check size={12} /> {eq}</span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {logement.description && (
        <div style={{ padding: '0 16px 20px' }}>
          <h3 style={{ marginBottom: 10, fontSize: '1rem' }}>Description</h3>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--ink-mid)', whiteSpace: 'pre-wrap' }}>{logement.description}</p>
        </div>
      )}

      {/* Mini-carte */}
      {logement.latitude && logement.longitude && (
        <div style={{ padding: '0 16px 16px' }}>
          <h3 style={{ marginBottom: 10, fontSize: '1rem' }}>Localisation</h3>
          <ListingMiniMap lat={logement.latitude} lng={logement.longitude} titre={logement.titre} />
        </div>
      )}

      <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />

      {/* Bailleur */}
      <div style={{ padding: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>Le bailleur</h3>
        {bailleur ? (
          <div className="bailleur-card">
            <div className="avatar avatar-lg" style={{ background: bailleurColor }}>
              {bailleur.photo_url ? <img src={bailleur.photo_url} alt={bailleurNom} /> : bailleurInis}
            </div>
            <div className="bailleur-card-info">
              <div className="bailleur-card-name">{bailleurNom}</div>
              <div className="bailleur-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={12} fill="var(--color-gold)" color="var(--color-gold)" />
                {bailleur.note_moyenne ? bailleur.note_moyenne.toFixed(1) : 'Nouveau'}
              </div>
              <div className="bailleur-card-meta">Répond généralement en moins de 24h</div>
            </div>
          </div>
        ) : <p style={{ color: 'var(--ink-light)' }}>Informations bailleur indisponibles</p>}
      </div>

      {/* Logements similaires */}
      {similar.length > 0 && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
          <div style={{ padding: '16px 0 4px' }}>
            <div className="section-header" style={{ padding: '0 16px', marginBottom: 12 }}>
              <div className="section-title">Logements similaires</div>
            </div>
            <div style={{ display: 'flex', overflowX: 'auto', gap: 12, padding: '0 16px 4px' }}>
              {similar.map(l => (
                <Link key={l.id} href={`/listing/${l.id}`} style={{ textDecoration: 'none', color: 'inherit', minWidth: 200, flexShrink: 0, background: 'var(--white)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ aspectRatio: '4/3', background: 'var(--sand-dark)', overflow: 'hidden' }}>
                    {l.photos?.[0] && <img src={l.photos[0]} alt={l.titre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '1rem' }}>{formatFCFA(l.loyer_mensuel)}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--ink-light)' }}>/mois</span></div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--ink)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titre}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-light)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> {l.quartier}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Spacer for CTA */}
      <div style={{ height: 100 }} />

      {/* CTA sticky */}
      <div className="listing-cta listing-cta-mobile" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--white)', padding: '12px 16px', display: 'flex', gap: 10, boxShadow: '0 -2px 16px rgba(0,0,0,0.08)', zIndex: 30 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleVisit} disabled={visiting}>
          <Calendar size={16} /> {visiting ? '...' : 'Visiter'}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleContact} disabled={contacting}>
          <MessageCircle size={16} /> {contacting ? '...' : 'Contacter'}
        </button>
      </div>
    </div>
  )
}
