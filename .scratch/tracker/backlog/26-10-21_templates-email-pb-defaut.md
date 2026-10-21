> Backlog — ouvert tant que ce fichier existe. Supprimer quand implémenté ou rejeté (l'historique git est l'archive).

Tag: `bug` · Urgence: `S2` · Source: session 26-10-21 (redirection post-login) · Ancre: pocketbase/pb_migrations/1791277647_collections_snapshot.js:581 (reset) et :588 (vérification)

- Les templates email par défaut de PocketBase pointent encore vers l'Admin UI : `{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}` et `.../confirm-verification/{TOKEN}`. Conséquence : la page Svelte `/reset-password` (et `/verify-email`) n'est **jamais atteinte** par un lien reçu par mail — le reset aboutit dans l'UI PB (page d'admin, pas de retour vers l'app), et la vérification d'email n'ouvre aucune session.
- Ce n'est pas couvert par la redirection post-login : celle-ci traite le retour _après_ reset (modale de connexion préremplie avec l'email du token), pas le routage du lien.
- À faire (1.8 / cutover) : repointer les deux templates vers `{APP_URL}/reset-password?token={TOKEN}` et `{APP_URL}/verify-email?token={TOKEN}` (migration PB, pas d'édition manuelle en base), puis rejouer les deux parcours en click-through.
- Prérequis connu sur `/verify-email` : `VerifyEmailPage.svelte` appelle `refreshAuthAfterLogin()` sans session établie puis navigue vers `/dashboard` — à adapter au contrat d'hydratation (`refreshAuthAfterLogin` résout au cache local, `hydration` porte la phase réseau) avant d'ouvrir ce chemin.
