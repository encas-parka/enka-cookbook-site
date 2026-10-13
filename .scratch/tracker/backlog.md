# Backlog — branche `mig/pocketbase`

> Alimenté par le run `26-10-06_audit-fixes` (synthèse : `.agents/plans/archive/26-10-06_audit-fixes_done/run.md` § Constats différés).
> Alimenté aussi par le run `26-10-08_phase-1-7-pipeline-robuste` (synthèse : `.agents/plans/archive/26-10-08_phase-1-7-pipeline-robuste_done/run.md` § Découvertes différées).
> Alimenté aussi par le run `26-10-12_clickthrough-fixes` (détail : `.scratch/tracker/26-10-12_clickthrough-fixes/run.md` § Findings différés — non archivé tant que le gate T12 n'est pas passé).
> Tags : `!` à traiter bientôt · `S2` gating déploiement · `?` conditionnel · (sans tag) dette légère.
> Règle : une ligne par constat, avec ancre. Le détail vit dans le run report archivé.

## Gating déploiement (S2)

- **S2** ~~Re-import complet des données~~ **FAIT 06-10** (T17 Phases 2-3, export prod frais : users 59, events 39, products 1286, purchases 1329, recipes 456/456 created peuplés). Reste : 1 teamdocs prod rejeté (content > 5000 — voir `!`).
- **S2** Secret share_links ≠ id (token dédié) — REC-1 fermant l'énumération, le risque résiduel est faible ; refonte URL/invitations à faire avec la refonte du flux invitation.
- **S2** Définir `ENKA_BASE_URL` dans l'env du serveur PB (checklist Dokploy 1.8) — sans elle les emails pointent vers la prod.
- **S2** Upgrade PB 0.37.5 → 0.40.5+ — fixes sécurité (0.39.7 panic workers, 0.40.5 net/http DoS) ; aucun gain timestamps (autodate by design, inchangé jusqu'à 0.40.5, cf. run 26-10-08).
- **S2** Checklist 1.8 : fetch/merge du contenu Hugo (sync site) avant `migrate.ts` — les 30 verdicts `recipe-convergence` du run 26-10-08 viennent du gel du contenu au 06-10 ; après sync ils deviennent `stale` (re-dérivation attendue, puis validate vert).

## Bientôt (!)

- ~~`!` Décision produit `materiel.createdBy`~~ **TRANCHÉ 08-10 (plan A)** : l'option backfill était morte (ownerUser vide aussi — la source Appwrite n'a jamais porté ces valeurs, owner.userId = "" sur 110/110). Retenu : deleteRule team-scopées (`createdBy = auth || teamId.members ~ auth` ; loans : `ownerId.members ~ auth`, parité avec les permissions Appwrite réelles : delete("team:…") sur 80/110), `createLoan` écrit désormais `createdBy`, et backfill `teams.roles` des 8 teams legacy (migrations 1791500000 + 1791600000). Suites : purge des 2440 doublons d'un import accidentel (idem 08-10, voir handoff), et ticket `need-triage_admin-only-server-enforcement.md` pour le durcissement serveur éventuel.
- `!` teamdocs prod : 1 document rejeté à l'import (`content` > 5000 chars) — **limite déjà levée** : le schéma live PB a `content max: 0` (snapshot 1791277647 postérieur à l'import T17) ; reste uniquement à ré-importer le doc (`6a3ff71f0008dcb17ba5`, présent dans `scripts_dev/appwrite-export/teamdocs.json`), puis validate-migration devrait passer 38/38.
- `!` Doublons d'events à la création — signature replay offline-first : 9 copies / 6 noms dans la source Appwrite (ex. `concert 2908` ×3, créations à ~95 ms d'intervalle le 24-08, mesuré 12-10 via export + dev), fidèlement importées en PB — livrées telles quelles au run 1.8 (nettoyage source non retenu). Correctif à prévoir côté SPA (`EventsStore.svelte.ts#createEventWithTeams` / `EventCreatePage.svelte`) : rendre la création idempotente (anti double-soumission + dédoublonnage de la file Dexie au replay) ; décider si le transform doit en plus garder les copies hors import (verdict T06-style) pour la finalisation.
- `!` Click-through navigateur complet — **checklist à suivre : `.scratch/tracker/clickthrough-checklist.md`** (prérequis reset + flux ordonnés + non-bugs) ; liste d'origine dans run.md § journal T18 (créations UI, RSVP, invitation email réel via SMTP, locks concurrents, resync SSE topic custom `user_<id>`, logout/login, visiteur, PWA version.json à bumper à la release) + **fonctionnalité « documents liés par tag » restaurée (run 26-10-07 : champ tags PB + bloc sur 4 pages événement, tags parité site `materiel`/`produit`/`recette`/`tache` ; les 10 teamdocs prod tagués préservés au re-import)** — à valider visuellement.

## Conditionnels (?)

- `?` HOOK-6 — invité sans compte jamais rattaché à la team après inscription (refonte flux invitation, produit).
- `?` C3 — collections mortes `event_todos` / `notifications` : **état documenté 08-10** (voir `.agents/plans/6_migration-evaluation.md` § 5) — la vérité live des todos est le champ `events.todos` ; la collection `event_todos` reste **dormante** (17 records d'archive, schéma `assignedTo` conservé pour une éventuelle collection dédiée à granularité par-tâche — ne pas supprimer) ; module `event-todo.utils.ts` conservé non importé. À trancher produit : ressusciter la collection dédiée ou l'abandonner (et purger archives + module).
- `?` C5 — checkbox « Envoyer un email aux membres » (EventCreatePage) sans effet (3e argument ignoré, confirmé par triage) — implémenter ou retirer l'option UI.
- `?` `lookup-user` casse d'email — comparaison `=` BINARY côté SQLite ; vérifier si PB lowercases à la création avant tout geste.
- `?` Asymétrie `categories` (create auth, update/delete superuser) — assumer et documenter dans la doc domaine.
- `?` Résidu REC-7 — `ownerUser = self` + team étrangère au create materiel reste possible (garde team ou owner, au choix).
- `?` Perf PB : ~~pas d'index sur `updated`~~ **Fait (run 26-10-07, T01)** : 11 index posés avec preuves EXPLAIN (delta `updated` ×7, composites `(eventId, updated)` ×3, share_links `(target_id, link_type)`) ; candidats rejetés par la preuve : locks (client 100 % PK), events.createdBy (rules OR avec `~` JSON non-indexables).
- `?` T05 : 1 team sur 8 a `roles` = `{}` (aucun owner résolu par le backfill) — passe le check non-NULL ; trancher produit (team sans owner légitime ?).
- (sans tag) id-map : écrit en fin de run seulement (énoncé T02 « incrémental » non landé) — sans impact sous contrat reset (ids hash15 dérivables à la demande).

## Run 26-10-12_clickthrough-fixes

- **Critère de sortie Phase 1 = click-through vert** (pas seulement pipeline 86/86) — checklist : `.scratch/tracker/clickthrough-checklist.md` ; le verdict pipeline ne couvre que la fidélité d'import, jamais les write paths runtime. Gravé au gate 13-10 (ticket 12).

- `!` `ProductsStore.createGroupPurchase` : création implicite au **nouvel id serveur** mais le batch référence l'**id virtuel d'origine** → relation invalide (400 `validation_missing_rel_records`) une fois les règles levées ; payload ne pose pas `isSynced` → re-création en boucle par le modal groupé. Fix candidat : réutiliser `#ensureSyncedProduct` + tester l'existence (`db.products.get`) plutôt que le flag `isSynced` (les records importés de prod peuvent porter `isSynced=false`). (T01)
- `!` `.agents/skills/pocketbase-sdk` / `pocketbase-jsvm` (référencés par AGENTS.md) : **symlinks morts** (cibles supprimées de `~/.agents/skills/`) — recréer les skills ou re-router AGENTS.md ; les pièges PB du run n'ont plus de doc de domaine. (T01)
- `?` `EventMaterielStore.addItem`/`addHeaderWithAllocation` posent l'`#error` du store, rendu en alerte persistante par `EventMaterielPage` — un échec de sync (rare post-`1791800000`) laisse l'alerte sur la page event. Scopage modal complet à revoir si souhaité. (T03)
- `?` `MaterielStore.#enrichedLoans` ne filtre pas le marqueur local `deleted` — `getLoanById` peut retourner un prêt soft-deleté localement (actionnable). À filtrer si des actions sur prêts fantômes se manifestent. (T03)
- `?` `PermissionsManager.handleBack` : appelle `updateContributorStatus(..., "accepted")` avec toasts « Désinscription… » — incohérence suspecte (copier-coller de handleUnregister ?). (investigator)
- `?` `EventsStore.removeContributor` retire contributors mais laisse `guestUsers` — l'utilisateur conserve l'accès serveur après retrait UI ; symétrique pour les declines (cohérent avec l'UI). À arbitrer si une révocation d'accès se manifeste. (T06)
- `?` `EventProductsPage.handleQuickValidation` : erreur utilisateur via `alert()` au lieu de `toastService`. (investigator)
- `?` `RecipeEditPage` : `FIXIT: la reaquisition du lock ne fonctionne pas` — défaut connu, proche de la zone T08/T05. (investigator)
- `?` `initialFetch` sans epoch/abort : une `syncRevalidate` de l'ancienne identité en vol au moment d'une transition peut réécrire lignes + curseur APRÈS la purge — fenêtre étroite, se guérit à la transition suivante ; fix candidat : epoch de purge consulté par la transaction d'écriture de pb-collection. (T07)
- `?` Logout sans désabonnement SSE des stores (purge `purgeLocal` au lieu de `destroy`) : EventSource ouvert en période visiteur — livraisons filtrées par les règles (aucune fuite), contrepartie du re-login same-session sans re-souscription. À reconsidérer si besoin d'autoclose strict. (T07)
- `?` `ProductsStore.#resolveNeedRows` : Maps `byRef`/`byName` « dernier gagne » — deux produits synchronisés homonymes dans le même event → re-key sur un produit arbitraire (fusion possible sur le mauvais record, impact affichage). Détecter les collisions et ne re-keyer que si unique. (review spec 13-10)
- `?` `ProductsStore.#ensureSyncedProduct` : course check-then-create — deux appels quasi simultanés sur le même id virtuel → doublon produit serveur (improbable en UI, états busy ; aucun test de concurrence). Re-vérifier Dexie après create ou accepter et documenter. (review spec 13-10)
- `?` `EventMaterielStore.purgeLocal` : ne désabonne pas le bridge filtré par event — risque d'ancien bridge vivant ou dupliqué après re-scope d'identité (`initializeForEvent` à lire pour trancher ; doute non vérifié). (review spec 13-10)
- `doc` AGENTS.md racine : « pb_migrations (13 collections) » — 14 fichiers présents ; « pb-generated.ts (19 collections) » non vérifié. (investigator)
- `doc` `.agents/plans/1_pocketbase-schema.md` § « API rules » : **obsolète en bloc** (era `guestEmails`/`joinToken`, antérieur aux durcissements `1791278800` + créateur `1791700000`/`1791800000`/`1791900000`) — l'état durable vit dans `pocketbase/pb_migrations/` ; rafraîchir (audit des collections). (T04 + review F5)
- (sans tag) Warnings check : 5 a11y préexistants + 1 Svelte `state_referenced_locally` (CreateIngredientModal) — candidats fast-wins pour les zones voisines. (fin de run)

## Review clickthrough-fixes (13-10, propositions non appliquées — arbitrage mainteneur)

- F1 (mineur) : jetons `(T05)`/`(T10)`/`(sonde T02)` dans 4 sites code (commentaire EditDocumentPage, docstrings EventsStore/pb.d.ts/doc-remote-sync) — règle « jamais de référence ticket dans le code » ; pointer les sondes committées plutôt.
- F2 (mineur) : `db-sync/README.md` § Cache identity invariant — généralisation inexacte (la purge passe aussi par `softReset()` products et `destroy()` nativeTeams) ; reformuler « local-reset entry point ».
- F3 (mineur) : `pb_migrations/1791900000` header cite un chemin `/tmp` éphémère — garder seulement le chemin de sonde committé.
- F4 (mineur) : docstring `GlobalState.logout()` mentionne encore Appwrite (préexiste au range, introduit `cb90cd9d`) — reformuler au prochain passage.
- F5 (mineur) : voir `doc` 1_pocketbase-schema.md ci-dessus (l'écart a grossi avec 3 migrations de règles du run).
- F6 (mineur) : claims t08/t09 DONE non purgés — **purgés par l'orchestrateur au gate** (soldé).

## Hors périmètre (autre repo / produit)

- Côté SITE (enka-next) : régression `isDynamic` perdue par revert `88de525a` — à corriger upstream, NE PAS porter ici.
- Images recettes (20 valeurs `img` frontmatter, og:image Hugo déjà cassées) — décision produit Phase 2 ; noter que le bucket Appwrite `recipe_img` existe (identique dev/prod) mais rien n'est prévu côté PB (stockage ou abandon).
- Étape 7 du portage (notifications realtime cross-user) et Étape 9 (robustesse SW/PWA) — hors priorité synthèse, plans dans `.agents/plans/archive/26-10-06_audit-fixes_done/` (source : audit port-hardening §4).
- Nettoyage site : recettes `z-test` côté enka-next (2 exclus côté mig).
- Feature « documents liés par tag » teamdocs : **RESTAURÉE et fonctionnelle** (run 26-10-07, T02 : champ `tags` json + bloc sur 4 pages + mapping pipeline ; les tags prod existants — 10 docs — sont préservés au re-import). Résiduel : `isPublic`/`teamName` restent hors schéma (features distinctes, jamais portées en prod).
