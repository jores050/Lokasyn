-- ================================================================
-- Migration 002 — Trigger création profil à l'inscription
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ================================================================

-- Fonction déclenchée après INSERT sur auth.users
-- Crée automatiquement la ligne dans public.profiles
-- avec les données passées dans options.data du signUp

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    telephone,
    nom,
    prenom,
    role,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'telephone',
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'locataire'),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Créer le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- Élargir la contrainte CHECK sur messages.type
-- pour inclure tous les types utilisés dans le code
-- ================================================================

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check
  CHECK (type IN (
    'texte',
    'image',
    'systeme',
    'lien_paiement',
    'recommandation_logement',
    'rdv_demande',
    'rdv_programmation',
    'rdv_confirme',
    'rdv_confirme_gratuit',
    'annulation_demandee',
    'visite_declaree',
    'systeme_rdv',
    'notification_paiement'
  ));
