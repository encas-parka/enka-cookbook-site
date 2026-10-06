# Backlog — branche `mig/pocketbase`

> Alimenté par le run `26-10-06_audit-fixes` (synthèse : `.agents/plans/26-10-06_audit-fixes_done/run.md` § Constats différés).
> Tags : `!` à traiter bientôt · `S2` gating déploiement · `?` conditionnel · (sans tag) dette légère.
> Règle : une ligne par constat, avec ancre. Le détail vit dans le run report archivé.

## Gating déploiement (S2)

- **S2** ~~Re-import complet des données~~ **FAIT 06-10** (T17 Phases 2-3, export prod frais : users 59, events 39, products 1286, purchases 1329, recipes 456/456 created peuplés). Reste : 1 teamdocs prod rejeté (content > 5000 — voir `!`).
- **S2** Secret share_links ≠ id (token dédié) — REC-1 fermant l'énumération, le risque résiduel est faible ; refonte URL/invitations à faire avec la refonte du flux invitation.
- **S2** Définir `ENKA_BASE_URL` dans l'env du serveur PB (checklist Dokploy 1.8) — sans elle les emails pointent vers la prod.

## Bientôt (!)

- `!` Décision produit `materiel.createdBy` — vide structurellement (110/110, pipeline écrit `null`, confirmé au re-import) → records indestructibles via l'API (`deleteRule = createdBy = auth`). Options : backfill `createdBy ← ownerUser`, ou révision `deleteRule` (`|| ownerUser = auth`). Idem `materiel_loan` (client ne set jamais `createdBy`).
- `!` teamdocs prod : 1 document rejeté à l'import (`content` > 5000 chars, limite du champ PB) — delta schéma (text illimité) ou tronquage, décision produit.
- `!` Click-through navigateur complet — liste des flux dans run.md § journal T18 (créations UI, RSVP, invitation email réel via SMTP, locks concurrents, resync SSE topic custom `user_<id>`, logout/login, visiteur, PWA version.json à bumper à la release) + suppression du bloc « documents liés par tag » (commit `8d4541a9` — à valider visuellement, revert facile si réticence).

## Conditionnels (?)

- `?` HOOK-6 — invité sans compte jamais rattaché à la team après inscription (refonte flux invitation, produit).
- `?` C3 — collections mortes `event_todos` / `notifications` : migrer les todos ou supprimer (produit) ; module `event-todo.utils.ts` mort (crash au chargement corrigé, mais plus aucun import) — supprimer ou ressusciter avec C3.
- `?` C5 — checkbox « Envoyer un email aux membres » (EventCreatePage) sans effet (3e argument ignoré, confirmé par triage) — implémenter ou retirer l'option UI.
- `?` `lookup-user` casse d'email — comparaison `=` BINARY côté SQLite ; vérifier si PB lowercases à la création avant tout geste.
- `?` Asymétrie `categories` (create auth, update/delete superuser) — assumer et documenter dans la doc domaine.
- `?` Résidu REC-7 — `ownerUser = self` + team étrangère au create materiel reste possible (garde team ou owner, au choix).
- `?` Perf PB : pas d'index sur `updated` (les delta-sync full-scan) ni équivalent des index Appwrite prod `idx_updatedAt` — à ajouter si les volumes croissent (recettes 456+, products 1286).

## Hors périmètre (autre repo / produit)

- Côté SITE (enka-next) : régression `isDynamic` perdue par revert `88de525a` — à corriger upstream, NE PAS porter ici.
- Images recettes (20 valeurs `img` frontmatter, og:image Hugo déjà cassées) — décision produit Phase 2 ; noter que le bucket Appwrite `recipe_img` existe (identique dev/prod) mais rien n'est prévu côté PB (stockage ou abandon).
- Étape 7 du portage (notifications realtime cross-user) et Étape 9 (robustesse SW/PWA) — hors priorité synthèse, plans dans `.agents/plans/26-10-06_audit-fixes_done/` (source : audit port-hardening §4).
- Nettoyage site : recettes `z-test` côté enka-next (2 exclus côté mig).
- Feature « documents liés par tag » teamdocs : réimplémentation exige un changement de schéma PB (tags) — produit (le sous-système client mort a été supprimé, commit `8d4541a9`).
