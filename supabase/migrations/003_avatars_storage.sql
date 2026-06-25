-- ============================================================
-- BUCKET avatars — créer manuellement dans Supabase Dashboard
-- Storage → New bucket → Nom: avatars, Public: true
-- Allowed MIME: image/jpeg, image/png, image/webp
-- Max file size: 5242880 (5 MB)
-- ============================================================

-- Policies RLS pour le bucket avatars
-- Exécuter dans Supabase Dashboard → SQL Editor

-- 1. Lecture publique (tout le monde peut voir les avatars)
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 2. Upload/mise à jour : uniquement vers son propre dossier {user_id}/
CREATE POLICY "avatars_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Suppression : uniquement son propre avatar
CREATE POLICY "avatars_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
