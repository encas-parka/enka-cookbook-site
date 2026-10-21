> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `S2` · Urgence: `S2` · Source: probe 21-10 (dev DB) · Ancre: pocketbase/pb_migrations/* (settings)

- Porter les settings serveur PB en prod (Dokploy 1.8) — (a) batch : {enabled: true, maxRequests: 100, timeout: 3} (constante client PB_BATCH_MAX_REQUESTS = 100, a garder alignee) ; (b) rateLimits : active avec les regles dev. Faits sondes : sous-requetes d'un batch rate-limitees individuellement ; /api/batch limite au niveau HTTP ; requetes superuser exemptees du limiter ; batch s'arrete a la premiere sous-requete en erreur (transaction).
