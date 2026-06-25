'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Rocket, Bell, Sparkles, GraduationCap, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface LogementBoost {
  id: string
  titre: string
  boost_actif: boolean
  boost_type: string | null
  boost_expire_le: string | null
  statut: string
}

const BOOST_OFFERS = [
  { type: 'semaine',      icon: Zap,           name: 'Boost Semaine',    desc: '7 jours en priorité dans les résultats',        prix: 2000  },
  { type: 'mois',         icon: Rocket,        name: 'Boost Mois',       desc: '30 jours en priorité dans les résultats',       prix: 6000  },
  { type: 'alerte_push',  icon: Bell,          name: 'Alerte Push',      desc: 'Notifié aux locataires actifs',                 prix: 1000  },
  { type: 'homepage',     icon: Sparkles,      name: 'À la une',         desc: 'Section homepage pendant 7 jours',              prix: 3000  },
  { type: 'pack_rentree', icon: GraduationCap, name: 'Pack Rentrée UAC', desc: 'Juillet–Septembre — visibilité maximale UAC',   prix: 4500, special: true },
]

export default function BoostPage() {
  const { user, isAuthChecked } = useAppStore()
  const router = useRouter()
  const supabase = createClient()
  const [logements, setLogements] = useState<LogementBoost[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthChecked || !user?.id) return
    supabase.from('logements')
      .select('id, titre, boost_actif, boost_type, boost_expire_le, statut')
      .eq('bailleur_id', user.id)
      .neq('statut', 'archive')
      .then(({ data }) => {
        const list = (data || []) as LogementBoost[]
        setLogements(list)
        if (list.length) setSelected(list[0].id)
        setLoading(false)
      })
  }, [user?.id, isAuthChecked]) // eslint-disable-line react-hooks/exhaustive-deps

  function activerBoost(type: string, prix: number) {
    if (!logements.length) { showToast('Publiez d\'abord une annonce', 'warning'); return }
    const logementId = selected || logements[0].id
    router.push(`/payment-caution?logement_id=${logementId}&type=boost&boost_type=${type}&montant=${prix}`)
  }

  function fmtExpire(dateStr: string | null) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="boost-screen">
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ margin: 0 }}>Booster mes annonces</h2>
        <p style={{ color: 'var(--ink-light)', fontSize: '0.875rem', marginTop: 4 }}>Augmentez la visibilité de vos logements</p>
      </div>

      {/* Sélecteur d'annonce */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 8 }}>Annonce à booster</div>
        {loading ? (
          <div className="skeleton" style={{ height: 56, borderRadius: 10 }} />
        ) : logements.length === 0 ? (
          <p style={{ color: 'var(--ink-light)', fontSize: '0.875rem' }}>Aucune annonce active</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logements.map(l => (
              <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1.5px solid ${selected === l.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: selected === l.id ? 'rgba(22,163,74,0.04)' : 'var(--white)' }}>
                <input type="radio" name="logement" value={l.id} checked={selected === l.id} onChange={() => setSelected(l.id)} style={{ accentColor: 'var(--green)' }} />
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Home size={18} strokeWidth={1.5} color="var(--ink-mid)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titre}</div>
                  <div style={{ fontSize: '0.8125rem', color: l.boost_actif ? 'var(--amber)' : 'var(--ink-light)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {l.boost_actif ? <><Zap size={12} /> Boosté jusqu&apos;au {fmtExpire(l.boost_expire_le)}</> : 'Pas de boost actif'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Offres */}
      <div style={{ padding: '20px 16px 32px' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 12 }}>Choisissez une offre</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BOOST_OFFERS.map(({ type, icon: Icon, name, desc, prix, special }) => (
            <div key={type} className={`boost-card${special ? ' featured' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 14, background: special ? 'linear-gradient(135deg, #FFF7ED, #FFF)' : 'var(--white)', border: `1.5px solid ${special ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: special ? 'rgba(245,158,11,0.12)' : 'var(--sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} strokeWidth={1.5} color={special ? 'var(--amber)' : 'var(--green)'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-light)', marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '0.9375rem', marginBottom: 6 }}>{formatFCFA(prix)}</div>
                <button className="btn btn-primary btn-sm" disabled={!logements.length} onClick={() => activerBoost(type, prix)}>
                  Activer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
