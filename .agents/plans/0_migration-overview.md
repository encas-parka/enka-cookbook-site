# Plan de migration ENKA-COOKBOOK — Vue d'agent

**Créé le :** 2026-04-21
**Dernière MAJ :** 2026-05-07
**Statut :** Phase 1 — 1.0→1.3b ✅, 1.7a ✅, 1.7b ✅ (pipeline terminé, données importées), 1.8 ⬜
**Plan détaillé :** `.agents/plans/26-05-04_migration-pipeline-export-transform.md` (pipeline export+transform) + `.agents/plans/26-05-03_data-migration-pb_pre.md` (schéma + données statiques)
**Documents source (pédagogiques) :** `../` — ce dossier `agent/` est la version synthétique destinée aux LLM

---

## Objectifs de la migration

### Contrainte primaire : RAM

- VPS Contabo 8 GB, ~5.7 GiB occupés dont ~3 GiB par Appwrite self-hosted
- Objectif : libérer ~4.5 GiB pour cohabiter avec d'autres apps (Dokploy ~940 MiB, Stalwart ~127 MiB, Traefik ~27 MiB déjà présents)
- PocketBase cible : ~20 MiB RAM vs Appwrite ~3 GiB

### Objectifs secondaires

- **Simplifier le pipeline recettes** : supprimer Hugo + GitHub Actions CRON + Cloud Function Octokit + Cloudflare Pages. Délai actuel : jusqu'à 6h. Cible : < 1s.
- **Supprimer la dualité de sources** : recettes actuellement dans GitHub Markdown + Appwrite DB. Cible : PocketBase seul.
- **Simplifier les services CRUD** : ~60% de la complexité Appwrite est spécifique au SDK (relations manuelles, permissions Label, batch via CF, JSON.stringify). PocketBase élimine ces patterns nativement.
- **Activer le SSR sur les pages publiques** pour SEO et FCP (Phase 3 optionnelle).

### Non-objectifs

- L'app reste en beta, pas d'enjeu SEO immédiat (Phase 1+2 = tout CSR)
- Pas de changement de framework UI (Svelte 5 conservé)

---

## Stack actuelle → Stack cible

```
ACTUEL :
Hugo (Markdown → JSON) + Cloudflare Pages (CDN)
Svelte 5 SPA (CSR) + sv-router + Vite
Appwrite self-hosted (~3 GiB RAM)
  ├── DB (collections + permissions Labels)
  ├── Auth
  ├── Realtime (WebSocket)
  └── Cloud Functions (3 fonctions Bun, ~3400 lignes)
      ├── users_tems_manager (2053l) — gestion teams/labels/events
      ├── enka-data (1082l) — produits batch + achats
      └── invitation (277l) — invitations + share links
aw-sync (Appwrite ↔ Dexie IndexedDB ↔ SvelteMap)

CIBLE (4 phases séquentielles) :
Phase 0 : Migration users Appwrite → PocketBase (shadow auth)
Phase 1 : Appwrite → PocketBase (CSR conservé, services CRUD)
Phase 2 : sv-router → SvelteKit file-based routing (tout CSR)
Phase 3 : SSR sélectif sur 3 pages publiques
```

---

## 4 phases séquentielles

```
Phase 0                   Phase 1                    Phase 2                      Phase 3
Shadow user migration     PocketBase + pb-sync       SvelteKit (tout CSR)         SSR sélectif
(bulk + capture pwd)      (CSR, même archi)          (migration routing)          (pages publiques)

Users PB créés ───> Appwrite ──────────> PocketBase                     PocketBase
                    aw-sync ──────────> pb-sync                         pb-sync
                    sv-router ─────────────────> SvelteKit routing ────> SvelteKit routing
                    CSR (tout) ────────> CSR (tout) ──────────────────> SSR + CSR hybride
                    Nginx ────────────────────────────────────────────────> adapter-node
```

Chaque phase est un **livrable déployable**. L'app fonctionne après chaque phase.

### Dépendances

- **Phase 0 avant Phase 1** : PocketBase doit avoir les users et les permissions (guestEmails[]) avant que les services CRUD ne soient migrés.
- **Phase 1 avant Phase 2** : Hugo génère les JSON actuels. Sans PocketBase, SvelteKit n'a pas de source de données pour les pages publiques.
- **Phase 2 avant Phase 3** : il faut la structure SvelteKit en place avant d'activer le SSR.
- Phases 2 et 3 peuvent se chevaucher si confiance.

---

## Phase 0 — Migration utilisateurs Appwrite → PocketBase

### Objectif

Transférer les utilisateurs et les données Appwrite dans PocketBase. Le code étant déjà 100% PB (depuis les étapes 1.0→1.6b), la shadow auth originale (Phase 0b/0c) est abandonnée. L'approche est un **export one-shot** depuis Appwrite + **import dans PB sans mot de passe**.

### Contrainte majeure

Les mots de passe Appwrite sont hashés en **argon2** et ne sont pas portables dans PB (**bcrypt**). Les users devront définir un nouveau mot de passe via un mécanisme de reset. Aucun risque de corruption de la base Appwrite source (opérations en lecture seule).

### Ressources Appwrite (gitignored)

| Environnement | Chemin absolu                                                               | Project ID             |
| ------------- | --------------------------------------------------------------------------- | ---------------------- |
| **Dev**       | `/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-site/appwrite-ec-dev/` | `697a1fcf0005e3703e25` |
| **Prod**      | `/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-site/appwrite/`        | `696b7acb0037bde79e3f` |

### Étapes — Passe 1 : Dev (test)

- [x] **0a** Exploration et validation sur `ec-dev` (6 users de test) ✅
- [x] **0b** Anciens scripts mono-collection : `migrate-users.ts`, `migrate-teams.ts`, `migrate-events.ts` ✅
- [x] **0c** Pipeline 3-phase : `1-export-appwrite.ts` ✅ écrit + testé (13 collections exportées)
- [x] **0d** Pipeline 3-phase : `2-transform-data.ts` ✅ écrit + testé (mais input incomplet)
- [ ] **0e** **🔴 BLOQUANT** : CLI Appwrite ne retourne pas les champs de relation/JSON → passer au Server SDK
- [ ] **0f** Pipeline 3-phase : `3-import-pb.ts` — à écrire
- [ ] **0g** Validation complète (relations, guestEmails, accès)

### Étapes — Passe 2 : Prod

- [ ] **0h** Rejouer le pipeline sur la base Appwrite prod (20-50 users) → PB prod
- [ ] **0i** Mécanisme de reset de mot de passe (stratégie à décider)
  - **Stratégie OTP/Magic Link (Recommandée)** :
    - Les users migrés sont créés avec `setRandomPassword()` (mot de passe inconnu de l'utilisateur)
    - Un OTP (One-Time Password) est généré et envoyé par email via PocketBase
    - L'email contient un **Magic Link** personnalisé : `https://app.com/accept-invite?otpId={OTP_ID}&code={OTP}`
    - `AcceptInvite.svelte` (à recréer) récupère les query params et :
      1. Valide l'OTP via `pb.collection('users').authWithOTP(otpId, code)`
      2. Affiche un formulaire demandant à l'utilisateur de définir son nouveau mot de passe
      3. Met à jour via `record.setPassword(newPassword)` + `pb.collection('users').update(record.id, record)`
    - **Avantage** : Expérience "passwordless" fluide, pas de gestion de tokens de reset complexes
    - **Implémentation** :
      - Hook JSVM `invite-to-event.pb.js` ou nouveau hook `create-user-with-otp.pb.js`
      - Template email OTP modifié dans l'Admin UI (collection users > OTP > Email Template)
      - Page Svelte `AcceptInvite.svelte` à créer/recréer
- [ ] **0j** Nettoyage (suppression anciens scripts, mapping, champs temporaires)

→ Voir `26-05-03_user-migration-pb_pre.md` (plan détaillé, remplace `0b_user-migration_OBSOLETE.md`)

---

## Phase 1 — Appwrite → PocketBase (CSR conservé)

### Ce qui change

| Avant                                  | Après                                 |
| -------------------------------------- | ------------------------------------- |
| Appwrite (~3 GiB RAM)                  | PocketBase (~20 MiB RAM)              |
| `aw-collection.ts`                     | `pb-collection.ts` (même contrat API) |
| Cloud Functions (3, ~3400 lignes)      | Routes custom + hooks PB JSVM         |
| Permissions Labels                     | API rules + `guestEmails[]`           |
| Recettes Markdown GitHub               | Collection `recipes` dans PB          |
| RecipesStore fusion Hugo+Appwrite      | RecipesStore simplifié (PB seul)      |
| Pipeline migration : scripts mono-collection | Pipeline unifié 4 phases (A→D), 8 scripts, architecture JSON intermédiaire |
| `getAppwriteInstances()` (~100 lignes) | `new PocketBase(url)` (~5 lignes)     |
| NotificationStore (propagation manuel) | Supprimé (PB SSE natif par store)     |

### Étapes

- [x] **1.0** Setup worktree + PocketBase ✅ `0f3b17f7`
  - Worktree `enka-cookbook-mig` sur branche `mig/pocketbase`
  - PocketBase v0.37.5 installé dans `pocketbase/`
  - Scripts `dev:pb` et `dev:all` dans `package.json`

- [x] **1.1** Implémenter `pb-sync` ✅ `8b9a03d7`
  - `pb.ts` (36l) — Client PocketBase singleton
  - `pb-types.ts` (134l) — Types PocketBase (PbFetchOptions, PbSubscribeOptions, PbSyncOptions)
  - `pb-collection.ts` (745l) — createSyncCollection même contrat API que aw-collection
  - `pb-sync.ts` (48l) — Barrel export (remplacement direct de aw-sync)
  - ~~Normalisation transparente PB→AwDoc (id→$id)~~ → supprimée en 1.6b, données PB natives
  - bridge/useLiveQuery/Dexie inchangés
  - Package ajouté : pocketbase@0.26.8, pocketbase-typegen@1.5.0 (dev)
  - TypeScript : 0 erreurs
  - → Voir `2_pb-sync-stores.md`

- [x] **1.2** Schéma PocketBase (13 collections + users built-in) ✅ `df0cb1b2`
  - → Voir `1_pocketbase-schema.md`

- [x] **1.3** Système d'invitation (routes + hooks PB) — **complet ✅**
  - ✅ `POST /api/enka/join-event` — route custom JSVM pour le join via share link (`pocketbase/pb_hooks/join-event.pb.js`)
  - ✅ `pb-invitations.ts` — service client (createShareLink, redeemShareLink, getEventShareLinks, deactivateShareLink)
  - ✅ `pb-locks.ts` — service locks (getLock, acquireLock, releaseLock, subscribeToLock)
  - ✅ `POST /api/enka/send-emails` — hook email agnostique pour invitations (`pocketbase/pb_hooks/send-emails.pb.js`)
  - ✅ `EventsStore.inviteParticipants()` — implémenté avec guestEmails + teams + emails fire-and-forget
  - ⬜ ~~Hook `onRecordAfterUpdateSuccess("teams")` : resync events quand team modifiée~~ → **Résolu** `c2f6332c` : hook `teams-resync-events.pb.js` avec SSE custom ciblé par userId

- [x] **1.4-1.5** Migrer les stores + services CRUD (bundlés par lots) ✅
  - **Approche** : stores et services migrés ensemble par domaine fonctionnel (6 lots A→F)
  - **Plan détaillé** : `.agents/plans/26-05-02_stores-migration-pb_pre.md`
  - **Lots complétés :**
    - Lot A (Auth) ✅ `cb90cd9d` — pb-auth.ts + GlobalState + AuthModal
    - Lot B (Events) ✅ `aef9439d` — EventsStore + appwrite-events supprimé
    - Lot C (Products) ✅ `18e44d24` — ProductsStore + appwrite-products/transaction supprimés
    - Lot D (Recipes) ✅ `40d7256f` + `6a9a85f2` — RecipesStore simplifié (Hugo retiré) + pages
    - Lot E (Materiel) ✅ `10e03a98` — MaterielStore + EventMaterielStore + 3 services supprimés
    - Lot F-1 (Teamdocs) ✅ `2b8042a2` — TeamdocsStore + RealtimeManager supprimé
    - Lot F-2 (NativeTeams) ✅ `cf7f73d9` — NativeTeamsStore refonte complète
    - Lot F-3 (Invitations) ✅ `6c76a1ad` — pb-invitations + hook PB join-event
    - Lot F-4 (Notifications) ✅ `61ecfffc` — NotificationStore supprimé (redondant PB SSE)
    - Lot F-5 (Locks) ✅ `24602655` — pb-locks + 3 consommateurs migrés
    - Schéma PB enrichi ✅ `165062d4` — teams, teamdocs, locks, share_links
  - **Cleanup** ✅ `db63e5bc` — 17 fichiers supprimés, 5779 lignes
  - `bridgeToMap` et `useLiveQuery` : 0 changement (backend-agnostic)
  - → Voir `2_pb-sync-stores.md` et `3_crud-services.md`

- [x] **1.6** Simplifier le RecipesStore ✅ `40d7256f`
  - Supprimé : `#hugoRecipes`, `#loadIndexFromDataJson()`, `#versionTimestamp`, `#HUGO_META_KEY`, logique de fusion (~210 lignes)
  - Résultat : `#collection → #bridge → #recipesIndex` (direct)
  - → Voir `2_pb-sync-stores.md` section RecipesStore

- [x] **1.6b** Migration noms PB natifs (suppression mapping Appwrite) ✅
  - **Plan détaillé** : `.agents/plans/26-05-02_pb-native-naming_pre.md`
  - Installé `pocketbase-typegen` + généré `pb-generated.ts` (19 collections)
  - `AwDoc` → `PbDoc` avec champs natifs (`id`, `created`, `updated`)
  - Supprimé `normalizeRecord()` et `toPBRecord()` de `pb-collection.ts`
  - Renommage global : `$id`→`id`, `$createdAt`→`created`, `$updatedAt`→`updated` (~634 occ. sur 104 fichiers)
  - Dexie v6 : indexes `"$id"` → `"id"`
  - Bridge : `item.$id` → `item.id`, comparaison `updated` au lieu de `$updatedAt`
  - Supprimé `appwrite-dev.ts` (329 lignes) + package npm `appwrite`
  - `bun run check` : 0 erreurs ✅

- [x] **1.3b** Fix imports cassés + build réparé ✅ `7974fcf5`
  - 8 fichiers importaient encore des services Appwrite supprimés (appwrite-products, appwrite, NotificationStore, aw-sync)
  - `ProductsStore.createExpense()` ajouté (remplace `createExpensePurchase` du service supprimé)
  - `ProductWithPurchases` défini localement dans `productEnrichment.ts`
  - `esbuild@0.28.0` installé (requis par `minify: "esbuild"` pour `pure: ["console.log"]` sélectif)
  - Chunk mort `appwrite` supprimé de `vite.config.ts`
  - `bun run check` : 0 erreurs ✅ — `bun run build` : succès ✅

- [x] **1.7a** Schéma PB complet + données statiques ✅
  - Voir `.agents/plans/26-05-03_data-migration-pb_pre.md`
  - 27 migrations (15 collections, 12 fixups) ✅
  - `ingredients` (845), `categories` (60), `recipes` (372) importés ✅
  - Types régénérés, `bun run check` → 0 erreurs ✅

- [x] **1.7b** Migration données Appwrite → PB (users + données dynamiques) — **✅ terminé**
  - Voir `.agents/plans/26-05-04_migration-pipeline-export-transform.md` (pipeline réécrit)
  - Voir `scripts_dev/doc_migrationPb.md` (documentation pipeline complète)
  - ✅ Pipeline unifié 4 phases (A→D), 8 scripts :
    - Phase A : Schéma PB (migrations auto au démarrage)
    - Phase B : `1-export-appwrite.ts` → `2-transform-data.ts` → `3-import-pb.ts` (données Appwrite)
    - Phase C : `migrate-recipes.ts` + `migrate-ingredients.ts` + `migrate-recipe-catalog.ts` (données Hugo → import direct PB)
    - Phase D : `4-fix-timestamps.ts` (SQL direct) + `validate-migration.ts`
  - ✅ Architecture unifiée : tous les transforms produisent du JSON PB-ready, un seul point d'import (`3-import-pb.ts` pour Appwrite, `migrate-*.ts` pour Hugo)
  - ✅ 1094/1095 records importés, validés par `validate-migration.ts`
  - ✅ Mapping appwriteId → pbId (`migration-map.json`, 4163 lignes)
  - ✅ Transformation labels → guestEmails[]
  - ⚠️ **Dettes data migration** (voir section I ci-dessous) : double-sérialisation JSON, IDs Appwrite dans owner, users listRule restrictif

- [ ] **1.8** Déploiement Dokploy (Nginx + PocketBase)
  - Dockerfile Nginx pour servir les fichiers statiques du build Vite
  - Dockerfile PocketBase avec volume `/pb/pb_data`
  - Cache Traefik + Cloudflare pour les routes publiques PB

### Restant Phase 1

#### ✅ Résolus (étapes 1.6b + 1.3b + session quick wins)

- ~~**A. Types — Dépendance résiduelle au package `appwrite`**~~ → **Résolu 1.6b** : `Models.Row` remplacé par `PbDoc`, package `appwrite` supprimé
- ~~**B. Fichier mort `appwrite-dev.ts`**~~ → **Résolu 1.6b** : supprimé (329 lignes)
- ~~**C.2 `EventsStore.inviteParticipants()` stub**~~ → **Résolu 1.3** `c3b7783a` : implémenté avec guestEmails + teams + emails fire-and-forget
- ~~**D.1 `POST /api/enka/invite-to-event`**~~ → **Résolu 1.3** : hook `send-emails` agnostique + template `invitation_to_event`
- ~~**F. Imports cassés vers services supprimés**~~ → **Résolu 1.3b** `7974fcf5` : 8 fichiers corrigés, build réparé

**Session quick wins + hook resync** (`73a46b7d` → `f7d9e1b3`) :

- ~~**C.1 `NativeTeamsStore.inviteTeamMember()` stub**~~ → **Résolu** `73a46b7d` : implémenté + hook `invite-to-team.pb.js` + template email team
- ~~**C.3 `AcceptInvite.svelte` stub**~~ → **Déjà supprimé** (fichier absent du codebase)
- ~~**C.4 `EventsStore.createEvent()` dead code**~~ → **Résolu** `c2f6332c` : supprimé + `createEventWithTeams()` nettoyé
- ~~**D.2 `POST /api/enka/invite-to-team`**~~ → **Résolu** `73a46b7d` : hook `invite-to-team.pb.js` + template `invitation_to_team`
- ~~**D.3 `onRecordAfterUpdateSuccess("teams")`**~~ → **Résolu** `c2f6332c` : hook `teams-resync-events.pb.js` — SSE custom ciblé par userId
- ~~**F.1 Clés localStorage `appwrite-user-*`**~~ → **Résolu** `c2f6332c` : renommées `enka-user-*`
- ~~**F.2 `syncFromAppwrite()`**~~ → **Résolu** `c2f6332c` : renommée `syncFromRemote()`
- ~~**F.3 `AwCollectionName`**~~ → **Résolu** `c2f6332c` : renommé `PbCollectionName`
- ~~**F.4 Commentaire obsolète `appwrite.ts` dans aw-types.ts**~~ → **Résolu** `c2f6332c` : supprimé
- ~~**Logging hooks**~~ → **Résolu** `f7d9e1b3` : `console.log` → `$app.logger()` structuré pour les actions métier

#### 🟡 Restant Phase 1

**E. Migration & déploiement** :

- ~~Scripts migration données (Appwrite → PB) — **1.7**~~ → **✅ 1.7b terminé**
- Déploiement Dokploy (Dockerfiles + Traefik) — **1.8**

**E2. Corrections post-migration (données)** :

- ⬜ Corriger `2-transform-data.ts` : double-sérialisation JSON (meals, contributors) + IDs Appwrite dans owner
- ⬜ Re-importer les collections affectées après correction du script
- ⬜ Corriger `users` listRule pour permettre `expand: 'members'` (ou modifier NativeTeamsStore)

**G. Dette technique mineure résiduelle** :

- Commentaires résiduels Appwrite dans divers fichiers (imports `from "$lib/types/appwrite.d"`, commentaires "Remplace appwrite-\*")
- `EventShareLinks.svelte` — vérifier que le composant fonctionne end-to-end avec PB

**H. Notes schéma PB — Spécificités materiel/materiel_loan** :

Ces collections ont des différences structurelles par rapport à Appwrite qui méritent documentation :

- **`materiel.owner`** (json, ajouté via Admin UI) : Stocke le JSON Appwrite brut `{"userName":"","userId":"","teamName":"Enka Parka","teamId":"..."}`. Le code app (`enrichMaterielFromAppwrite`) utilise `parseOwnerFromAppwrite(doc.owner)` pour parser ce JSON. Ce champ est la source de vérité pour l'affichage du propriétaire.
- **`materiel.ownerUser`** (relation → users) et **`materiel.teamId`** (relation → teams) : Champs de relation dérivés du JSON `owner`. Utilisés par les API rules PB pour le contrôle d'accès (`ownerUser = @request.auth.id || teamId.members ~ @request.auth.id`). Peuvent être null si le userId/teamId n'est pas mappable.
- **`materiel.createdBy`** (relation → users) : Existe dans le schéma PB mais **pas dans Appwrite**. Sera toujours null pour les données migrées. Ce n'est pas bloquant.
- **`materiel_loan.ownerId`** (relation → teams) : En Appwrite, `ownerId` contient toujours un **team ID** (pas un user ID). La relation PB pointe vers `teams`, ce qui est correct. Actuellement l'UI ne permet que la sélection d'une team comme propriétaire d'un emprunt — un `ownerUser` n'a pas été implémenté. Le nom `ownerId` est donc légèrement trompeur mais fonctionnellement correct.

**I. Bug PB v0.37.5 — Opérateur `?=` cassé + workaround `~`** :

PocketBase v0.37.5 a un bug confirmé : l'opérateur `?=` (array contains any equal) **ne fonctionne pas** sur les champs relation et json — retourne toujours `false`. Issues GitHub : #1725, #4347, #6647. Le mainteneur recommande `~` comme workaround.

**Fix appliqué** (migration `1700000040_api_rules_fix_tilde.js`) :
- Toutes les API rules : `?=` → `~`
- Scoping via relations : `@collection.teams.members` → `teamId.members`, `@collection.events.guestEmails` → `eventId.guestEmails`
- Guard joinToken : `joinToken != "" && joinToken = ...` (empêche `""=""` = true)
- SDK filter : `NativeTeamsStore` → `members ~ {:userId}`

**⚠️ Implications sécurité du `~`** :
- `~` fait un `LIKE '%value%'` SQL sur le JSON sérialisé
- **IDs (15 chars aléatoires)** : ✅ Risque négligeable (pas de collision substring réaliste)
- **Emails** : ⚠️ Risque faible mais réel — `alice@example.co` substring de `alice@example.com`. Nécessite : connaître l'email invité + contrôler un domaine + vérification email PB
- **Conclusion** : acceptable pour un outil interne de cuisine collective. À revoir si PB fixe `?=` dans une version future, ou migrer `guestEmails` vers une collection relationnelle dédiée (avant mise en prod publique)

**J. Dettes data migration — Qualité des données importées** :

Trois problèmes de qualité de données identifiés dans le pipeline `2-transform-data.ts` → `3-import-pb.ts` :

1. **Double-sérialisation JSON** (bloquant pour l'UI) : `events.meals` et `events.contributors` contiennent des strings JSON au lieu d'objets. Cause : `remapContributors()` fait `JSON.stringify(JSON.parse(str))` au lieu de retourner l'objet parsé. Résultat : `["{\"id\":\"...\",...}"]` au lieu de `[{"id":"...",...}]`. Impact : l'UI ne peut pas parser ces données correctement.
   - Fix : corriger `2-transform-data.ts` (retourner l'objet parsé) + re-importer les collections affectées

2. **IDs Appwrite non remappés dans les champs JSON** (bloquant pour materiel) : `materiel.owner.teamId` contient `"695d58fa000fa95a0fb9"` (ID Appwrite) au lieu de l'ID PB. Le script de transform ne remappe les IDs que dans les champs relation, pas dans les objets JSON imbriqués.
   - Fix : ajouter le remapping dans `2-transform-data.ts` pour `owner.teamId` + re-importer

3. **`users` listRule trop restrictif pour `expand`** (bloquant pour les membres teams) : `listRule: id = @request.auth.id` empêche `expand: 'members'` de résoudre les autres utilisateurs. Seul l'utilisateur courant est retourné dans l'expand.
   - Fix : assouplir le listRule pour permettre la lecture basique (id, name, email) entre utilisateurs authentifiés, OU fetch les membres séparément dans le store

**K. Note : `events.todos` vs `event_todos` (redondance documentée)**

Après analyse, l'UI utilise exclusivement `events.todos` (JSON embedded). La collection `event_todos` est un doublon créé par la migration Appwrite mais jamais utilisé par l'app.

**Décision** : Les deux coexistent pour l'instant. `events.todos` est le modèle actif. `event_todos` pourra être utilisé à l'avenir pour plus de flexibilité (queries, relations, permissions granulaires). Le passage éventuel de embedded → collection est documenté pour une itération future.

### Risques

| Risque                                         | Mitigation                                                     | Statut |
| ---------------------------------------------- | -------------------------------------------------------------- | ------ |
| Double-hop `@collection.*` dans API rules      | Modèle `guestEmails[]` dénormalisé + scoping via relations (`eventId.guestEmails`, `teamId.members`) | ✅ Fixé (migration `1700000040`) |
| Hooks JSVM (ES5+ défensif, Goja supporte ES6+) | Convention ES5+ dans les hooks, Goja supporte la plupart d'ES6 | — |
| Régression permissions                         | Tests systématiques des API rules                             | ✅ Vérifié (ghald, 9 collections) |
| **PB v0.37.5 `?=` cassé**                      | Workaround `~` (LIKE) sur toutes les API rules + filtres SDK  | ⚠️ Dette tech — voir section I |
| **`~` sur emails** (substring match)           | Risque faible pour outil interne. À revoir si PB fix ou migration vers collection relationnelle | ⚠️ À suivre |
| **Double-sérialisation JSON** (migration)      | Corriger `2-transform-data.ts` + re-importer                  | ⬜ À faire |
| **IDs Appwrite dans owner JSON**               | Ajouter remapping dans transform script + re-importer          | ⬜ À faire |

---

## Phase 2 — SvelteKit (tout CSR)

### Ce qui change

| Avant                      | Après                             |
| -------------------------- | --------------------------------- |
| `sv-router` (path-based)   | SvelteKit file-based routing      |
| `App.svelte` + `mount()`   | `+layout.svelte` + `+page.svelte` |
| `routes.ts` (31 routes)    | `src/routes/` (31 dossiers)       |
| `guards.ts`                | Layouts + `$effect` SvelteKit     |
| `navigate()`, `p('/path')` | `goto()`, chemins natifs          |
| Vite SPA build             | SvelteKit `adapter-node`          |

### Étapes

- [ ] **2.1** Installer SvelteKit + adapter-node
- [ ] **2.2** Générer la structure de routing (script TS + LLM)
- [ ] **2.3** Migrer les guards (auth → layout, event → page-level)
- [ ] **2.4** Migrer l'initialisation App.svelte → `+layout.svelte`
- [ ] **2.5** Adapter les imports navigation
- [ ] **2.6** Poser `ssr = false` sur toutes les routes
- [ ] **2.7** Dockerfile adapter-node
- [ ] **2.8** Tests des 31 routes

→ Voir `4_routing-sveltekit.md`

---

## Phase 3 — SSR sélectif (3 pages publiques)

### Ce qui change

| Avant                | Après                                    |
| -------------------- | ---------------------------------------- |
| Toutes les pages CSR | 3 pages SSR, reste CSR                   |
| Pas de SEO           | SEO sur `/`, `/recipe`, `/recipe/[uuid]` |
| Pas de cache serveur | Cache Node.js (`Map` en mémoire)         |
| Nginx                | adapter-node (process Node.js)           |

### Étapes

- [ ] **3.1** Cache serveur (`$lib/server/cache.ts`)
- [ ] **3.2** Client PB admin (`$lib/server/pb.ts`)
- [ ] **3.3** Server loads pour pages publiques
- [ ] **3.4** Retirer `ssr = false` des pages publiques
- [ ] **3.5** Transition guest → auth (pattern `$derived` fallback)
- [ ] **3.6** Hook d'authentification (`hooks.server.ts`)
- [ ] **3.7** Invalidation du cache après modification
- [ ] **3.8** SEO et métadonnées

→ Voir `5_ssr-architecture.md`

---

## Empreinte mémoire cible

| Composant                | RAM estimée      |
| ------------------------ | ---------------- |
| Dokploy                  | ~940 MiB         |
| Traefik                  | ~27 MiB          |
| SvelteKit (adapter-node) | ~80-150 MiB      |
| PocketBase               | ~20 MiB          |
| Stalwart (mail)          | ~127 MiB         |
| Cache serveur            | < 5 MiB          |
| **Total**                | **~1.2-1.3 GiB** |

vs actuel avec Appwrite : **~5.7 GiB**. Marge libérée : **~4.5 GiB**.

---

## Points de validation pour l'agent

Avant d'implémenter, l'agent doit vérifier dans la codebase :

1. **pb-sync** : lire `svelte-app/src/lib/db-sync/pb-collection.ts` pour le contrat API sync (normalisation supprimée, `stripSystemFields()` à la place)
2. **Type canonique** : `PbDoc` dans `svelte-app/src/lib/db-sync/aw-types.ts` — champs `id`, `created`, `updated`
3. **Stores migrés** : vérifier les imports dans `svelte-app/src/lib/stores/*.svelte.ts` — tous utilisent `pb-sync` + `PbDoc`
4. **Services PB** : lire `svelte-app/src/lib/services/pb-*.ts` pour les services spécifiques (pb-auth, pb-locks, pb-invitations)
5. **Hooks PB** : lire `pocketbase/pb_hooks/*.pb.js` pour les routes custom
6. **Routing** : lire `svelte-app/src/lib/router/routes.ts` et `guards.ts` pour la correspondance exacte (Phase 2)
7. **⚠️ Schéma PB — Source de vérité** : **TOUJOURS utiliser `svelte-app/src/lib/types/pb-generated.ts`** pour comprendre le schéma PB actuel. Les fichiers de migration (`pocketbase/pb_migrations/*.js`) sont un historique qui a connu des erreurs et corrections — ils ne reflètent pas fidèlement l'état final. Les types générés sont le reflet exact de la DB PB via `bun run generate-types`.
8. **Types générés** : `svelte-app/src/lib/types/pb-generated.ts` — auto-généré par `bun run generate-types`, NE PAS modifier manuellement
9. **Types métier** : `svelte-app/src/lib/types/appwrite.d.ts` — référence les types collections avec `PbDoc` (pas `Models.Row`)
10. **Notes materiel/materiel_loan** : Voir section H ci-dessus pour les spécificités de ces collections
