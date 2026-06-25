'use client'

import { useState, useEffect } from 'react'
import { FileText, Key, User, Calendar, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface Bail {
  id: string
  loyer_mensuel: number
  caution_montant: number
  date_debut: string
  date_fin: string | null
  statut: string
  contrat_pdf_url?: string | null
  logements: { titre: string; quartier: string } | null
  bailleur: { nom: string; prenom: string } | null
  locataire: { nom: string; prenom: string } | null
}

const STATUT_COLORS: Record<string, string> = {
  actif:    'badge-green',
  termine:  'badge-ink',
  resilie:  'badge-red',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ContratsPage() {
  const { user, profile, isAuthChecked } = useAppStore()
  const supabase = createClient()
  const [baux, setBaux] = useState<Bail[]>([])
  const [loading, setLoading] = useState(true)

  const isBailleur = profile?.role === 'bailleur' || profile?.role === 'agence'

  useEffect(() => {
    if (!isAuthChecked || !user?.id) return
    supabase.from('baux')
      .select(`id, loyer_mensuel, caution_montant, date_debut, date_fin, statut, contrat_pdf_url,
        logements(titre, quartier),
        bailleur:profiles!bailleur_id(nom, prenom),
        locataire:profiles!locataire_id(nom, prenom)`)
      .eq(isBailleur ? 'bailleur_id' : 'locataire_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBaux((data || []) as unknown as Bail[])
        setLoading(false)
      })
  }, [user?.id, isAuthChecked]) // eslint-disable-line react-hooks/exhaustive-deps

  async function genContrat(bailId: string) {
    showToast('Génération du contrat en cours…', 'info')
    try {
      await supabase.functions.invoke('gemini-contrat', { body: { bail_id: bailId } })
      showToast('Contrat généré avec succès !', 'success')
    } catch { showToast('Erreur lors de la génération', 'error') }
  }

  if (loading) return (
    <div className="contrats-screen">
      <div style={{ padding: 16 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12, marginBottom: 12 }} />)}
      </div>
    </div>
  )

  return (
    <div className="contrats-screen">
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ margin: 0 }}>Contrats & baux</h2>
      </div>

      {baux.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><FileText size={40} strokeWidth={1.25} /></div>
          <h3>Aucun contrat</h3>
          <p>Vos baux apparaîtront ici.</p>
        </div>
      ) : (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {baux.map(bail => (
            <div key={bail.id} className="contrat-card">
              <div className="contrat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{bail.logements?.titre || 'Logement'}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-light)' }}>{bail.logements?.quartier || ''}</div>
                </div>
                <span className={`badge ${STATUT_COLORS[bail.statut] || 'badge-ink'}`}>{bail.statut}</span>
              </div>

              <div className="contrat-card-parties" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '0.875rem', color: 'var(--ink-mid)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Key size={14} /> {bail.bailleur?.prenom} {bail.bailleur?.nom}
                </span>
                <span>↔</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={14} /> {bail.locataire?.prenom} {bail.locataire?.nom}
                </span>
              </div>

              <div style={{ marginTop: 10, fontSize: '0.875rem', color: 'var(--ink-mid)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={14} /> Du {fmtDate(bail.date_debut)}{bail.date_fin ? ` au ${fmtDate(bail.date_fin)}` : ''}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>
                {formatFCFA(bail.loyer_mensuel)}/mois · Caution {formatFCFA(bail.caution_montant)}
              </div>

              {bail.statut === 'actif' && isBailleur && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => genContrat(bail.id)}>
                    <FileText size={14} /> Générer contrat IA
                  </button>
                  {bail.contrat_pdf_url && (
                    <a href={bail.contrat_pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                      <Download size={14} /> Télécharger
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
