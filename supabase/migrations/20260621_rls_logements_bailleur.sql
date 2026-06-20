-- ================================================================
-- LocaSyn — Migration : RLS inscription logements (bailleur/agence only)
-- Couche 1 de la défense en profondeur
-- ================================================================

-- Remplace la policy d'insertion existante sur logements
DROP POLICY IF EXISTS "logements_bailleur_insert" ON logements;

CREATE POLICY "logements_bailleur_insert" ON logements FOR INSERT
  WITH CHECK (
    auth.uid() = bailleur_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('bailleur', 'agence')
    )
  );

-- Vérification :
-- SELECT polname, pg_get_expr(polwithcheck, polrelid) AS condition
-- FROM pg_policy
-- WHERE polrelid = 'logements'::regclass AND polname = 'logements_bailleur_insert';
