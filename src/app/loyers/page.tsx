'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Wallet, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA, initiales, avatarColor, moisLabel } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import type { Profile } from '@/types/database'

const MOIS_NOMS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

interface Bail {
  id: string
  loyer_mensuel: number
  caution_montant: number
  date_debut: string
  date_fin: string | null
  statut: string
  logements: { titre: string; quartier: string; ref_interne: string } | null
  locataire: Pick<Profile, 'id' | 'nom' | 'prenom' | 'telephone' | 'photo_url'> | null
}

interface Paiement {
  bail_id: string
  mois_concerne: string
  statut: string
  montant: number
}

function getMoisDepuisBail(dateDebut: string): string[] {
  const start = new Date(dateDebut)
  const now = new Date()
  const mois: string[] = []
  let cur = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cur <= now && mois.length < 12) {
    mois.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return mois
}

function getMoisStatus(moisStr: string, paiements: Paiement[]): string {
  const p = paiements.find(p => p.mois_concerne === moisStr)
  if (!p) {
    const [y, m] = moisStr.split('-').map(Number)
    return new Date(y, m - 1, 1) > new Date() ? 'futur' : 'retard'
  }
  if (p.statut === 'confirme') return 'paye'
  if (p.statut === 'en_cours') return 'en-cours'
  if (p.statut === 'echec') return 'retard'
  return 'futur'
}

function moisActuel() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function LoyersPage() {
  const { user, isAuthChecked } = useAppStore()
  const supabase = createClient()
  const [baux, setBaux] = useState<Bail[]>([])
  const [paiementsParBail, setPaiementsParBail] = useState<Record<string, Paiement[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthChecked || !user?.id) return
    load()
  }, [user?.id, isAuthChecked]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: bxData, error: bxErr } = await supabase
      .from('baux')
      .select(`id, loyer_mensuel, caution_montant, date_debut, date_fin, statut, logement_id,
        logements(titre, quartier, ref_interne),
        locataire:profiles!locataire_id(id, nom, prenom, telephone, photo_url)`)
      .eq('bailleur_id', user!.id)
      .eq('statut', 'actif')
      .order('created_at', { ascending: false })

    if (bxErr) { setError(bxErr.message); setLoading(false); return }
    if (!bxData?.length) { setBaux([]); setLoading(false); return }

    const bailIds = (bxData as unknown as Bail[]).map(b => b.id)
    const { data: pData } = await supabase
      .from('paiements')
      .select('bail_id, mois_concerne, statut, montant')
      .in('bail_id', bailIds).eq('type', 'loyer_mensuel')
      .order('created_at', { ascending: false })

    const map: Record<string, Paiement[]> = {}
    ;(pData || []).forEach((p: Record<string, unknown>) => {
      const bid = p.bail_id as string
      if (!map[bid]) map[bid] = []
      map[bid].push(p as unknown as Paiement)
    })

    setBaux(bxData as unknown as Bail[])
    setPaiementsParBail(map)
    setLoading(false)
  }

  const currentMois = moisActuel()

  // Métriques globales
  let totalRecu = 0, enAttente = 0, enRetard = 0
  baux.forEach(bail => {
    const pList = paiementsParBail[bail.id] || []
    const cur = pList.find(p => p.mois_concerne === currentMois)
    if (cur?.statut === 'confirme') totalRecu += bail.loyer_mensuel
    else if (cur?.statut === 'en_cours') enAttente += bail.loyer_mensuel
    else enRetard += bail.loyer_mensuel
  })

  async function relanceLoyer(bailId: string, telephone: string) {
    if (!telephone) { showToast('Numéro de téléphone non renseigné', 'warning'); return }
    try {
      await supabase.functions.invoke('whatsapp-notify', {
        body: { telephone, type: 'relance_loyer', data: { mois: moisLabel(currentMois) } },
      })
      showToast('Relance WhatsApp envoyée !', 'success')
    } catch { showToast('Erreur envoi WhatsApp', 'error') }
  }

  async function envoyerLienLoyer(bailId: string, montant: number) {
    try {
      const { data: conv } = await supabase.from('conversations').select('id').limit(1).single()
      if (!conv) { showToast('Aucune conversation avec ce locataire', 'warning'); return }
      await supabase.from('messages').insert({
        conversation_id: conv.id, expediteur_id: user!.id,
        contenu: null, type: 'lien_paiement',
        metadata: { bail_id: bailId, mois: currentMois, montant, message: `Loyer ${moisLabel(currentMois)}` },
      })
      showToast('Lien de paiement envoyé ✓', 'success')
    } catch (err) { showToast((err as Error).message, 'error') }
  }

  if (loading) return (
    <div className="loyers-screen">
      <div style={{ padding: 16 }}>
        <div className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 16 }} />
        {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12, marginBottom: 12 }} />)}
      </div>
    </div>
  )

  if (error) return (
    <div className="empty-state">
      <div className="empty-icon"><AlertTriangle size={40} strokeWidth={1.25} /></div>
      <h3>Erreur</h3><p>{error}</p>
    </div>
  )

  return (
    <div className="loyers-screen">
      <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Suivi des loyers</h2>
      </div>

      {baux.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Wallet size={40} strokeWidth={1.25} /></div>
          <h3>Aucun bail actif</h3>
          <p>Vos baux actifs et le suivi des loyers apparaîtront ici.</p>
        </div>
      ) : (
        <>
          {/* Métriques */}
          <div className="loyers-metrics" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border-light)', margin: 16, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {[
              { label: 'Reçu ce mois', val: totalRecu, color: 'var(--green)' },
              { label: 'En attente', val: enAttente, color: 'var(--amber)' },
              { label: 'En retard', val: enRetard, color: 'var(--red)' },
            ].map(({ label, val, color }) => (
              <div key={label} className="loyer-metric" style={{ background: 'var(--white)', padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color, fontSize: '0.9375rem' }}>{formatFCFA(val).replace(' FCFA', '')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-light)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Cards baux */}
          <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {baux.map(bail => {
              const pList = paiementsParBail[bail.id] || []
              const moisList = getMoisDepuisBail(bail.date_debut)
              const loc = bail.locataire
              const color = avatarColor(`${loc?.prenom}${loc?.nom}`)
              const inis = initiales(loc?.nom || '', loc?.prenom || '')

              return (
                <div key={bail.id} className="bail-card">
                  <div className="bail-card-header">
                    <div>
                      <div className="bail-card-title">{bail.logements?.titre || 'Logement'}</div>
                      <div className="bail-card-ref">{bail.logements?.ref_interne || ''} · {bail.logements?.quartier || ''}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--green)' }}>{formatFCFA(bail.loyer_mensuel)}/mois</div>
                  </div>

                  {loc && (
                    <div className="bail-card-locataire" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                      <div className="avatar avatar-sm" style={{ background: color, flexShrink: 0 }}>
                        {loc.photo_url ? <img src={loc.photo_url} alt="" /> : inis}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{loc.prenom} {loc.nom}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--ink-light)' }}>
                          Depuis {new Date(bail.date_debut).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 8 }}>Paiements</div>
                    <div className="mois-grid">
                      {moisList.map(mois => {
                        const status = getMoisStatus(mois, pList)
                        const label = MOIS_NOMS[parseInt(mois.split('-')[1]) - 1]
                        return (
                          <div key={mois} className={`mois-pill ${status}`} title={moisLabel(mois)}>{label}</div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bail-card-actions" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => relanceLoyer(bail.id, loc?.telephone || '')}>
                      <Smartphone size={14} /> Relance
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => envoyerLienLoyer(bail.id, bail.loyer_mensuel)}>
                      <Wallet size={14} /> Envoyer lien MoMo
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
