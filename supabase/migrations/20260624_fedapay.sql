-- FedaPay — frais de visite

ALTER TABLE logements ADD COLUMN IF NOT EXISTS prix_visite INTEGER DEFAULT 0;

ALTER TABLE paiements
  ADD COLUMN IF NOT EXISTS payeur_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS beneficiaire_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS montant_bailleur INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS montant_commission_plateforme INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_recu_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  titre TEXT NOT NULL,
  corps TEXT,
  lien TEXT,
  lu BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_own'
  ) THEN
    CREATE POLICY notifications_own ON notifications
      FOR ALL USING (auth.uid() = utilisateur_id);
  END IF;
END $$;
