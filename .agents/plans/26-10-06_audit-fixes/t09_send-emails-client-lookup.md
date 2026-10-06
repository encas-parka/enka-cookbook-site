# T9 — send-emails ownership (HOOK-3, HOOK-8) + client lookup email (UI-1, C6)

**Sources** : rules-hooks §2 (send-emails, invite-to-team), tableau (HOOK-3, HOOK-8, UI-1), §4 (emailExists) · schema-client §1 (B9, C6)
**Prérequis** : T8 (route `/api/enka/lookup-user` en place) ; T3 (events.description lisible serveur)

## Objectif

Fermer le vecteur d'emails au nom de l'app et débloquer la recherche de collaborateur par email côté client (permissions recettes + emailExists).

## Constats → fixes

- **HOOK-3 (B2)** : `send-emails.pb.js` L95-113 vérifie le share link mais pas l'ownership → refuser si `shareLink.createdBy != e.auth.id` (les liens créés avant T3 ont été backfillés createdBy en dev) ; alternative acceptée : membership de l'event — **choisir la plus simple, documenter**. Reconcilier `eventName`/`eventDescription`/dates : lire l'event réel serveur-side (description existe depuis T3) au lieu de faire confiance au body client.
- **HOOK-8 (B3)** : `email-templates.js` L50/L100 fallback `https://enka-cookbook.app` si `ENKA_BASE_URL` absent → au minimum un `$app.logger().error()` bruyant sur le fallback (pas de fail-fast DX) ; documenter la var pour le déploiement (note run.md).
- **UI-1/B9 (client)** : `RecipePermissionsManager.svelte:95-116` : remplacer `users.getList(filter email=…)` par un appel à `/api/enka/lookup-user` (T8) → « Utilisateur introuvable » disparaît.
- **C6 (client)** : `services/pb-auth.ts:115-124` `emailExists` : même endpoint (retour booléen) — le message d'inscription doublon devient correct.

## Méthode suggérée

1. Sondes curl : send-emails par non-propriétaire → 403 ; par propriétaire → aboutit (SMTP absent → erreur mailer propre, documenter le comportement exact) ; body mensonger (eventName arbitraire) → email contend le vrai nom de l'event (vérifiable dans le payload template/logs — au minimum le hook écrase le body par l'event réel).
2. Client : `bun run check` + `check-legacy` (delta 0) + `bun run test` (69/69).
3. Vérification de zone (fast-win autorisé) : `EventShareLinks.svelte` utilise bien `getEventShareLinks` (DOC-1) — si `event.shareLinks` fantôme traîne (note T5), nettoyer.

## Critères

- [x] send-emails : ownership + reconciliation serveur (sondes loggées)
- [x] Fallback ENKA_BASE_URL bruyant + note déploiement
- [x] RecipePermissionsManager et emailExists via lookup-user (grep vert sur users.getList dans ces fichiers)
- [x] Canon respecté ; run.md amendé (journal T9)
