# Backlog — branche `mig/pocketbase`

> Alimenté par le run `26-10-06_audit-fixes` (synthèse : `.agents/plans/26-10-06_audit-fixes_done/run.md` § Constats différés).
> Tags : `!` à traiter bientôt · `S2` gating déploiement · `?` conditionnel · (sans tag) dette légère.
> Règle : une ligne par constat, avec ancre. Le détail vit dans le run report archivé.

## Gating déploiement (S2)

- **S2** Re-import complet des données — les 4 B1 données import (`created`, `createdBy`, `permissionWrite`, `rootRecipeId` sur recipes) sont corrigés dans le pipeline (T16) mais la DB actuelle porte encore les données fausses. Bloqué sur clé API Appwrite expirée : nouvelle clé (console Appwrite, scopes lecture users/teams/documents) dans `scripts_dev/.env.local` (`APPWRITE_API_KEY=`), puis reprendre T17 Phases 2-3 (run.md § journal T17).
- **S2** Secret share_links ≠ id (token dédié) — REC-1 fermant l'énumération, le risque résiduel est faible ; refonte URL/invitations à faire avec la refonte du flux invitation.
- **S2** Définir `ENKA_BASE_URL` dans l'env du serveur PB (checklist Dokploy 1.8) — sans elle les emails pointent vers la prod.

## Bientôt (!)

- `!` Décision produit `materiel.createdBy` — vide structurellement (110/110, pipeline écrit `null`) → records indestructibles via l'API (`deleteRule = createdBy = auth`). Options : backfill `createdBy ← ownerUser`, ou révision `deleteRule` (`|| ownerUser = auth`). Idem `materiel_loan` (client ne set jamais `createdBy`).
- `!` Tester l'orchestrateur main.ts (T15) — assertion de code seulement ; extraire `scheduleResync`/`performResync` en module ou étendre le stub harness.
- `!` Click-through navigateur complet — liste des flux dans run.md § journal T18 (créations UI, RSVP, invitation email réel via SMTP, locks concurrents, resync SSE topic custom `user_<id>`, logout/login, visiteur, PWA version.json à bumper à la release).

## Conditionnels (?)

- `?` HOOK-6 — invité sans compte jamais rattaché à la team après inscription (refonte flux invitation, produit).
- `?` C3 — collections mortes `event_todos` / `notifications` : migrer les todos ou supprimer (produit).
- `?` C5 — 3e argument `sendEmailToExistingMembers` de `createEventWithTeams` ignoré (implémenter ou retirer l'option UI, produit).
- `?` `lookup-user` casse d'email — comparaison `=` BINARY côté SQLite ; vérifier si PB lowercases à la création avant tout geste.
- `?` Asymétrie `categories` (create auth, update/delete superuser) — assumer et documenter dans la doc domaine.
- `?` Résidu REC-7 — `ownerUser = self` + team étrangère au create materiel reste possible (garde team ou owner, au choix).

## Hors périmètre (autre repo / produit)

- Côté SITE (enka-next) : régression `isDynamic` perdue par revert `88de525a` — à corriger upstream, NE PAS porter ici.
- Images recettes (20 valeurs `img` frontmatter, og:image Hugo déjà cassées) — décision produit Phase 2.
- Étape 7 du portage (notifications realtime cross-user) et Étape 9 (robustesse SW/PWA) — hors priorité synthèse, plans dans `.agents/plans/26-10-06_audit-fixes_done/` (source : audit port-hardening §4).
- Nettoyage site : recettes `z-test` côté enka-next + export Appwrite à rejouer après nouvelle clé.
