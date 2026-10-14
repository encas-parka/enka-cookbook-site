# Backlog — branche `mig/pocketbase`

> Alimenté par le run `26-10-06_audit-fixes` (synthèse : `.agents/plans/archive/26-10-06_audit-fixes_done/run.md` § Constats différés).
> Alimenté aussi par le run `26-10-08_phase-1-7-pipeline-robuste` (synthèse : `.agents/plans/archive/26-10-08_phase-1-7-pipeline-robuste_done/run.md` § Découvertes différées).
> Alimenté aussi par le run `26-10-12_clickthrough-fixes` (détail : `.scratch/tracker/26-10-12_clickthrough-fixes/run.md` § Findings différés — non archivé tant que le gate T12 n'est pas passé).
> Alimenté aussi par le run `26-10-13_products-identity-upsert` (détail : `.scratch/tracker/26-10-13_products-identity-upsert/run.md` § Deferred findings).
> Tags : `!` à traiter bientôt · `S2` gating déploiement · `?` conditionnel · (sans tag) dette légère.
> Règle : une ligne par constat, avec ancre. Le détail vit dans le run report archivé.
> Soldés : retirés ; les promotions récentes (constat réglé par un ticket) sont tracées en fin de section du run concerné.

## Gating déploiement (S2)

- **S2** Secret share_links ≠ id (token dédié) — REC-1 fermant l'énumération, le risque résiduel est faible ; refonte URL/invitations à faire avec la refonte du flux invitation.
- **S2** Définir `ENKA_BASE_URL` dans l'env du serveur PB (checklist Dokploy 1.8) — sans elle les emails pointent vers la prod.
- **S2** Upgrade PB 0.37.5 → 0.40.5+ — fixes sécurité (0.39.7 panic workers, 0.40.5 net/http DoS) ; aucun gain timestamps (autodate by design, inchangé jusqu'à 0.40.5, cf. run 26-10-08).
- **S2** Checklist 1.8 : fetch/merge du contenu Hugo (sync site) avant `migrate.ts` — les 30 verdicts `recipe-convergence` du run 26-10-08 viennent du gel du contenu au 06-10 ; après sync ils deviennent `stale` (re-dérivation attendue, puis validate vert). Inclut le reset password des users migrés.

## Bientôt (!)

- `!` **Override legacy : paire écriture+lecture à traiter ensemble** — écriture : `OverrideManager.handleSetOverride` normalise via `autoConvertUnit` (inverse du stockage attendu : « 1500 gr. » se stocke « 1.5 kg ») ; lecture : les helpers sœur `getNormalizedOverride`/`getEffectiveNeededQuantities` sont absents de mig (60 lignes legacy exposées, investigation backport §5 item E / §9.2). Corriger un seul côté laisserait écriture et lecture incompatibles. (run 26-10-13, T06)
- `!` teamdocs prod : 1 document rejeté (`content` > 5000 chars) — **toujours absent après le reset+ré-import du run 26-10-13 (T08, mesuré 14-10 : 21 docs, `6a3ff71f0008dcb17ba5` absent)** : le filtre est donc dans le transform/import, pas un simple ré-import à relancer ; localiser où la ligne saute, puis ré-importer (schéma live : `content max: 0`).
- `!` Doublons d'events **dans la source Appwrite** (9 copies / 6 noms, ex. `concert 2908` ×3) — côté SPA l'idempotence est **FAIT** (run 26-10-12, T10 : `createEventWithTeams` + `#reconcileCreatedEvent`) ; reste à décider si le transform garde les copies hors import (verdict T06-style) et/ou nettoyage source — pour la finalisation 1.8.
- `!` Click-through navigateur complet — **checklist : `.scratch/tracker/clickthrough-checklist.md`** ; gate T12 ouvert (`.scratch/tracker/26-10-12_clickthrough-fixes/issues/12-gate-recheck-phase1-exit.md` : §4 relis post-run 26-10-13, §6, §7, §9) ; inclut PWA version.json à bumper à la release.

## Conditionnels (?)

- `?` HOOK-6 — invité sans compte jamais rattaché à la team après inscription (refonte flux invitation, produit).
- `?` C3 — collections mortes `event_todos` / `notifications` : **état documenté 08-10** (`.agents/plans/6_migration-evaluation.md` § 5) — `event_todos` dormante (17 records d'archive, ne pas supprimer) ; à trancher produit : ressusciter ou abandonner (et purger archives + module).
- `?` C5 — checkbox « Envoyer un email aux membres » (EventCreatePage) sans effet (3e argument ignoré, confirmé par triage) — implémenter ou retirer l'option UI.
- `?` `lookup-user` casse d'email — comparaison `=` BINARY côté SQLite ; vérifier si PB lowercases à la création avant tout geste.
- `?` Asymétrie `categories` (create auth, update/delete superuser) — assumer et documenter dans la doc domaine.
- `?` Résidu REC-7 — `ownerUser = self` + team étrangère au create materiel reste possible (garde team ou owner, au choix).
- `?` T05 : 1 team sur 8 a `roles` = `{}` (aucun owner résolu par le backfill) — passe le check non-NULL ; trancher produit (team sans owner légitime ?).
- `?` (T06 26-10-13) Achat avec `products: []` (ou null) : n'atterrit dans aucune map du reconciler, jamais visible en orphelin (parité sœur) — perte potentielle d'information si le cas existe en données ; non mesuré.
- `?` (T04 26-10-13) `createGroupPurchase` : les achats du lot passent par le batch PB brut (miroir Dexie dépendant du SSE) — passer à `#purchasesCollection.createBatch()` donnerait miroir optimiste + rollback.
- `?` (T04 26-10-13) Deux formes pour le champ json `store` : `JSON.stringify(storeInfo)` en batch vs objet natif au modal (tolérées par `safeJsonParse`) — unifier au profit de l'objet natif.
- `?` (T08 26-10-13) `3-import-pb.ts --upsert` : les produits présents en PB mais absents des sources ne sont ni purgés ni verdictés (contrat « NO purge » du mode) — à savoir en lisant les chiffres (982 patched ≠ 993 en base).
- `?` (T04 26-10-13) `createGroupPurchase.totalProductsCreated` compte la sélection (`productsData.length`), pas les matérialisations réelles — compteur approximatif hérité.
- `?` (26-10-14, lot 2) Export markdown : `displayTotalOverride` non rendu (sœur `product-markdown-export.ts:68-73` biffe le besoin `~~total~~ override`) — à porter pour la parité avec le CSV (colonne « Besoin calculé »).
- `?` `initialFetch` sans epoch/abort : une `syncRevalidate` de l'ancienne identité en vol au moment d'une transition peut réécrire lignes + curseur APRÈS la purge — fenêtre étroite, se guérit à la transition suivante ; fix candidat : epoch de purge consulté par la transaction d'écriture de pb-collection. (T07 26-10-12)
- `?` Logout sans désabonnement SSE des stores (purge `purgeLocal` au lieu de `destroy`) : EventSource ouvert en période visiteur — livraisons filtrées par les règles (aucune fuite). À reconsidérer si besoin d'autoclose strict. (T07 26-10-12)
- `?` `EventMaterielStore.addItem`/`addHeaderWithAllocation` posent l'`#error` du store, rendu en alerte persistante par `EventMaterielPage` — scopage modal à revoir si souhaité. (T03 26-10-12)
- `?` `MaterielStore.#enrichedLoans` ne filtre pas le marqueur local `deleted` — `getLoanById` peut retourner un prêt soft-deleté localement. (T03 26-10-12)
- `?` `PermissionsManager.handleBack` : appelle `updateContributorStatus(..., "accepted")` avec toasts « Désinscription… » — incohérence suspecte. (investigator 26-10-12)
- `?` `EventsStore.removeContributor` retire contributors mais laisse `guestUsers` — l'utilisateur conserve l'accès serveur après retrait UI (symétrique pour les declines, cohérent UI). À arbitrer si une révocation d'accès se manifeste. (T06 26-10-12)
- `?` `EventProductsPage.handleQuickValidation` : erreur utilisateur via `alert()` au lieu de `toastService`. (investigator 26-10-12)
- `?` `RecipeEditPage` : `FIXIT: la reaquisition du lock ne fonctionne pas` — défaut connu. (investigator 26-10-12)
- `?` `EventMaterielStore.purgeLocal` : ne désabonne pas le bridge filtré par event — risque d'ancien bridge vivant après re-scope d'identité (`initializeForEvent` à lire pour trancher ; doute non vérifié). (review 13-10)
- (sans tag) id-map : écrit en fin de run seulement (énoncé T02 « incrémental » non landé) — sans impact sous contrat reset (ids hash15 dérivables à la demande).
- (sans tag) Warnings check : 5 a11y préexistants + 1 Svelte `state_referenced_locally` (CreateIngredientModal) — candidats fast-wins pour les zones voisines.
- (sans tag) `QuantityInput` rendu avec `required` (défaut du composant) dans AddProductModal alors que la validation du formulaire ne l'exige pas — identique à la sœur ; durcissement dédié si voulu. (T02 26-10-13)

## Doc & conventions

- `doc` AGENTS.md racine : compte migrations périmé (19 collections dans `pb-generated.ts`, 25+ fichiers de migrations après le run 26-10-13) — à rafraîchir à la clôture Phase 1.
- `doc` `.agents/plans/1_pocketbase-schema.md` § « API rules » : **obsolète en bloc** (era `guestEmails`/`joinToken`) — l'état durable vit dans `pocketbase/pb_migrations/` ; rafraîchir (audit des collections). (T04 + review F5 26-10-12)
- `doc` `.agents/skills/pocketbase-sdk` / `pocketbase-jsvm` (référencés par AGENTS.md) : **symlinks morts** — recréer les skills ou re-router AGENTS.md ; les pièges PB n'ont plus de doc de domaine. (T01 26-10-12)
- F1 (review 26-10-12, mineur) : jetons `(T05)`/`(T10)`/`(sonde T02)` dans 4 sites code — règle « jamais de référence ticket dans le code » ; pointer les sondes committées plutôt.
- F2 (review 26-10-12, mineur) : `db-sync/README.md` § Cache identity invariant — généralisation inexacte (purge passe aussi par `softReset()` products et `destroy()` nativeTeams).
- F3 (review 26-10-12, mineur) : `pb_migrations/1791900000` header cite un chemin `/tmp` éphémère — garder le chemin de sonde committé.
- F4 (review 26-10-12, mineur) : docstring `GlobalState.logout()` mentionne encore Appwrite (préexiste au range) — reformuler au prochain passage.

## Run 26-10-13_products-identity-upsert — promotions (soldés, pour trace)

- Critère de sortie Phase 1 = click-through vert (gravé au gate 13-10, ticket 12) — la passe navigateur de l'utilisateur reste le dernier mot.
- **Backport prod restant** (fusion déjà portée dans ce run ; C/G/H/I/J/K, PurchaseManager UI) : **`.scratch/handoff/26-10-14_backport-prod-restant.md`**.
- Promotions notables : relation invalide `createGroupPurchase` → T04 ; re-key/churn + `#resolveNeedRows` dernier-gagne (rendu impossible par l'index unique) + race check-then-create (remplacée par l'upsert à id stable) → T04 ; orphelins + collisions + recalcul ingrédients → T06 ; faux positif slug 20 → T07 (générateur sans slice) ; unicité (event, nom) + bornes 60/76 → T07 ; dédup pipeline replay-proof → T08 ; doc db-sync réécrit sur le code réel (vestiges oupla purgés) → T03.

## Hors périmètre (autre repo / produit)

- Côté SITE (enka-next) : régression `isDynamic` perdue par revert `88de525a` — à corriger upstream, NE PAS porter ici.
- Images recettes (20 valeurs `img` frontmatter, og:image Hugo déjà cassées) — décision produit Phase 2 ; le bucket Appwrite `recipe_img` existe mais rien n'est prévu côté PB (stockage ou abandon).
- Étape 7 du portage (notifications realtime cross-user) et Étape 9 (robustesse SW/PWA) — hors priorité, plans dans `.agents/plans/archive/26-10-06_audit-fixes_done/` (audit port-hardening §4).
- Nettoyage site : recettes `z-test` côté enka-next (2 exclus côté mig).
- teamdocs sœur : `isPublic`/`teamName` hors schéma mig (features distinctes, jamais portées en prod).
