// Types dérivés du schéma Supabase (001_locasyn_schema.sql + migrations)

export type RdvStatut =
  | 'en_attente'
  | 'confirme'
  | 'effectue'
  | 'annule_demande'
  | 'annule_confirme'
  | 'refuse'

export type PaiementStatut =
  | 'en_attente'
  | 'en_cours'
  | 'confirme'
  | 'echec'
  | 'rembourse'
  | 'annule_confirme'
  | 'en_contestation'

export type UserRole = 'locataire' | 'bailleur' | 'agence' | 'admin'

export type LogementType = 'chambre' | 'studio' | 'f2' | 'f3' | 'f4plus' | 'villa' | 'local'

export interface Profile {
  id: string
  role: UserRole
  nom: string
  prenom: string
  telephone?: string
  photo_url?: string
  email?: string
  note_moyenne?: number
  nombre_avis?: number
  est_verifie?: boolean
  kyc_verifie?: boolean
  biographie?: string
  ville?: string
  created_at: string
}

export interface Logement {
  id: string
  bailleur_id: string
  titre: string
  description?: string
  type: LogementType
  statut: 'libre' | 'loue' | 'en_moderation' | 'sous_reserve' | 'archive'
  ville: string
  quartier: string
  adresse_complete?: string
  latitude?: number
  longitude?: number
  loyer_mensuel: number
  caution_mois: number
  type_bail?: string
  surface_m2?: number
  nb_pieces?: number
  etage?: number
  photos: string[]
  video_url?: string
  equipements: string[]
  meuble: boolean
  badge_etudiant: boolean
  verifie: boolean
  boost_actif: boolean
  boost_expire_le?: string
  boost_type?: string
  disponible_le?: string
  eau_incluse: boolean
  electricite_incluse: boolean
  ref_interne?: string
  prix_visite?: number
  vues: number
  contacts: number
  score_completude?: number
  created_at: string
  profiles?: Profile
}

export interface Conversation {
  id: string
  logement_id: string
  locataire_id: string
  bailleur_id: string
  dernier_message?: string
  derniere_activite: string
  created_at: string
  logements?: Logement
  locataire?: Profile
  bailleur?: Profile
}

export interface Message {
  id: string
  conversation_id: string
  expediteur_id: string
  contenu: string
  type: 'texte' | 'image' | 'systeme' | 'rdv_demande' | 'rdv_confirme' | 'rdv_programmation' | 'annulation_demandee' | 'visite_declaree' | 'lien_paiement'
  metadata?: Record<string, unknown>
  lu: boolean
  created_at: string
}

export interface RendezVous {
  id: string
  conversation_id: string
  logement_id: string
  demandeur_id: string   // colonne réelle DB (= locataire dans le flow simplifié)
  bailleur_id: string
  statut: RdvStatut
  date_visite: string
  heure_visite: string
  notes?: string
  prix_visite?: number
  paiement_id?: string
  confirme_le?: string
  visite_declaree_le?: string
  fenetre_contestation_expire_le?: string
  contestation_motif?: string
  annulation_demandee_le?: string
  created_at: string
}

export interface Paiement {
  id: string
  locataire_id: string
  bailleur_id: string
  payeur_id?: string
  beneficiaire_id?: string
  logement_id?: string
  type: 'caution' | 'loyer_mensuel' | 'boost' | 'commission_plateforme' | 'frais_visite'
  montant: number
  montant_bailleur?: number
  montant_commission_plateforme?: number
  statut: PaiementStatut
  kkiapay_transaction_id?: string
  escrow_libere: boolean
  escrow_libere_le?: string
  webhook_recu_le?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface Notification {
  id: string
  utilisateur_id: string
  type: string
  titre: string
  corps?: string
  lien?: string
  lue: boolean
  lue_le?: string
  created_at: string
}
