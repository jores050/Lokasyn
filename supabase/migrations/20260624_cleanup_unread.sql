-- Nettoyage historique de test : marquer tous les anciens messages/notifs comme lus
UPDATE messages SET lu = true, lu_le = NOW() WHERE lu = false;
-- Note: colonne "lue" (féminin) dans la table notifications
UPDATE notifications SET lue = true WHERE lue = false;
