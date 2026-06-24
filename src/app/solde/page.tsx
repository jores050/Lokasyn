'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, ArrowUpRight, Wallet, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Solde { montant_disponible: number; montant_total_recu: number; montant_total_retire: number }
interface Mouvement { id: string; type: string; montant: number; description: string; created_at: string }
interface Retrait { id: string; montant: number; telephone_reception: string; moyen_paiement: string; statut: string; created_at: string }

const TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  credit_visite:    { label: 'Visite confirmée',   icon: Wallet,        color: 'var(--green)'   },
  credit_loyer:     { label: 'Loyer reçu',         icon: Wallet,        color: 'var(--green)'   },
  credit_caution:   { label: 'Caution reçue',      icon: Wallet,        color: 'var(--green)'   },
  retrait:          { label: 'Retrait',             icon: ArrowUpRight,  color: 'var(--red)'     },
  ajustement_admin: { label: 'Ajustement admin',   icon: Wallet,        color: 'var(--ink-mid)' },
}

const STATUT_RETRAIT: Record<string, { label: string; cls: string }> = {
  en_attente: { label: 'En attente',  cls: 'badge-amber' },
  en_cours:   { label: 'En cours',    cls: 'badge-ink'   },
  effectue:   { label: 'Effectué',    cls: 'badge-green' },
  rejete:     { label: 'Rejeté',      cls: 'badge-red'   },
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function SoldePage() {
  const { user } = useAppStore()
  const supabase = createClient()

  const [solde, setSolde] = useState<Solde | null>(null)
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [retraits, setRetraits] = useState<Retrait[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [retraitForm, setRetraitForm] = useState({ montant: '', telephone: '', moyen: '' })
  const [submitting, setSubmitting] = useState(false)

  async function charger() {
    if (!user?.id) return
    const [{ data: s }, { data: m }, { data: r }] = await Promise.all([
      supabase.from('soldes').select('*').eq('utilisateur_id', user.id).maybeSingle(),
      supabase.from('mouvements_solde').select('*').eq('utilisateur_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('retraits').select('*').eq('utilisateur_id', user.id).order('created_at', { ascending: false }).limit(10),
    ])
    setSolde(s as Solde | null)
    setMouvements((m || []) as Mouvement[])
    setRetraits((r || []) as Retrait[])
    setLoading(false)
  }

  useEffect(() => { charger() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function soumettreRetrait() {
    const montant = parseInt(retraitForm.montant)
    if (!montant || montant < 500) { showToast('Montant minimum : 500 FCFA', 'error'); return }
    if (!retraitForm.telephone) { showToast('Numéro de réception requis', 'error'); return }
    if (!retraitForm.moyen) { showToast('Choisissez un moyen de paiement', 'error'); return }
    if (solde && montant > solde.montant_disponible) { showToast('Montant supérieur à votre solde', 'error'); return }

    setSubmitting(true)
    const { error } = await supabase.from('retraits').insert({
      utilisateur_id: user!.id,
      montant,
      telephone_reception: retraitForm.telephone,
      moyen_paiement: retraitForm.moyen,
      statut: 'en_attente',
    })
    setSubmitting(false)

    if (error) { showToast('Erreur : ' + error.message, 'error'); return }
    setShowModal(false)
    setRetraitForm({ montant: '', telephone: '', moyen: '' })
    showToast('Demande de retrait envoyée — traitement sous 24-48h ✓', 'success')
    charger()
  }

  const disponible = solde?.montant_disponible ?? 0
  const totalRecu = solde?.montant_total_recu ?? 0
  const totalRetire = solde?.montant_total_retire ?? 0

  if (loading) return (
    <div className="solde-screen">
      <div className="skeleton" style={{ height: 160, borderRadius: 16, margin: 16 }} />
      <div style={{ padding: '0 16px' }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8, marginBottom: 8 }} />)}
      </div>
    </div>
  )

  return (
    <div className="solde-screen">
      {/* Hero solde */}
      <div className="solde-hero" style={{ background: 'linear-gradient(135deg, var(--green) 0%, var(--green-mid) 100%)', color: 'white', margin: 16, borderRadius: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '0.875rem', opacity: 0.85, marginBottom: 4 }}>Solde disponible</div>
        <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>{formatFCFA(disponible)}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12, fontSize: '0.8125rem', opacity: 0.85 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={14} /> {formatFCFA(totalRecu)} reçus</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><TrendingDown size={14} /> {formatFCFA(totalRetire)} retirés</span>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <button
          className="btn btn-primary btn-full"
          disabled={disponible <= 0}
          onClick={() => setShowModal(true)}
          style={disponible <= 0 ? { opacity: 0.5 } : {}}
        >
          <ArrowUpRight size={16} /> Demander un retrait
        </button>
        {disponible <= 0 && <p style={{ fontSize: '0.8125rem', color: 'var(--ink-light)', textAlign: 'center', marginTop: 8 }}>Confirmez des visites pour accumuler un solde</p>}
      </div>

      {/* Mouvements */}
      <div className="section-header" style={{ padding: '20px 16px 8px', fontWeight: 600 }}>Historique des mouvements</div>
      {mouvements.length ? (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mouvements.map(m => {
            const t = TYPE_LABELS[m.type] || { label: m.type, icon: Wallet, color: 'var(--ink)' }
            const Icon = t.icon
            const isCredit = m.montant > 0
            return (
              <div key={m.id} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isCredit ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color: t.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{t.label}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-light)' }}>{m.description || ''} · {fmtDate(m.created_at)}</div>
                </div>
                <div style={{ fontWeight: 700, color: isCredit ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                  {isCredit ? '+' : ''}{formatFCFA(m.montant)}
                </div>
              </div>
            )
          })}
        </div>
      ) : <p style={{ padding: '8px 16px', color: 'var(--ink-light)', fontSize: '0.875rem' }}>Aucun mouvement pour l&apos;instant</p>}

      {/* Retraits */}
      <div className="section-header" style={{ padding: '16px 16px 8px', fontWeight: 600 }}>Mes demandes de retrait</div>
      {retraits.length ? (
        <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {retraits.map(r => {
            const s = STATUT_RETRAIT[r.statut] || { label: r.statut, cls: 'badge-ink' }
            const moyenLabel = r.moyen_paiement === 'mtn_momo' ? 'MTN MoMo' : 'Moov Money'
            return (
              <div key={r.id} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--sand-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wallet size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{formatFCFA(r.montant)} → {moyenLabel}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-light)' }}>{r.telephone_reception} · {fmtDate(r.created_at)}</div>
                </div>
                <span className={`badge ${s.cls}`}>{s.label}</span>
              </div>
            )
          })}
        </div>
      ) : <p style={{ padding: '8px 16px 32px', color: 'var(--ink-light)', fontSize: '0.875rem' }}>Aucune demande de retrait</p>}

      {/* Modale retrait */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end', padding: '0 0 0 0' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: 'var(--white)', borderRadius: '20px 20px 0 0', width: '100%', padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Demande de retrait</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--ink-mid)' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-mid)', marginBottom: 16 }}>Solde disponible : <strong>{formatFCFA(disponible)}</strong></p>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Montant (FCFA)</label>
              <input className="form-input" type="number" min={500} placeholder="Min. 500 FCFA" value={retraitForm.montant} onChange={e => setRetraitForm(f => ({ ...f, montant: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Numéro de réception</label>
              <input className="form-input" type="tel" placeholder="+229 97 00 00 00" value={retraitForm.telephone} onChange={e => setRetraitForm(f => ({ ...f, telephone: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Moyen de paiement</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ val: 'mtn_momo', label: 'MTN MoMo' }, { val: 'moov_money', label: 'Moov Money' }].map(({ val, label }) => (
                  <label key={val} style={{ flex: 1, padding: '10px 12px', border: `1.5px solid ${retraitForm.moyen === val ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: '0.875rem', fontWeight: 500, color: retraitForm.moyen === val ? 'var(--green)' : 'var(--ink)' }}>
                    <input type="radio" name="moyen" value={val} checked={retraitForm.moyen === val} onChange={() => setRetraitForm(f => ({ ...f, moyen: val }))} style={{ display: 'none' }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-full" disabled={submitting} onClick={soumettreRetrait}>
              <Send size={16} /> {submitting ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
