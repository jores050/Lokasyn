-- LocaSyn — Schéma complet PostgreSQL / Supabase
-- Migration 001 — v1.0

-- ================================================================
-- PROFILES (extension de auth.users)
-- ================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('locataire','bailleur','agence','admin')),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT,
  photo_url TEXT,
  ville TEXT DEFAULT 'Cotonou',
  quartier TEXT,
  note_moyenne DECIMAL(2,1) DEFAULT 0,
  nombre_avis INT DEFAULT 0,
  kyc_verifie BOOLEAN DEFAULT FALSE,
  piece_identite_url TEXT,
  ifu TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- LOGEMENTS
-- ================================================================
CREATE TABLE logements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id UUID NOT NULL REFERENCES profiles(id),
  titre TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('chambre','studio','f2','f3','f4plus','villa','local')),
  statut TEXT NOT NULL DEFAULT 'libre' CHECK (statut IN ('libre','sous_reserve','loue','archive','en_moderation')),
  loyer_mensuel INTEGER NOT NULL,
  caution_mois INTEGER NOT NULL DEFAULT 2,
  surface_m2 INTEGER,
  meuble BOOLEAN DEFAULT FALSE,
  type_bail TEXT CHECK (type_bail IN ('mensuel','annuel','etudiant','court_terme')),
  ville TEXT NOT NULL DEFAULT 'Cotonou',
  quartier TEXT NOT NULL,
  adresse_complete TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  eau_incluse BOOLEAN DEFAULT FALSE,
  electricite_incluse BOOLEAN DEFAULT FALSE,
  charges TEXT,
  equipements TEXT[],
  disponible_le DATE,
  photos TEXT[],
  video_url TEXT,
  verifie BOOLEAN DEFAULT FALSE,
  verifie_le TIMESTAMPTZ,
  score_completude INTEGER DEFAULT 0,
  vues INTEGER DEFAULT 0,
  contacts INTEGER DEFAULT 0,
  boost_actif BOOLEAN DEFAULT FALSE,
  boost_type TEXT,
  boost_expire_le TIMESTAMPTZ,
  badge_etudiant BOOLEAN DEFAULT FALSE,
  ref_interne TEXT UNIQUE DEFAULT 'LOG-' || LPAD(FLOOR(RANDOM()*99999)::TEXT, 4, '0'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CONVERSATIONS
-- ================================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logement_id UUID NOT NULL REFERENCES logements(id),
  locataire_id UUID NOT NULL REFERENCES profiles(id),
  bailleur_id UUID NOT NULL REFERENCES profiles(id),
  statut TEXT DEFAULT 'active' CHECK (statut IN ('active','archivee','bloquee')),
  derniere_activite TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(logement_id, locataire_id)
);

-- ================================================================
-- MESSAGES
-- ================================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  expediteur_id UUID NOT NULL REFERENCES profiles(id),
  contenu TEXT,
  type TEXT DEFAULT 'texte' CHECK (type IN ('texte','image','rdv_demande','rdv_confirme','systeme','lien_paiement')),
  lu BOOLEAN DEFAULT FALSE,
  lu_le TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- RENDEZ-VOUS VISITES
-- ================================================================
CREATE TABLE rendez_vous (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  logement_id UUID NOT NULL REFERENCES logements(id),
  demandeur_id UUID NOT NULL REFERENCES profiles(id),
  bailleur_id UUID NOT NULL REFERENCES profiles(id),
  date_visite DATE NOT NULL,
  heure_visite TIME NOT NULL,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','confirme','refuse','annule','effectue')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CRÉNEAUX DISPONIBLES
-- ================================================================
CREATE TABLE creneaux_disponibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bailleur_id UUID NOT NULL REFERENCES profiles(id),
  logement_id UUID REFERENCES logements(id),
  date DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  disponible BOOLEAN DEFAULT TRUE
);

-- ================================================================
-- BAUX / CONTRATS
-- ================================================================
CREATE TABLE baux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logement_id UUID NOT NULL REFERENCES logements(id),
  bailleur_id UUID NOT NULL REFERENCES profiles(id),
  locataire_id UUID NOT NULL REFERENCES profiles(id),
  date_debut DATE NOT NULL,
  date_fin DATE,
  loyer_mensuel INTEGER NOT NULL,
  caution_montant INTEGER NOT NULL,
  type_bail TEXT NOT NULL,
  statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif','termine','resilie')),
  contrat_pdf_url TEXT,
  contrat_genere_ia BOOLEAN DEFAULT FALSE,
  conditions_particulieres TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- PAIEMENTS
-- ================================================================
CREATE TABLE paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bail_id UUID REFERENCES baux(id),
  logement_id UUID NOT NULL REFERENCES logements(id),
  payeur_id UUID NOT NULL REFERENCES profiles(id),
  beneficiaire_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('caution','loyer_mensuel','boost','commission_plateforme')),
  montant INTEGER NOT NULL,
  mois_concerne TEXT,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','en_cours','confirme','echec','rembourse')),
  kkiapay_transaction_id TEXT UNIQUE,
  kkiapay_reference TEXT,
  moyen_paiement TEXT CHECK (moyen_paiement IN ('mtn_momo','moov_money','carte')),
  telephone_paiement TEXT,
  escrow_libere BOOLEAN DEFAULT FALSE,
  escrow_libere_le TIMESTAMPTZ,
  webhook_recu_le TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- BOOSTS ANNONCES
-- ================================================================
CREATE TABLE boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logement_id UUID NOT NULL REFERENCES logements(id),
  bailleur_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('semaine','mois','remontee','alerte_push','homepage','pack_rentree')),
  montant INTEGER NOT NULL,
  debut TIMESTAMPTZ DEFAULT NOW(),
  fin TIMESTAMPTZ NOT NULL,
  paiement_id UUID REFERENCES paiements(id),
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- FAVORIS
-- ================================================================
CREATE TABLE favoris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID NOT NULL REFERENCES profiles(id),
  logement_id UUID NOT NULL REFERENCES logements(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(utilisateur_id, logement_id)
);

-- ================================================================
-- ALERTES RECHERCHE
-- ================================================================
CREATE TABLE alertes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID NOT NULL REFERENCES profiles(id),
  type_logement TEXT[],
  loyer_max INTEGER,
  ville TEXT,
  quartier TEXT,
  meuble BOOLEAN,
  badge_etudiant BOOLEAN,
  active BOOLEAN DEFAULT TRUE,
  derniere_notif_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- AVIS
-- ================================================================
CREATE TABLE avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bail_id UUID NOT NULL REFERENCES baux(id),
  auteur_id UUID NOT NULL REFERENCES profiles(id),
  cible_id UUID NOT NULL REFERENCES profiles(id),
  note INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT,
  type TEXT CHECK (type IN ('locataire_note_bailleur','bailleur_note_locataire')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- SIGNALEMENTS
-- ================================================================
CREATE TABLE signalements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signaleur_id UUID NOT NULL REFERENCES profiles(id),
  logement_id UUID REFERENCES logements(id),
  message_id UUID REFERENCES messages(id),
  motif TEXT NOT NULL,
  description TEXT,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','traite','rejete')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- NOTIFICATIONS
-- ================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  titre TEXT NOT NULL,
  corps TEXT NOT NULL,
  lue BOOLEAN DEFAULT FALSE,
  lue_le TIMESTAMPTZ,
  lien TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- FONCTIONS RPC
-- ================================================================
CREATE OR REPLACE FUNCTION increment_vues(logement_id UUID)
RETURNS void AS $$
  UPDATE logements SET vues = vues + 1 WHERE id = logement_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_contacts(logement_id UUID)
RETURNS void AS $$
  UPDATE logements SET contacts = contacts + 1 WHERE id = logement_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER logements_updated_at BEFORE UPDATE ON logements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- INDEX PERFORMANCES
-- ================================================================
CREATE INDEX ON logements(statut, boost_actif, created_at DESC);
CREATE INDEX ON logements(bailleur_id);
CREATE INDEX ON logements(ville, quartier);
CREATE INDEX ON messages(conversation_id, created_at DESC);
CREATE INDEX ON conversations(locataire_id, derniere_activite DESC);
CREATE INDEX ON conversations(bailleur_id, derniere_activite DESC);
CREATE INDEX ON paiements(bail_id, created_at DESC);
CREATE INDEX ON notifications(utilisateur_id, lue, created_at DESC);
CREATE INDEX ON favoris(utilisateur_id);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE logements ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rendez_vous ENABLE ROW LEVEL SECURITY;
ALTER TABLE creneaux_disponibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE baux ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE favoris ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertes ENABLE ROW LEVEL SECURITY;
ALTER TABLE avis ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles : lecture publique, modification par soi-même
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Logements : lecture publique (sauf archivés), écriture par le bailleur
CREATE POLICY "logements_public_read" ON logements FOR SELECT USING (statut != 'archive');
CREATE POLICY "logements_bailleur_insert" ON logements FOR INSERT WITH CHECK (auth.uid() = bailleur_id);
CREATE POLICY "logements_bailleur_update" ON logements FOR UPDATE USING (auth.uid() = bailleur_id);
CREATE POLICY "logements_bailleur_delete" ON logements FOR DELETE USING (auth.uid() = bailleur_id);

-- Conversations : visible par les 2 parties
CREATE POLICY "conversations_participants" ON conversations FOR ALL
  USING (auth.uid() = locataire_id OR auth.uid() = bailleur_id);

-- Messages : visible par les participants de la conversation
CREATE POLICY "messages_participants" ON messages FOR ALL
  USING (conversation_id IN (
    SELECT id FROM conversations
    WHERE locataire_id = auth.uid() OR bailleur_id = auth.uid()
  ));

-- Rendez-vous : visible par les participants
CREATE POLICY "rdv_participants" ON rendez_vous FOR ALL
  USING (auth.uid() = demandeur_id OR auth.uid() = bailleur_id);

-- Créneaux : lecture publique, écriture par le bailleur
CREATE POLICY "creneaux_public_read" ON creneaux_disponibles FOR SELECT USING (true);
CREATE POLICY "creneaux_bailleur_write" ON creneaux_disponibles FOR ALL USING (auth.uid() = bailleur_id);

-- Baux : visible par les deux parties
CREATE POLICY "baux_parties" ON baux FOR ALL
  USING (auth.uid() = bailleur_id OR auth.uid() = locataire_id);

-- Paiements : visible par payeur et bénéficiaire
CREATE POLICY "paiements_parties" ON paiements FOR ALL
  USING (auth.uid() = payeur_id OR auth.uid() = beneficiaire_id);

-- Boosts : par le bailleur
CREATE POLICY "boosts_bailleur" ON boosts FOR ALL USING (auth.uid() = bailleur_id);

-- Favoris : par l'utilisateur
CREATE POLICY "favoris_own" ON favoris FOR ALL USING (auth.uid() = utilisateur_id);

-- Alertes : par l'utilisateur
CREATE POLICY "alertes_own" ON alertes FOR ALL USING (auth.uid() = utilisateur_id);

-- Avis : lecture publique, écriture par l'auteur
CREATE POLICY "avis_public_read" ON avis FOR SELECT USING (true);
CREATE POLICY "avis_own_insert" ON avis FOR INSERT WITH CHECK (auth.uid() = auteur_id);

-- Signalements : par le signaleur
CREATE POLICY "signalements_own_insert" ON signalements FOR INSERT WITH CHECK (auth.uid() = signaleur_id);
CREATE POLICY "signalements_own_read" ON signalements FOR SELECT USING (auth.uid() = signaleur_id);

-- Notifications : par l'utilisateur
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = utilisateur_id);

-- ================================================================
-- DONNÉES DE TEST (à supprimer en prod)
-- ================================================================
-- Les seeds seront gérés via l'interface Supabase Table Editor
