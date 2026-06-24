'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home, Key, Building, Settings, Wallet, Building2, FileText,
  Zap, CreditCard, Heart, MessageCircle, Pencil, LogOut,
  BadgeCheck, Star, CheckCircle, ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { initiales, avatarColor, formatFCFA } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import type { Profile } from '@/types/database'

interface Stats {
  logements?: number
  loues?: number
  bail?: { loyer_mensuel: number; date_debut: string; id: string } | null
}

const ROLE_ICONS = {
  locataire: <Home size={14} />,
  bailleur:  <Key size={14} />,
  agence:    <Building size={14} />,
  admin:     <Settings size={14} />,
}

export default function ProfilePage() {
  const { user, profile, setUser, setProfile } = useAppStore()
  const router = useRouter()
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) { router.push('/auth?redirect=/profile'); return }
    loadStats()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadStats() {
    if (!user?.id || !profile) { setLoading(false); return }
    const isBailleur = profile.role === 'bailleur' || profile.role === 'agence'
    if (isBailleur) {
      const [{ count: nLog }, { count: nLoues }] = await Promise.all([
        supabase.from('logements').select('id', { count: 'exact', head: true }).eq('bailleur_id', user.id).neq('statut', 'archive'),
        supabase.from('logements').select('id', { count: 'exact', head: true }).eq('bailleur_id', user.id).eq('statut', 'loue'),
      ])
      setStats({ logements: nLog || 0, loues: nLoues || 0 })
    } else {
      const { data: bail } = await supabase
        .from('baux').select('id, loyer_mensuel, date_debut')
        .eq('locataire_id', user.id).eq('statut', 'actif')
        .order('created_at', { ascending: false }).limit(1).single()
      setStats({ bail: bail || null })
    }
    setLoading(false)
  }

  async function doSignOut() {
    if (!confirm('Se déconnecter ?')) return
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/')
  }

  if (!profile) {
    return (
      <div className="profile-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px' }} />
          <div className="skeleton" style={{ height: 20, width: 160, margin: '0 auto 8px' }} />
          <div className="skeleton" style={{ height: 14, width: 100, margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  const isBailleur = profile.role === 'bailleur' || profile.role === 'agence'
  const nom = `${profile.prenom || ''} ${profile.nom || ''}`.trim()
  const color = avatarColor(nom)
  const inis = initiales(profile.nom || '', profile.prenom || '')

  return (
    <div className="profile-screen">
      {/* Header */}
      <div className="profile-header">
        <div className="avatar avatar-lg" style={{ background: color, margin: '0 auto' }}>
          {profile.photo_url ? <img src={profile.photo_url} alt={nom} /> : inis}
        </div>
        <div className="profile-header-name">{nom}</div>
        <div className="profile-header-role" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          {ROLE_ICONS[profile.role] || null}
          {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} · {profile.ville || 'Bénin'}
        </div>
        {profile.kyc_verifie && (
          <div style={{ marginTop: 6 }}>
            <span className="badge badge-white"><BadgeCheck size={12} /> Identité vérifiée</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="profile-stats">
        {isBailleur ? (
          <>
            <div className="profile-stat">
              <div className="profile-stat-value">{loading ? '—' : stats.logements}</div>
              <div className="profile-stat-label">Logements</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{loading ? '—' : stats.loues}</div>
              <div className="profile-stat-label">Loués</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                {profile.note_moyenne ? <>{profile.note_moyenne.toFixed(1)} <Star size={14} fill="var(--color-gold)" color="var(--color-gold)" /></> : '—'}
              </div>
              <div className="profile-stat-label">Note</div>
            </div>
          </>
        ) : (
          <>
            <div className="profile-stat">
              <div className="profile-stat-value">
                {stats.bail ? <CheckCircle size={20} color="var(--green)" /> : '—'}
              </div>
              <div className="profile-stat-label">Bail actif</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{stats.bail ? formatFCFA(stats.bail.loyer_mensuel).replace(' FCFA', '') : '—'}</div>
              <div className="profile-stat-label">Loyer/mois</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value" style={{ fontSize: '0.875rem' }}>
                {stats.bail ? new Date(stats.bail.date_debut).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : '—'}
              </div>
              <div className="profile-stat-label">Depuis</div>
            </div>
          </>
        )}
      </div>

      <div style={{ height: 16 }} />

      {/* Menu contextuel */}
      {isBailleur ? (
        <div className="profile-menu">
          <Link href="/loyers" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><Wallet size={20} /></span>
            <span className="profile-menu-label">Suivi des loyers</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
          <Link href="/mes-annonces" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><Building2 size={20} /></span>
            <span className="profile-menu-label">Mes annonces</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
          <Link href="/contrats" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><FileText size={20} /></span>
            <span className="profile-menu-label">Contrats & baux</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
          <Link href="/boost" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><Zap size={20} /></span>
            <span className="profile-menu-label">Boost & visibilité</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
          <Link href="/solde" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><Wallet size={20} /></span>
            <span className="profile-menu-label">Mon solde</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
        </div>
      ) : (
        <div className="profile-menu">
          {stats.bail && (
            <Link href={`/payment-loyer?bail_id=${stats.bail.id}`} className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="profile-menu-icon"><CreditCard size={20} /></span>
              <span className="profile-menu-label">Payer mon loyer</span>
              <span className="profile-menu-arrow">›</span>
            </Link>
          )}
          <Link href="/favoris" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><Heart size={20} /></span>
            <span className="profile-menu-label">Mes favoris</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
          <Link href="/messages" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><MessageCircle size={20} /></span>
            <span className="profile-menu-label">Mes messages</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
          <Link href="/contrats" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><FileText size={20} /></span>
            <span className="profile-menu-label">Mes contrats</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
        </div>
      )}

      <div className="profile-menu" style={{ marginTop: 12 }}>
        {profile.role === 'admin' && (
          <Link href="/admin" className="profile-menu-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="profile-menu-icon"><ShieldCheck size={20} /></span>
            <span className="profile-menu-label">Administration</span>
            <span className="profile-menu-arrow">›</span>
          </Link>
        )}
        <div className="profile-menu-item" style={{ cursor: 'pointer' }} onClick={() => showToast('Modification du profil — bientôt disponible', 'info')}>
          <span className="profile-menu-icon"><Pencil size={20} /></span>
          <span className="profile-menu-label">Modifier mon profil</span>
          <span className="profile-menu-arrow">›</span>
        </div>
        <div className="profile-menu-item danger" style={{ cursor: 'pointer' }} onClick={doSignOut}>
          <span className="profile-menu-icon"><LogOut size={20} /></span>
          <span className="profile-menu-label">Se déconnecter</span>
        </div>
      </div>

      <div style={{ height: 'calc(var(--bottom-nav-h, 64px) + 24px)' }} />
    </div>
  )
}
