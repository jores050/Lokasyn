-- Empêche les doublons de conversations (race condition double-clic)
ALTER TABLE conversations
  ADD CONSTRAINT conversations_unique
  UNIQUE (logement_id, bailleur_id, locataire_id);
