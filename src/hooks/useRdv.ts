'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFCFA } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import type { RendezVous } from '@/types/database'

const STATUTS_TERMINAUX = ['annule_confirme', 'refuse']

export function rdvEstActif(rdv: RendezVous): boolean {
  if (!rdv) return false
  if (STATUTS_TERMINAUX.includes(rdv.statut)) return false
  if (rdv.statut === 'effectue') {
    const expire = rdv.fenetre_contestation_expire_le
      && new Date(rdv.fenetre_contestation_expire_le) < new Date()
    return !expire
  }
  return true // en_attente, confirme, annule_demande
}

export function useRdv(conversationId: string, userId: string | undefined) {
  const supabase = createClient()
  const [rdvActif, setRdvActif] = useState<RendezVous | null>(null)
  const [rdvsTermines, setRdvsTermines] = useState<RendezVous[]>([])
  const [peutCreer, setPeutCreer] = useState(true)
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopExpiry = useCallback(() => {
    if (expiryRef.current) { clearInterval(expiryRef.current); expiryRef.current = null }
  }, [])

  const startExpiry = useCallback((rdv: RendezVous) => {
    stopExpiry()
    if (rdv.statut !== 'effectue') return
    expiryRef.current = setInterval(async () => {
      const { data } = await supabase.from('rendez_vous').select('*').eq('id', rdv.id).single()
      if (data && !rdvEstActif(data)) {
        setRdvActif(null)
        setRdvsTermines(prev => {
          if (prev.find(r => r.id === data.id)) return prev
          return [...prev, data]
        })
        stopExpiry()
      }
    }, 60_000)
  }, [supabase, stopExpiry])

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from('rendez_vous').select('*, logements(prix_visite, titre)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    const rdvs = (data || []) as RendezVous[]
    const actif = rdvs.find(rdvEstActif) || null
    const termines = rdvs.filter(r => !rdvEstActif(r))

    setRdvActif(actif)
    setRdvsTermines(termines)
    setPeutCreer(!actif)

    if (actif) startExpiry(actif)
  }, [conversationId, supabase, startExpiry])

  useEffect(() => {
    if (!conversationId || !userId) return
    charger()

    const channel = supabase
      .channel(`rdv:${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rendez_vous',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        const rdv = payload.new as RendezVous
        if (rdvEstActif(rdv)) {
          setRdvActif(rdv)
          setPeutCreer(false)
          startExpiry(rdv)
        } else {
          setRdvActif(null)
          setPeutCreer(true)
          stopExpiry()
          setRdvsTermines(prev => {
            if (prev.find(r => r.id === rdv.id)) return prev
            return [...prev, rdv]
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      stopExpiry()
    }
  }, [conversationId, userId, charger, supabase, startExpiry, stopExpiry])

  // Actions RDV
  async function confirmerRdv(rdvId: string) {
    const { error } = await supabase.from('rendez_vous').update({
      statut: 'confirme', confirme_le: new Date().toISOString(),
    }).eq('id', rdvId)
    if (error) { showToast('Erreur lors de la confirmation', 'error'); console.error('[useRdv] confirmerRdv:', error); return }
    await supabase.from('messages').insert({
      conversation_id: conversationId, expediteur_id: userId,
      contenu: 'Visite confirmée', type: 'rdv_confirme',
    })
  }

  async function demanderAnnulation(rdvId: string) {
    const { error } = await supabase.from('rendez_vous').update({
      statut: 'annule_demande', annulation_demandee_le: new Date().toISOString(),
    }).eq('id', rdvId)
    if (error) { showToast("Erreur lors de la demande d'annulation", 'error'); console.error('[useRdv] demanderAnnulation:', error) }
  }

  async function confirmerAnnulation(rdvId: string) {
    const supabaseClient = createClient()
    const { data: { user: currentUser } } = await supabaseClient.auth.getUser()
    const { data, error } = await supabaseClient.functions.invoke('confirmer-annulation', {
      body: { rdv_id: rdvId, bailleur_id: currentUser?.id },
    })
    if (error || !data?.ok) {
      const msgs: Record<string, string> = {
        rdv_introuvable: 'RDV introuvable',
        non_autorise: 'Action non autorisée',
        statut_invalide: 'Ce RDV ne peut plus être annulé',
        erreur_requete_rdv: 'Erreur de requête',
      }
      showToast(msgs[data?.error] || "Erreur lors de la confirmation d'annulation", 'error')
      return
    }
    if (data.credit) {
      showToast(`Annulation confirmée — ${formatFCFA(data.montant)} crédités`)
    } else {
      showToast('Annulation confirmée')
    }
  }

  async function refuserAnnulation(rdvId: string) {
    const { error } = await supabase.from('rendez_vous').update({ statut: 'confirme' }).eq('id', rdvId)
    if (error) { showToast("Erreur lors du refus", 'error'); console.error('[useRdv] refuserAnnulation:', error) }
  }

  async function declarerEffectuee(rdvId: string) {
    const fenetre = new Date()
    fenetre.setHours(fenetre.getHours() + 24)
    const { error } = await supabase.from('rendez_vous').update({
      statut: 'effectue',
      visite_declaree_le: new Date().toISOString(),
      fenetre_contestation_expire_le: fenetre.toISOString(),
    }).eq('id', rdvId)
    if (error) { showToast('Erreur lors de la déclaration de visite', 'error'); console.error('[useRdv] declarerEffectuee:', error) }
  }

  async function creerRdv(date: string, heure: string, message: string) {
    if (!peutCreer || !userId) return null
    const { data: conv } = await supabase
      .from('conversations').select('bailleur_id, locataire_id, logement_id').eq('id', conversationId).single()
    if (!conv) return null

    const { data: logement } = await supabase
      .from('logements').select('prix_visite').eq('id', conv.logement_id).single()

    const { data: rdv, error: rdvError } = await supabase.from('rendez_vous').insert({
      conversation_id: conversationId,
      logement_id: conv.logement_id,
      demandeur_id: conv.locataire_id,
      bailleur_id: conv.bailleur_id,
      statut: 'en_attente',
      date_visite: date,
      heure_visite: heure,
      prix_visite: logement?.prix_visite ?? 0,
    }).select().single()
    if (rdvError) { console.error('[useRdv] creerRdv:', rdvError); return null }

    if (rdv) {
      await supabase.from('messages').insert({
        conversation_id: conversationId, expediteur_id: userId,
        contenu: `Demande de visite : ${date} à ${heure}`, type: 'rdv_programmation',
        metadata: { date_visite: date, heure_visite: heure },
      })
    }
    return rdv
  }

  return {
    rdvActif, rdvsTermines, peutCreer,
    confirmerRdv, demanderAnnulation, confirmerAnnulation, refuserAnnulation,
    declarerEffectuee, creerRdv,
  }
}
