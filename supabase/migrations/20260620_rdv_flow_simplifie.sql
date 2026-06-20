-- ================================================================
-- LocaSyn — Migration : Flow RDV simplifié (négociation chat libre)
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Étendre les statuts de rendez_vous
ALTER TABLE rendez_vous DROP CONSTRAINT IF EXISTS rendez_vous_statut_check;
ALTER TABLE rendez_vous ADD CONSTRAINT rendez_vous_statut_check
  CHECK (statut IN ('en_attente','confirme','effectue','annule_demande','annule_confirme','refuse'));

-- Nouvelles colonnes (toutes IF NOT EXISTS pour idempotence)
ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS confirme_le TIMESTAMPTZ;
ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS visite_declaree_le TIMESTAMPTZ;
ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS fenetre_contestation_expire_le TIMESTAMPTZ;
ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS contestation_motif TEXT;
ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS annulation_demandee_le TIMESTAMPTZ;

-- 2. Étendre les statuts de paiements
ALTER TABLE paiements DROP CONSTRAINT IF EXISTS paiements_statut_check;
ALTER TABLE paiements ADD CONSTRAINT paiements_statut_check
  CHECK (statut IN ('en_attente','en_cours','confirme','echec','rembourse','annule_confirme','en_contestation'));

-- 3. Fonction de calcul du split selon le type (visite normale vs annulation)
CREATE OR REPLACE FUNCTION calculer_split_paiement(p_montant INTEGER, p_type_split TEXT)
RETURNS TABLE(montant_bailleur INTEGER, montant_plateforme INTEGER) AS $$
BEGIN
  IF p_type_split = 'annulation' THEN
    -- Annulation : 85% bailleur / 15% plateforme
    RETURN QUERY SELECT ROUND(p_montant * 0.85)::INTEGER, ROUND(p_montant * 0.15)::INTEGER;
  ELSE
    -- Visite normale : 90% bailleur / 10% plateforme
    RETURN QUERY SELECT ROUND(p_montant * 0.90)::INTEGER, ROUND(p_montant * 0.10)::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Fonction de libération automatique après 24h (appelée par pg_cron ou cron externe)
CREATE OR REPLACE FUNCTION liberer_paiements_visites_non_contestees()
RETURNS void AS $$
DECLARE
  r RECORD;
  v_montant_bailleur INTEGER;
  v_montant_plateforme INTEGER;
BEGIN
  FOR r IN
    SELECT rv.id AS rdv_id, rv.bailleur_id, rv.paiement_id, p.montant
    FROM rendez_vous rv
    JOIN paiements p ON p.id = rv.paiement_id
    WHERE rv.statut = 'effectue'
      AND rv.fenetre_contestation_expire_le < NOW()
      AND p.escrow_libere = FALSE
      AND p.statut != 'en_contestation'
  LOOP
    SELECT montant_bailleur, montant_plateforme
    INTO v_montant_bailleur, v_montant_plateforme
    FROM calculer_split_paiement(r.montant, 'visite_normale');

    UPDATE paiements SET
      escrow_libere = TRUE,
      escrow_libere_le = NOW(),
      montant_bailleur = v_montant_bailleur,
      montant_commission_plateforme = v_montant_plateforme,
      statut = 'confirme'
    WHERE id = r.paiement_id;

    INSERT INTO soldes (utilisateur_id, montant_disponible, montant_total_recu)
    VALUES (r.bailleur_id, v_montant_bailleur, v_montant_bailleur)
    ON CONFLICT (utilisateur_id) DO UPDATE SET
      montant_disponible = soldes.montant_disponible + v_montant_bailleur,
      montant_total_recu = soldes.montant_total_recu + v_montant_bailleur,
      updated_at = NOW();

    INSERT INTO mouvements_solde (utilisateur_id, type, montant, paiement_id, description)
    VALUES (r.bailleur_id, 'credit_visite', v_montant_bailleur, r.paiement_id,
            'Visite confirmée — libération automatique 24h');
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Planifier via pg_cron (toutes les heures)
--    IMPORTANT : vérifier que pg_cron est activé sur votre plan Supabase
--    Dashboard → Database → Extensions → pg_cron
--    Si non disponible : utiliser cron-job.org pour appeler une Edge Function HTTP
-- SELECT cron.schedule('liberation-visites', '0 * * * *', 'SELECT liberer_paiements_visites_non_contestees()');

-- Pour tester sans attendre 24h, forcer manuellement :
-- UPDATE rendez_vous SET fenetre_contestation_expire_le = NOW() - INTERVAL '1 hour' WHERE id = '<rdv_id>';
-- SELECT liberer_paiements_visites_non_contestees();
