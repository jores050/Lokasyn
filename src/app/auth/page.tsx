'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Phone, Home, Key, Building } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { validateTelBenin } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import type { Profile } from '@/types/database'
import type { UserRole } from '@/types/database'

type View = 'role' | 'register' | 'login' | 'forgot'

const VIEW_LABELS: Record<View, string> = {
  role: 'Créer votre compte',
  register: 'Créer votre compte',
  login: 'Connectez-vous à votre compte',
  forgot: 'Réinitialiser le mot de passe',
}

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser, setProfile } = useAppStore()

  const [view, setView] = useState<View>('login')
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const redirect = searchParams.get('redirect') || '/'
  const supabase = createClient()

  function clearErrors() { setErrors({}) }
  function setError(field: string, msg: string) {
    setErrors(prev => ({ ...prev, [field]: msg }))
  }

  async function afterAuth(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data as Profile)
      setUser({ id: userId, email: data.email || '' })
    }
    router.push(redirect)
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    clearErrors()
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) { setError('login', error.message); return }
    if (data.user) await afterAuth(data.user.id)
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    clearErrors()
    const form = e.currentTarget
    const prenom = (form.elements.namedItem('prenom') as HTMLInputElement).value.trim()
    const nom = (form.elements.namedItem('nom') as HTMLInputElement).value.trim()
    const telephone = (form.elements.namedItem('telephone') as HTMLInputElement).value.trim()
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    let valid = true
    if (!prenom) { setError('prenom', 'Prénom requis'); valid = false }
    if (!nom) { setError('nom', 'Nom requis'); valid = false }
    if (telephone && !validateTelBenin(telephone)) {
      setError('telephone', 'Format: +229 XX XX XX XX'); valid = false
    }
    if (password.length < 8) { setError('password', 'Minimum 8 caractères'); valid = false }
    if (!valid) return

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { nom, prenom, telephone: telephone || null, role: selectedRole || 'locataire' },
      },
    })

    if (error) { setLoading(false); setError('email', error.message); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, nom, prenom,
        telephone: telephone || null,
        role: selectedRole || 'locataire',
      })
      setLoading(false)
      await afterAuth(data.user.id)
    } else {
      setLoading(false)
      showToast('Vérifiez votre email pour confirmer votre compte.', 'success', 6000)
      setView('login')
    }
  }

  async function handleForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    clearErrors()
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim()

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    })
    setLoading(false)

    if (error) { setError('forgot', error.message); return }
    showToast('Lien envoyé ! Vérifiez votre email.', 'success', 5000)
    setView('login')
  }

  return (
    <div className="auth-screen">
      <div className="auth-header">
        <div className="auth-logo">Loka<span>syn</span></div>
        <div className="auth-subtitle">{VIEW_LABELS[view]}</div>
      </div>

      {/* VUE RÔLE */}
      {view === 'role' && (
        <div className="auth-view active">
          <h3 style={{ marginBottom: 16, fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--ink-mid)' }}>Je suis...</h3>
          <div className="role-cards">
            {([
              { role: 'locataire', icon: Home,     title: 'Locataire', desc: 'Je cherche un logement' },
              { role: 'bailleur',  icon: Key,      title: 'Bailleur',  desc: 'Je loue mes biens' },
              { role: 'agence',    icon: Building, title: 'Agence',    desc: 'Je gère pour des propriétaires' },
            ] as const).map(({ role, icon: Icon, title, desc }) => (
              <div
                key={role}
                className={`role-card${selectedRole === role ? ' selected' : ''}`}
                onClick={() => setSelectedRole(role)}
              >
                <div className="role-card-icon"><Icon size={28} strokeWidth={1.5} /></div>
                <div className="role-card-info">
                  <div className="role-card-title">{title}</div>
                  <div className="role-card-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary btn-full"
            disabled={!selectedRole}
            onClick={() => setView('register')}
          >
            Continuer
          </button>
          <div className="auth-toggle" style={{ marginTop: 16 }}>
            Déjà un compte ? <a onClick={() => setView('login')} style={{ cursor: 'pointer' }}>Se connecter</a>
          </div>
        </div>
      )}

      {/* VUE INSCRIPTION */}
      {view === 'register' && (
        <div className="auth-view active">
          <button onClick={() => setView('role')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-mid)', fontSize: '0.875rem', marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Retour
          </button>
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <input className="form-input" name="prenom" type="text" placeholder="Jean" required autoComplete="given-name" />
                {errors.prenom && <span className="form-error show">{errors.prenom}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-input" name="nom" type="text" placeholder="Kouassi" required autoComplete="family-name" />
                {errors.nom && <span className="form-error show">{errors.nom}</span>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <div className="input-wrapper">
                <span className="input-icon"><Phone size={14} /></span>
                <input className="form-input" name="telephone" type="tel" placeholder="+229 97 00 00 00" autoComplete="tel" />
              </div>
              {errors.telephone && <span className="form-error show">{errors.telephone}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="input-wrapper">
                <span className="input-icon"><Mail size={14} /></span>
                <input className="form-input" name="email" type="email" placeholder="jean@exemple.com" required autoComplete="email" />
              </div>
              {errors.email && <span className="form-error show">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div className="input-wrapper">
                <span className="input-icon"><Lock size={14} /></span>
                <input className="form-input" name="password" type="password" placeholder="Min. 8 caractères" required autoComplete="new-password" minLength={8} />
              </div>
              {errors.password && <span className="form-error show">{errors.password}</span>}
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? '...' : 'Créer mon compte'}
            </button>
          </form>
          <div className="auth-toggle">
            Déjà un compte ? <a onClick={() => setView('login')} style={{ cursor: 'pointer' }}>Se connecter</a>
          </div>
        </div>
      )}

      {/* VUE CONNEXION */}
      {view === 'login' && (
        <div className="auth-view active">
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="input-wrapper">
                <span className="input-icon"><Mail size={14} /></span>
                <input className="form-input" name="email" type="email" placeholder="jean@exemple.com" required autoComplete="email" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div className="input-wrapper">
                <span className="input-icon"><Lock size={14} /></span>
                <input className="form-input" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
              </div>
            </div>
            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <a onClick={() => setView('forgot')} style={{ fontSize: '0.875rem', color: 'var(--green)', cursor: 'pointer' }}>
                Mot de passe oublié ?
              </a>
            </div>
            {errors.login && <span className="form-error show" style={{ textAlign: 'center' }}>{errors.login}</span>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? '...' : 'Se connecter'}
            </button>
          </form>
          <div className="auth-toggle">
            Pas encore de compte ? <a onClick={() => setView('role')} style={{ cursor: 'pointer' }}>S&apos;inscrire</a>
          </div>
        </div>
      )}

      {/* VUE MOT DE PASSE OUBLIÉ */}
      {view === 'forgot' && (
        <div className="auth-view active">
          <button onClick={() => setView('login')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-mid)', fontSize: '0.875rem', marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Retour à la connexion
          </button>
          <h3 style={{ marginBottom: 8 }}>Réinitialiser le mot de passe</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink-mid)', marginBottom: 20 }}>
            Saisissez votre email, nous vous enverrons un lien de réinitialisation.
          </p>
          <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="input-wrapper">
                <span className="input-icon"><Mail size={14} /></span>
                <input className="form-input" name="email" type="email" placeholder="jean@exemple.com" required />
              </div>
            </div>
            {errors.forgot && <span className="form-error show" style={{ textAlign: 'center' }}>{errors.forgot}</span>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? '...' : 'Envoyer le lien'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
