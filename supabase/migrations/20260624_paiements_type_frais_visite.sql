-- Étendre le CHECK constraint type sur paiements pour inclure frais_visite

ALTER TABLE paiements DROP CONSTRAINT IF EXISTS paiements_type_check;

ALTER TABLE paiements ADD CONSTRAINT paiements_type_check
  CHECK (type IN ('caution','loyer_mensuel','boost','commission_plateforme','frais_visite'));

-- Ajouter colonne paiement_id sur rendez_vous si absente
ALTER TABLE rendez_vous
  ADD COLUMN IF NOT EXISTS paiement_id UUID REFERENCES paiements(id) ON DELETE SET NULL;
