'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  BedSingle, Home, Building2, Building, Landmark, Store,
  Snowflake, ShieldCheck, Bike, Car, Wifi, Utensils, Shield,
  ChevronRight, ArrowLeft, Camera, Check, MapPin, Zap, Lightbulb,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA, LOGEMENT_LABEL, getQuartiersByVille, QUARTIERS_COTONOU } from '@/lib/utils'

const PublishMap = dynamic(() => import('@/components/publish/PublishMap'), { ssr: false })
import { showToast } from '@/components/ui/Toast'
import type { LogementType } from '@/types/database'

// ---- Types locaux ----

type BailType = 'mensuel' | 'annuel' | 'trimestriel'

interface FormState {
  type: LogementType | null
  ville: string
  quartier: string
  adresse: string
  lat: number | null
  lng: number | null
  loyer: string
  caution: number
  bail: BailType
  surface: string
  meuble: boolean
  eau: boolean
  elec: boolean
  etudiant: boolean
  equipements: string[]
  photos: string[]
  photoFiles: File[]
  description: string
  boost: boolean
  prix_visite: string
}

const INITIAL: FormState = {
  type: null, ville: 'Cotonou', quartier: '', adresse: '',
  lat: null, lng: null, loyer: '', caution: 2, bail: 'mensuel',
  surface: '', meuble: false, eau: false, elec: false, etudiant: false,
  equipements: [], photos: [], photoFiles: [], description: '', boost: false,
  prix_visite: '',
}

const TYPE_OPTIONS: { type: LogementType; icon: React.ElementType; label: string }[] = [
  { type: 'chambre', icon: BedSingle,  label: 'Chambre'  },
  { type: 'studio',  icon: Home,       label: 'Studio'   },
  { type: 'f2',      icon: Building2,  label: 'F2'       },
  { type: 'f3',      icon: Building,   label: 'F3'       },
  { type: 'f4plus',  icon: Building,   label: 'F4+'      },
  { type: 'villa',   icon: Landmark,   label: 'Villa'    },
  { type: 'local',   icon: Store,      label: 'Local'    },
]

const EQUIPEMENTS: { key: string; icon: React.ElementType; label: string }[] = [
  { key: 'Climatisation', icon: Snowflake,   label: 'Clim'           },
  { key: 'WC privatif',   icon: ShieldCheck, label: 'WC privatif'    },
  { key: 'Douche chaude', icon: ShieldCheck, label: 'Douche chaude'  },
  { key: 'Cuisine',       icon: Utensils,    label: 'Cuisine'        },
  { key: 'Gardien',       icon: Shield,      label: 'Gardien'        },
  { key: 'Parking moto',  icon: Bike,        label: 'Parking moto'   },
  { key: 'Parking voiture',icon: Car,        label: 'Parking voiture'},
  { key: 'Internet',      icon: Wifi,        label: 'Internet'       },
  { key: 'Clôture',       icon: ShieldCheck, label: 'Clôture'        },
]

const VILLES = ['Cotonou', 'Abomey-Calavi', 'Porto-Novo', 'Parakou', 'Sèmè-Kpodji']

// ---- Compression image ----
async function compressImage(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      let { width: w, height: h } = img
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file), 'image/jpeg', 0.75)
    }
    img.src = url
  })
}

// ---- Composant stepper ----
function Stepper({ step }: { step: number }) {
  return (
    <div className="stepper">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="stepper-step">
          <div className={`stepper-dot${i < step ? ' done' : i === step ? ' active' : ''}`}>
            {i < step ? <Check size={12} /> : i}
          </div>
          {i < 5 && <div className={`stepper-line${i < step ? ' done' : ''}`} />}
        </div>
      ))}
    </div>
  )
}

// ====================================================================
// Page principale
// ====================================================================
export default function PublishPage() {
  const { user, profile } = useAppStore()
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>({ ...INITIAL })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [geolocState, setGeolocState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Accès réservé bailleur/agence
  if (profile && profile.role !== 'bailleur' && profile.role !== 'agence') {
    return (
      <div className="publish-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="empty-state">
          <h3>Accès restreint</h3>
          <p>Seuls les bailleurs peuvent publier des annonces.</p>
          <button className="btn btn-primary" onClick={() => router.push('/')}>Retour</button>
        </div>
      </div>
    )
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  // ---- Validation ----
  function validate(n: number): boolean {
    const errs: Record<string, string> = {}
    if (n === 1 && !form.type) errs.type = 'Sélectionnez un type de logement'
    if (n === 2 && !form.quartier.trim()) errs.quartier = 'Le quartier est requis'
    if (n === 3) {
      const loyer = parseInt(form.loyer)
      if (!loyer || loyer < 5000) errs.loyer = 'Loyer minimum : 5 000 FCFA'
    }
    if (n === 4 && form.photos.length < 3) errs.photos = 'Minimum 3 photos requises'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function goStep(n: number) {
    if (n > step && !validate(step)) return
    setStep(n)
    window.scrollTo(0, 0)
  }

  // ---- Photos ----
  async function handlePhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files || [])]
    const remaining = 10 - form.photos.length
    const toProcess = files.slice(0, remaining)
    const newPreviews: string[] = []
    const newFiles: File[] = []

    for (const file of toProcess) {
      const compressed = await compressImage(file)
      newPreviews.push(URL.createObjectURL(compressed))
      newFiles.push(compressed)
    }

    setForm(f => ({
      ...f,
      photos: [...f.photos, ...newPreviews],
      photoFiles: [...f.photoFiles, ...newFiles],
    }))
    if (form.photos.length + newPreviews.length >= 3) {
      setErrors(e => { const n = { ...e }; delete n.photos; return n })
    }
    e.target.value = ''
  }

  function removePhoto(idx: number) {
    setForm(f => ({
      ...f,
      photos: f.photos.filter((_, i) => i !== idx),
      photoFiles: f.photoFiles.filter((_, i) => i !== idx),
    }))
  }

  // ---- Géolocalisation ----
  function handleGeoloc() {
    if (!navigator.geolocation) { showToast('Géolocalisation non supportée', 'error'); return }
    setGeolocState('loading')
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        setField('lat', latitude)
        setField('lng', longitude)
        setGeolocState('done')
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`,
            { headers: { 'Accept-Language': 'fr' } }
          )
          const data = await res.json()
          const suburb = data.address?.suburb || data.address?.neighbourhood || data.address?.quarter || ''
          if (suburb && !form.quartier) setField('quartier', suburb)
        } catch {}
      },
      () => { setGeolocState('error'); showToast('Impossible de récupérer votre position', 'error') },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  function toggleEquipement(key: string) {
    setForm(f => ({
      ...f,
      equipements: f.equipements.includes(key)
        ? f.equipements.filter(e => e !== key)
        : [...f.equipements, key],
    }))
  }

  // ---- Publication ----
  async function publierAnnonce() {
    if (!validate(5)) return
    if (!user?.id) { router.push('/auth?redirect=/publish'); return }
    setPublishing(true)

    try {
      // Upload photos
      const photoUrls: string[] = []
      for (let i = 0; i < form.photoFiles.length; i++) {
        const file = form.photoFiles[i]
        const path = `${user.id}/${Date.now()}_${i}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('logement-photos')
          .upload(path, file, { contentType: 'image/jpeg', upsert: false })
        if (uploadErr) throw new Error(`Upload photo ${i + 1} : ${uploadErr.message}`)
        const { data: { publicUrl } } = supabase.storage.from('logement-photos').getPublicUrl(path)
        photoUrls.push(publicUrl)
      }

      // Insertion logement
      const titre = `${LOGEMENT_LABEL[form.type!] || form.type} à ${form.quartier}`
      const { data: logement, error } = await supabase.from('logements').insert({
        bailleur_id: user.id,
        titre,
        description: form.description || null,
        type: form.type,
        statut: 'en_moderation',
        loyer_mensuel: parseInt(form.loyer),
        caution_mois: form.caution,
        surface_m2: form.surface ? parseInt(form.surface) : null,
        meuble: form.meuble,
        type_bail: form.bail,
        ville: form.ville,
        quartier: form.quartier,
        adresse_complete: form.adresse || null,
        latitude: form.lat,
        longitude: form.lng,
        eau_incluse: form.eau,
        electricite_incluse: form.elec,
        equipements: form.equipements,
        photos: photoUrls,
        badge_etudiant: form.etudiant,
        prix_visite: form.prix_visite ? parseInt(form.prix_visite) : 0,
        score_completude: 0,
      }).select().single()

      if (error) throw new Error(error.message)

      if (form.boost) {
        router.push(`/payment-caution?logement_id=${logement.id}&type=boost&montant=2000`)
      } else {
        showToast('Annonce soumise — validée sous 24h ✓', 'success')
        router.push('/mes-annonces')
      }
    } catch (err) {
      showToast(`Erreur : ${(err as Error).message}`, 'error')
      setPublishing(false)
    }
  }

  const quartiersSuggestions = getQuartiersByVille(form.ville)

  // ====================================================================
  // RENDU
  // ====================================================================
  return (
    <div className="publish-screen">
      <div className="publish-header">
        <h2>Publier une annonce</h2>
      </div>
      <Stepper step={step} />

      {/* ÉTAPE 1 — Type */}
      {step === 1 && (
        <div className="publish-step active">
          <div style={{ padding: '0 16px 16px' }}>
            <h3 style={{ marginBottom: 4 }}>Quel type de logement ?</h3>
          </div>
          <div className="type-grid">
            {TYPE_OPTIONS.map(({ type, icon: Icon, label }) => (
              <div
                key={type}
                className={`type-option${form.type === type ? ' selected' : ''}`}
                onClick={() => setField('type', type)}
              >
                <span className="type-option-icon"><Icon size={28} strokeWidth={1.5} /></span>
                <span className="type-option-label">{label}</span>
              </div>
            ))}
          </div>
          {errors.type && <span className="form-error show" style={{ padding: '0 16px' }}>{errors.type}</span>}
          <div style={{ padding: 16 }}>
            <button className="btn btn-primary btn-full" onClick={() => goStep(2)}>
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 — Localisation */}
      {step === 2 && (
        <div className="publish-step active">
          <div style={{ padding: '0 16px 16px' }}>
            <h3 style={{ marginBottom: 4 }}>Où se trouve le logement ?</h3>
          </div>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Ville</label>
              <select className="form-select" value={form.ville} onChange={e => setField('ville', e.target.value)}>
                {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quartier</label>
              <input
                className="form-input"
                type="text"
                placeholder="Ex: Akpakpa, Godomey…"
                list="quartiers-list"
                value={form.quartier}
                onChange={e => setField('quartier', e.target.value)}
              />
              <datalist id="quartiers-list">
                {quartiersSuggestions.map(q => <option key={q} value={q} />)}
              </datalist>
              {errors.quartier && <span className="form-error show">{errors.quartier}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Adresse complète (optionnel)</label>
              <input
                className="form-input" type="text" placeholder="Rue, numéro…"
                value={form.adresse} onChange={e => setField('adresse', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Localisation sur la carte (optionnel)</label>
              <button
                className="btn btn-secondary btn-full"
                type="button"
                onClick={handleGeoloc}
                disabled={geolocState === 'loading'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}
              >
                <MapPin size={16} />
                {geolocState === 'loading' ? 'Localisation en cours…'
                  : geolocState === 'done'    ? 'Position enregistrée ✓'
                  : 'Utiliser ma position actuelle'}
              </button>
              <PublishMap
                onLocationChange={(lat, lng) => {
                  setField('lat', lat)
                  setField('lng', lng)
                  setGeolocState('done')
                }}
                initialLat={form.lat}
                initialLng={form.lng}
              />
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => goStep(1)}>
              <ArrowLeft size={16} /> Retour
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => goStep(3)}>
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 — Tarifs & équipements */}
      {step === 3 && (
        <div className="publish-step active">
          <div style={{ padding: '0 16px 16px' }}>
            <h3 style={{ marginBottom: 4 }}>Tarifs et caractéristiques</h3>
          </div>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Loyer mensuel (FCFA)</label>
              <input
                className="form-input" type="number" placeholder="Ex: 25000" min={5000}
                value={form.loyer} onChange={e => setField('loyer', e.target.value)}
              />
              {errors.loyer && <span className="form-error show">{errors.loyer}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Caution</label>
              <select className="form-select" value={form.caution} onChange={e => setField('caution', parseInt(e.target.value))}>
                <option value={1}>1 mois de loyer</option>
                <option value={2}>2 mois de loyer</option>
                <option value={3}>3 mois de loyer</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type de bail</label>
              <select className="form-select" value={form.bail} onChange={e => setField('bail', e.target.value as BailType)}>
                <option value="mensuel">Mensuel</option>
                <option value="trimestriel">Trimestriel</option>
                <option value="annuel">Annuel</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Frais de visite (FCFA) — optionnel</label>
              <input
                className="form-input" type="number" placeholder="0 = visite gratuite" min={0} max={3000}
                value={form.prix_visite} onChange={e => setField('prix_visite', e.target.value)}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
                Entre 500 et 3 000 FCFA — laissez vide pour une visite gratuite
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">Surface (m²) — optionnel</label>
              <input
                className="form-input" type="number" placeholder="Ex: 25"
                value={form.surface} onChange={e => setField('surface', e.target.value)}
              />
            </div>

            {/* Toggles */}
            {([
              { key: 'meuble', label: 'Meublé' },
              { key: 'eau',    label: 'Eau incluse' },
              { key: 'elec',   label: 'Électricité incluse' },
              { key: 'etudiant', label: 'Étudiant OK' },
            ] as const).map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{label}</span>
                <label className="toggle">
                  <input type="checkbox" checked={form[key]} onChange={e => setField(key, e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
            ))}

            {/* Équipements */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 10 }}>Équipements</label>
              <div className="equipements-grid">
                {EQUIPEMENTS.map(({ key, icon: Icon, label }) => (
                  <div
                    key={key}
                    className={`equipement-item${form.equipements.includes(key) ? ' selected' : ''}`}
                    onClick={() => toggleEquipement(key)}
                  >
                    <span className="equipement-check">
                      {form.equipements.includes(key) && <Check size={12} />}
                    </span>
                    <Icon size={14} /> {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => goStep(2)}>
              <ArrowLeft size={16} /> Retour
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => goStep(4)}>
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 4 — Photos + description */}
      {step === 4 && (
        <div className="publish-step active">
          <div style={{ padding: '0 16px 16px' }}>
            <h3 style={{ marginBottom: 4 }}>Photos et description</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-light)' }}>Minimum 3 photos, maximum 10. Une belle galerie attire plus de locataires !</p>
          </div>
          <div style={{ padding: '0 16px' }}>
            <div className="photo-grid">
              {form.photos.map((url, i) => (
                <div key={i} className="photo-thumb">
                  <img src={url} alt={`Photo ${i + 1}`} />
                  <button className="photo-thumb-remove" onClick={() => removePhoto(i)} type="button">✕</button>
                </div>
              ))}
              {form.photos.length < 10 && (
                <div className="photo-add" onClick={() => photoInputRef.current?.click()}>
                  <span className="photo-add-icon"><Camera size={28} strokeWidth={1.25} /></span>
                  <span>{form.photos.length}/10</span>
                </div>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handlePhotos}
            />
            <button
              className="btn btn-secondary btn-full"
              type="button"
              style={{ marginTop: 8 }}
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera size={16} /> Ajouter des photos
            </button>
            {errors.photos && <span className="form-error show" style={{ marginTop: 8 }}>{errors.photos}</span>}

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Décrivez votre logement : luminosité, proximité des transports, ambiance du quartier…"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
              />
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => goStep(3)}>
              <ArrowLeft size={16} /> Retour
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => goStep(5)}>
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ÉTAPE 5 — Récap + boost + publication */}
      {step === 5 && (
        <div className="publish-step active">
          <div style={{ padding: '0 16px 16px' }}>
            <h3 style={{ marginBottom: 4 }}>Visibilité & publication</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-light)' }}>Vérifiez votre annonce avant de la soumettre</p>
          </div>

          {/* Récap */}
          <div style={{ background: 'var(--white)', borderRadius: 'var(--radius)', margin: '0 16px 16px', padding: 16, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                {LOGEMENT_LABEL[form.type!] || form.type} — {form.quartier}, {form.ville}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green)' }}>
                {formatFCFA(parseInt(form.loyer) || 0)}/mois
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {form.meuble   && <span className="badge badge-ink">Meublé</span>}
                {form.eau      && <span className="badge badge-green">Eau incluse</span>}
                {form.elec     && <span className="badge badge-green">Élec incluse</span>}
                {form.etudiant && <span className="badge badge-ink">Étudiant OK</span>}
                {form.photos.length > 0 && <span className="badge badge-ink"><Camera size={12} /> {form.photos.length} photos</span>}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--ink-mid)' }}>
                Caution : {form.caution} mois · {formatFCFA((parseInt(form.loyer) || 0) * form.caution)}
              </div>
              {form.photos.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {form.photos.slice(0, 3).map((url, i) => (
                    <img key={i} src={url} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} alt="" />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Boost */}
          <div style={{ background: 'var(--amber-light)', borderRadius: 'var(--radius)', margin: '0 16px 16px', padding: 16, border: '1.5px solid var(--amber)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={16} /> Booster mon annonce
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-mid)' }}>Apparaître en priorité pendant 7 jours</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: 'var(--amber)' }}>2 000 FCFA</div>
                <label className="toggle" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={form.boost} onChange={e => setField('boost', e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Lightbulb size={14} /> Les annonces boostées reçoivent 5× plus de contacts
            </p>
          </div>

          <div style={{ padding: '0 16px 16px', display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => goStep(4)}>
              <ArrowLeft size={16} /> Retour
            </button>
            <button
              className="btn btn-primary" style={{ flex: 1 }}
              disabled={publishing}
              onClick={publierAnnonce}
            >
              {publishing ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
