'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { initiales, avatarColor } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import type { Profile } from '@/types/database'

/*
  BUCKET STORAGE REQUIS (créer dans Supabase Dashboard → Storage) :
  - Nom : avatars
  - Public : true
  - Allowed MIME types : image/jpeg, image/png, image/webp
  - Max file size : 5 MB (5242880 bytes)

  POLICIES RLS STORAGE (SQL Editor) — voir supabase/migrations/003_avatars_storage.sql
*/

const VILLES = ['Cotonou', 'Abomey-Calavi', 'Porto-Novo', 'Parakou', 'Bohicon']

interface FormState {
  prenom: string
  nom: string
  telDigits: string
  ville: string
  quartier: string
}

function formFromProfile(profile: Profile): FormState {
  let telDigits = ''
  if (profile.telephone) {
    // Storé en base comme "229XXXXXXXX" → on affiche les 8 ou 10 derniers chiffres
    const raw = profile.telephone.replace(/\D/g, '')
    telDigits = raw.startsWith('229') ? raw.slice(3) : raw
  }
  return {
    prenom: profile.prenom || '',
    nom: profile.nom || '',
    telDigits,
    ville: profile.ville || '',
    quartier: (profile as any).quartier || '',
  }
}

function formEqual(a: FormState, b: FormState): boolean {
  return a.prenom === b.prenom && a.nom === b.nom && a.telDigits === b.telDigits &&
    a.ville === b.ville && a.quartier === b.quartier
}

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile, setProfile, isAuthChecked } = useAppStore()

  const [form, setForm] = useState<FormState>({ prenom: '', nom: '', telDigits: '', ville: '', quartier: '' })
  const [initial, setInitial] = useState<FormState>({ prenom: '', nom: '', telDigits: '', ville: '', quartier: '' })
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAuthChecked) return
    if (!user?.id) { router.replace('/auth?redirect=/profile/edit'); return }
    if (profile) {
      const f = formFromProfile(profile)
      setForm(f)
      setInitial(f)
    }
  }, [user?.id, profile, isAuthChecked]) // eslint-disable-line react-hooks/exhaustive-deps

  const nom = `${form.prenom} ${form.nom}`.trim()
  const color = avatarColor(nom)
  const inis = initiales(form.nom, form.prenom)
  const currentPhoto = photoPreview ?? profile?.photo_url ?? null
  const unchanged = formEqual(form, initial) && !photoFile

  function field(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Fichier image requis (jpg, png, webp)', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { showToast('Image trop lourde — max 5 Mo', 'error'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.prenom.trim()) errs.prenom = 'Prénom requis'
    if (!form.nom.trim()) errs.nom = 'Nom requis'
    if (form.telDigits) {
      const d = form.telDigits.replace(/\D/g, '')
      if (d.length !== 8 && d.length !== 10) {
        errs.telDigits = 'Saisissez 8 chiffres (ex: 97001234) ou 10 (ex: 0197001234)'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate() || !user?.id) return
    setSaving(true)

    try {
      let photoUrl = profile?.photo_url ?? null

      // Upload photo si nouvelle sélectionnée
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const path = `${user.id}/avatar.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type })
        if (upErr) throw new Error(`Upload photo : ${upErr.message}`)
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        // Cache-bust pour forcer le rechargement du navigateur
        photoUrl = `${urlData.publicUrl}?t=${Date.now()}`
      }

      const telRaw = form.telDigits.replace(/\D/g, '')
      const telephone = telRaw ? `229${telRaw}` : null

      const updates: Partial<Profile> & { quartier?: string } = {
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: telephone ?? undefined,
        ville: form.ville || undefined,
        quartier: form.quartier.trim() || undefined,
        photo_url: photoUrl ?? undefined,
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw new Error(error.message)

      setProfile(data as Profile)
      const newInitial = formFromProfile(data as Profile)
      setInitial(newInitial)
      setForm(newInitial)
      setPhotoFile(null)
      showToast('Profil mis à jour', 'success')
      router.push('/profile')
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la sauvegarde', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%' }} />
      </div>
    )
  }

  return (
    <div className="profile-screen" style={{ paddingBottom: 'calc(var(--bottom-nav-h, 64px) + 24px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 8px', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>
        <button
          onClick={() => router.push('/profile')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-ink)', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-display)', margin: 0, flex: 1 }}>
          Modifier mon profil
        </h1>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Photo de profil */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              className="avatar avatar-xl"
              style={{ background: color, width: 88, height: 88, fontSize: '1.6rem' }}
            >
              {currentPhoto
                ? <img src={currentPhoto} alt={nom} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : inis
              }
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--color-green)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--color-bg)',
            }}>
              <Camera size={14} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-green)', fontSize: '0.875rem', fontWeight: 500 }}
          >
            Changer la photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={onPhotoChange}
          />
        </div>

        {/* Champs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Prénom *</label>
              <input
                className="form-input"
                value={form.prenom}
                onChange={e => field('prenom', e.target.value)}
                placeholder="Jean"
                autoComplete="given-name"
              />
              {errors.prenom ? <span className="form-error show">{errors.prenom}</span> : null}
            </div>
            <div className="form-group">
              <label className="form-label">Nom *</label>
              <input
                className="form-input"
                value={form.nom}
                onChange={e => field('nom', e.target.value)}
                placeholder="Kouassi"
                autoComplete="family-name"
              />
              {errors.nom ? <span className="form-error show">{errors.nom}</span> : null}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', background: 'var(--color-white)' }}>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', background: 'var(--color-neutral-50)', borderRight: '1px solid var(--color-border)', color: 'var(--color-ink-soft)', fontSize: '0.875rem', fontWeight: 500, flexShrink: 0, gap: 4 }}>
                <Phone size={13} />&nbsp;+229
              </span>
              <input
                className="form-input"
                type="tel"
                inputMode="numeric"
                placeholder="97 00 00 00"
                value={form.telDigits}
                onChange={e => field('telDigits', e.target.value.replace(/\D/g, '').slice(0, 10))}
                autoComplete="tel"
                style={{ border: 'none', borderRadius: 0, flex: 1, boxShadow: 'none' }}
              />
            </div>
            {errors.telDigits ? <span className="form-error show">{errors.telDigits}</span> : null}
          </div>

          <div className="form-group">
            <label className="form-label">Ville</label>
            <select
              className="form-input"
              value={form.ville}
              onChange={e => field('ville', e.target.value)}
              style={{ appearance: 'auto' }}
            >
              <option value="">— Sélectionner —</option>
              {VILLES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Quartier</label>
            <input
              className="form-input"
              value={form.quartier}
              onChange={e => field('quartier', e.target.value)}
              placeholder="Ex: Fidjrossè, Dantokpa..."
              autoComplete="address-level3"
            />
          </div>

        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <button
            className="btn btn-primary btn-full"
            onClick={handleSave}
            disabled={saving || unchanged}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            className="btn btn-full"
            onClick={() => router.push('/profile')}
            style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-ink-soft)' }}
          >
            Annuler
          </button>
        </div>

      </div>
    </div>
  )
}
