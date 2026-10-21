> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `debt` · Urgence: `soon` · Source: run 26-10-12 (T10) · Ancre: scripts_dev/migrate.ts / events

- Doublons d'events dans la source Appwrite (9 copies / 6 noms, ex. concert 2908 x3) — cote SPA l'idempotence est FAIT (createEventWithTeams + #reconcileCreatedEvent) ; reste a decider si le transform garde les copies hors import et/ou nettoyage source — pour la finalisation 1.8.
