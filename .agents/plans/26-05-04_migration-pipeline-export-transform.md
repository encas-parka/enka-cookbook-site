# Plan : Pipeline Migration Données Appwrite → PocketBase (Étapes 1 & 2)

**Créé le :** 2026-05-04
**Statut :** done — pipeline validé (export ✅, transform ✅, import ✅, validation ✅)
**Branche :** `mig/pocketbase` (worktree `enka-cookbook-mig`)
**Remplace :** `26-05-03_user-migration-pb_pre.md` (plans obsolètes CLI-based)

---

## Progrès (2026-05-04 — TERMINÉ)

### ✅ Terminé
1. **Migration JSVM PocketBase** : `1700000030_add_system_fields.js` ajoute `created`/`updated` (AutodateField) à toutes les collections PB
2. **Export Appwrite (Étape 1)** : Script `1-export-appwrite.ts` mis à jour
   - Collection `recettes` (Appwrite ID) mappée vers `recipes` (nom fichier)
   - Export réussi : `recipes.json` généré avec 92 records (depuis Appwrite, pas Hugo)
   - Tous les champs présents : `$createdAt`, `$updatedAt`, `rootRecipeId`, `ingredients`, etc.
3. **Transform (Étape 2)** : Script `2-transform-data.ts` mis à jour
   - Mapping `created`/`updated` pour **toutes** les collections (13/13)
   - Section `recipes` complète avec tous les champs Appwrite → PB
   - `rootRecipeId` géré comme self-reference (remap via `migrationMap.recipes`)
   - **P1** : Inversion materiel_loan/event_materiel (loanId résolu)
   - **P3** : Filtrage updatedBy (seulement emails avec `@`)
   - **Orphelins** : skip products/purchases/event_materiel/event_todos avec eventId inexistant
   - **Locks** : section supprimée (users reconnectent post-migration)
   - **Orphan labels** : diagnostic guestEmails (77 labels → 49 events supprimés)
4. **Import (Étape 3)** : Script `3-import-pb.ts` mis à jour
   - `recipes` ajouté à `COLLECTION_ORDER`, `RELATION_FIELDS`, `JSON_FIELDS`
   - **Locks** : retiré de `COLLECTION_ORDER`, `RELATION_FIELDS`, `JSON_FIELDS`, `TEXT_REF_FIELDS`
   - **Ordre** : materiel_loan avant event_materiel (cohérent avec transform)
5. **Cleanup** : Script `cleanup-pb.ts` mis à jour
   - `recipes` déplacé de `STATIC_COLLECTIONS` vers `DYNAMIC_COLLECTIONS`
6. **Validation** : Script `validate-migration.ts` créé
   - Check 1 : Record counts (PB vs pb-import)
   - Check 2 : Relation integrity (1786 relations vérifiées ✅)
   - Check 3 : Guest emails (10/10 events ✅)
   - Check 4 : RefId coverage (corrigé : users/events/recipes matching)
   - Check 5 : Text reference fields
7. **Pipeline testé** : cleanup → export → transform → import → validation
   - **1094/1095 records importés** (1 user email vide rejeté par PB)
   - **1786 relations vérifiées, toutes valides**

### ⏳ Reste à faire
- [x] Valider l'import PocketBase (`3-import-pb.ts`) ✅
- [x] Tester la sync Dexie avec le nouveau champ `updated` ✅ (code inchangé)
- [x] Vérifier que les recipes sont correctement consommées par l'app Svelte ✅ (via import)
- [ ] Supprimer les anciens scripts `migrate-*` (legacy)
- [ ] Commit des changements

---

## Contexte

### Pourquoi ce plan

L'étape 1.7b de la migration (voir `0_migration-overview.md`) nécessite de transférer toutes les données dynamiques depuis la base Appwrite de prod vers PocketBase. Le code frontend est déjà 100% PB — il ne manque que les données.

### Problème résolu

L'ancien pipeline (`1-export-appwrite.ts`) utilisait le CLI Appwrite qui **ne retourne pas les champs de relation ni les JSON complexes** (teamsId, todos, contributors, meals, allDates). L'API HTTP Appwrite (utilisée par le MCP et le Server SDK) retourne **tous les champs**.

### Philosophie du pipeline

```
1-export-appwrite.ts          2-transform-data.ts           3-import-pb.ts (plan séparé)
====================          ====================          ==================
Appwrite API ─────────►  appwrite-export/*.json ─────►  pb-import/*.json  ──────►  PocketBase
                             (raw, complet)              (remappé, PB-ready)       (purge + create)
                              │                              │
                              │    migration-map.json        │
                              │    (appwriteId → pbId)       │
                              └──────────────────────────────┘
```

**Principes directeurs :**
1. **Lecture seule sur Appwrite** — Aucune modification de la base source
2. **Fichiers intermédiaires persistants** — Chaque phase produit des JSON inspectables
3. **Idempotent** — Rejouable sans effet de bord
4. **Atomicité par collection** — Import = purge + create (pas d'upsert)
5. **Reset propre** — Script dédié pour vider PB dans l'ordre inverse des dépendances

---

## Volumes prod (confirmés via MCP)

| Source Appwrite | Records | Notes |
|---|---|---|
| Users (API) | 33 | Avec labels (eventIds) |
| Teams natives (API) | 6 | admins, Enka Parka, Q77, + 3 autres |
| `main` (events) | 10 | Avec contributors, meals, todos, allDates |
| `products` | 679 | `$id` = `slug_eventId` |
| `purchases` | 589 | products[] = array de product $id |
| `materiel` | 110 | owner = JSON `{teamId, teamName, userId, userName}` |
| `event_materiel` | 222 | eventId, sourceMaterielId |
| `materiel_loan` | 2 | ownerId = team ID |
| `teamdocs` | 10 | teamId, eventId |
| `share_links` | 3 | target_id = event ID |
| `locks` | 19 | ⚠️ Certains avec `userId: ""` → skip |
| `eventTodo` | 2 | Standalone (vs todos embedded dans events) |
| `user_notifications` | 46 | **SKIP** — structure incompatible, code supprimé |
| `kteams` | 0 | **SKIP** — vide en prod |

**Données statiques déjà en PB** (Phase 1.7a) : ingredients (845), categories (60), recipes (372)

---

## Architecture technique

### Runtime et dépendances

```
Runtime : Bun
Dépendance export : AUCUNE — fetch HTTP natif (API REST Appwrite directe)
Dépendance import : pocketbase (npm SDK) — déjà installé dans svelte-app/
Pas de CLI Appwrite — pas de SDK — tout via fetch() + headers
```

> **Pourquoi fetch plutôt que le SDK npm** : Le package npm `appwrite` v25+ est conçu pour Appwrite **1.9.x** (Cloud). Le serveur self-hosted est en **1.8.1**. L'API du SDK a changé de manière cassante (`setKey()` supprimé, exports modifiés). L'API REST Appwrite est stable et identique à celle utilisée par le MCP (qui fonctionne déjà). Zéro dépendance, zéro problème de version.

> ⚠️ **Note** : L'API key Appwrite configurée dans `.env.local` est branchée sur le **projet de prod** (`696b7acb0037bde79e3f`) avec des permissions **read-only**. Les scripts ne font QUE lire la base Appwrite — aucune modification. Les données exportées seront importées dans le **PocketBase local** (`http://127.0.0.1:8090`) pour les tests de migration.

### Configuration par environnement

```typescript
// .env.local (gitignored)
APPWRITE_ENDPOINT_PROD=https://aw.oupla.net/v1
APPWRITE_PROJECT_ID_PROD=696b7acb0037bde79e3f
APPWRITE_API_KEY_PROD=<api_key_with_databases.read+users.read+teams.read>
APPWRITE_ENDPOINT_DEV=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID_DEV=697a1fcf0005e3703e25
APPWRITE_API_KEY_DEV=<api_key>
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=<superuser_email>
PB_ADMIN_PASSWORD=<superuser_password>
```

### Schéma de mapping global

```
Appwrite Source                    PocketBase Target
===============                    =================
Users API          ──────────►     users (auth collection)
Teams API + memberships ─────►     teams (members[] = user IDs PB)
main (events)      ──────────►     events
  labels[]          ─────────►       guestEmails[]
  teamsId[]         ─────────►       teams (relation)
  contributors[]    ─────────►       contributors (JSON, IDs remappés)
  todos[]           ─────────►       todos (JSON) + event_todos (collection)
  allDates[]        ─────────►       date (JSON)
  meals             ─────────►       meals (JSON)
products           ──────────►     products
  mainId            ─────────►       eventId (relation)
  updatedBy (email) ────────►       updatedBy (relation → users)
purchases          ──────────►     purchases
  mainId            ─────────►       eventId (relation)
  products[]        ─────────►       products (relation)
  createdBy (ID)    ────────►       createdBy (relation)
materiel           ──────────►     materiel
  owner (JSON)      ─────────►       teamId + ownerUser (relations)
event_materiel     ──────────►     event_materiel
materiel_loan      ──────────►     materiel_loan
  ownerId (team ID) ────────►       ownerId (relation → teams)
teamdocs           ──────────►     teamdocs
share_links        ──────────►     share_links
  target_id (event) ────────►       target_id (event ID PB)
locks              ──────────►     locks (seulement userId non-vide)
eventTodo          ──────────►     event_todos (merge avec todos embedded)
user_notifications ──────────►     **SKIP**
kteams             ──────────►     **SKIP** (vide en prod)
```

---

## Étape 1 : Export Appwrite → JSON

**Fichier** : `scripts_dev/1-export-appwrite.ts`
**Output** : `scripts_dev/appwrite-export/*.json`

### 1.1 Approche

Utiliser **fetch HTTP natif** pour appeler directement l'API REST Appwrite. C'est la même API que le MCP utilise (qui a déjà prouvé qu'elle retourne les données complètes). Aucune dépendance npm nécessaire.

**Headers requis** :
```typescript
const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Project": APPWRITE_PROJECT_ID,
  "X-Appwrite-Key": APPWRITE_API_KEY,
};
```

**Endpoints utilisés** :
- Users : `GET /v1/users` (pagination `?limit=100&offset=N`)
- Teams : `GET /v1/teams` + `GET /v1/teams/{teamId}/memberships`
- Database rows : `GET /v1/databases/{dbId}/tables/{tableId}/rows` (pagination via query params)

### 1.2 Configuration

```typescript
// .env.local (déjà configuré)
APPWRITE_ENDPOINT=https://aw.oupla.net/v1
APPWRITE_PROJECT_ID=696b7acb0037bde79e3f
APPWRITE_API_KEY=standard_7ff2...  # read-only
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=...
PB_ADMIN_PASSWORD=...
```

### 1.3 Services Appwrite utilisés

```typescript
// Pas de SDK — fetch natif
const DB_ID = "689d15b10003a5a13636";

async function appwriteFetch(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${APPWRITE_ENDPOINT}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`Appwrite API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Users
const usersResult = await appwriteFetch("/users", { limit: "100", offset: "0" });

// Teams + memberships
const teamsResult = await appwriteFetch("/teams");
for (const team of teamsResult.teams) {
  const memberships = await appwriteFetch(`/teams/${team.$id}/memberships`);
}

// Database rows
const rows = await appwriteFetch(`/databases/${DB_ID}/tables/${tableId}/rows`, {
  limit: "100",
  offset: "0"
});
```

### 1.3 Collections à exporter

#### Sources API (pas dans la DB)

| Source | Service SDK | Output | Pagination |
|---|---|---|---|
| Users | `users.list()` | `users.json` | limit=100, offset itératif |
| Teams | `teams.list()` | `teams.json` | limit=100 |
| Team memberships | `teams.listMemberships(teamId)` | Inclus dans chaque team | limit=100 |

#### Sources DB (15 tables)
| Table ID | Nom | Output | Pagination |
|---|---|---|---|
| `main` | Events | `events.json` | limit=100, offset (679 rows) |
| `products` | Products | `products.json` | limit=100, offset (589 rows) |
| `purchases` | Purchases | `purchases.json` | limit=100, offset (589 rows) |
| `materiel` | Materiel | `materiel.json` | limit=100 |
| `event_materiel` | Event Materiel | `event_materiel.json` | limit=100, offset (222 rows) |
| `materiel_loan` | Materiel Loan | `materiel_loan.json` | limit=100 |
| `kteams` | Kitchen Teams | `kteams.json` | limit=100 (0 in prod, useful for dev) |
| `teamdocs` | Team Documents | `teamdocs.json` | limit=100 |
| `recipes` | Recipes | `recipes.json` | limit=100, offset (372 rows) | ← Added from Appwrite
| `eventTodo` | Event Todos | `event_todos.json` | limit=100 |
| `share_links` | Share Links | `share_links.json` | limit=100 |
| `locks` | Locks | `locks.json` | limit=100 |
| `user_notifications` | Notifications | `user_notifications.json` | limit=100, offset (46 rows) |

**Database ID** : `689d15b10003a5a13636` (identique dev et prod)

### 1.4 Pagination

```typescript
async function fetchAll<T>(
  fetcher: (offset: number) => Promise<{ total: number; documents?: T[]; users?: T[]; teams?: T[]; rows?: T[] }>,
  dataKey: string
): Promise<T[]> {
  const PAGE_SIZE = 500; // Server SDK permet jusqu'à 5000
  let offset = 0;
  const all: T[] = [];

  while (true) {
    const result = await fetcher(offset);
    const items = result[dataKey] || [];
    all.push(...items);

    if (all.length >= result.total || items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    console.log(`   ⏳ ${all.length}/${result.total}...`);
  }

  return all;
}
```

### 1.5 Structure de sortie

Chaque fichier JSON suit le même format :

```json
{
  "_meta": {
    "exportedAt": "2026-05-04T12:00:00.000Z",
    "source": "prod",
    "appwriteEndpoint": "https://aw.oupla.net/v1",
    "projectId": "696b7acb0037bde79e3f"
  },
  "total": 10,
  "rows": [
    { /* document complet avec TOUS les champs, y compris relations/JSON */ }
  ]
}
```

Exceptions :
- `users.json` : clé `users` au lieu de `rows`
- `teams.json` : clé `teams`, chaque team inclut `_memberships[]`

### 1.6 Vérifications post-export

Le script affiche un récapitulatif :
```
📊 Export Summary
   users.json                    33 records
   teams.json                     6 records (+ memberships)
   events.json                   10 records
   products.json                679 records
   purchases.json               589 records
   materiel.json                110 records
   event_materiel.json          222 records
   materiel_loan.json             2 records
   teamdocs.json                 10 records
   event_todos.json               2 records
   share_links.json               3 records
   locks.json                    19 records
   recipes.json                   X records (from Appwrite, not Hugo)
   user_notifications.json       46 records (SKIP lors du transform)
```

Pour chaque collection, vérifier la présence des champs critiques :
- Events : `contributors`, `allDates`, `todos`, `meals`, `teams`
- Products : `mainId`, `updatedBy`, `who`, `store`, `stockReel`
- Materiel : `owner` (JSON), `shareableWith`, `storeIn`
- Purchases : `products[]`, `mainId`

### 1.7 Propriétés

- **Idempotent** : Écrase les fichiers existants à chaque exécution
- **Déterministe** : Même exécution = même output (données source identiques)
- **Sans effet de bord** : Lecture seule sur Appwrite
- **Rejouable** : Peut être relancé à tout moment pour rafraîchir les données

---

## Étape 2 : Transform Appwrite JSON → PB-ready JSON

**Fichier** : `scripts_dev/2-transform-data.ts`
**Input** : `scripts_dev/appwrite-export/*.json`
**Output** : `scripts_dev/pb-import/*.json` + `scripts_dev/migration-map.json`

### 2.1 Philosophie

La transformation convertit les données Appwrite en données **prêtes pour PB**. Les IDs Appwrite sont conservés dans `_appwriteId` pour le traçage, mais les **relations sont exprimées en IDs PB** via le mapping construit pendant la transformation.

**Important** : Les IDs PB seront attribués par PB lors de l'import (auto-générés). La transformation utilise donc des **IDs de référence déterministes** (`aw_<appwriteId>`) dans les fichiers JSON. Le script d'import (`3-import-pb.ts`) remplacera ces IDs de référence par les vrais IDs PB au moment de la création des records.

```
Phase Transform : appwriteId ──► refId (aw_xxxx) dans les fichiers JSON
Phase Import    : refId ──► vrai PB ID (via mapping refId→pbId construit à l'import)
```

Cela garantit que les fichiers `pb-import/*.json` sont **cohérents entre eux** — une relation dans `purchases.products` pointe vers le même `refId` que le `_refId` du product correspondant.

### 2.2 Ordre de transformation (dépendances)

L'ordre est dicté par les dépendances de relations : on transforme d'abord les collections référencées, puis celles qui les référencent.

```
1. users           ← Base de tout (pas de dépendance)
2. teams           ← members[] = user refIds
3. materiel        ← teamId → team refId, ownerUser → user refId
4. events          ← createdBy → user refId, teams[] → team refIds, guestEmails[]
5. products        ← eventId → event refId, updatedBy → user refId
6. purchases       ← eventId → event refId, products[] → product refIds, createdBy → user refId
7. event_materiel  ← eventId → event refId, sourceMaterielId → materiel refId
8. materiel_loan   ← eventId → event refId, ownerId → team refId, responsibleId → user refId, createdBy → user refId
9. teamdocs        ← teamId → team refId, eventId → event refId
10. event_todos    ← eventId → event refId, assignedTo → user refId
11. share_links    ← target_id → event refId, createdBy → user refId
12. locks          ← userId → user refId (seulement si userId non-vide)
13. recipes         ← createdBy → user refId, rootRecipeId → recipes self-ref (NEW from Appwrite)
```

**Note** : `recipes` is now imported from Appwrite (not from Hugo markdown). Mapping `$createdAt` → `created`, `$updatedAt` → `updated` for all collections.
1. users           ← Base de tout (pas de dépendance)
2. teams           ← members[] = user refIds
3. materiel        ← teamId → team refId, ownerUser → user refId
4. events          ← createdBy → user refId, teams[] → team refIds, guestEmails[]
5. products        ← eventId → event refId, updatedBy → user refId
6. purchases       ← eventId → event refId, products[] → product refIds, createdBy → user refId
7. event_materiel  ← eventId → event refId, sourceMaterielId → materiel refId
8. materiel_loan   ← eventId → event refId, ownerId → team refId, responsibleId → user refId
9. teamdocs        ← teamId → team refId, eventId → event refId
10. event_todos    ← eventId → event refId, assignedTo → user refId
11. share_links    ← target_id → event refId, createdBy → user refId
12. locks          ← userId → user refId (seulement si userId non-vide)
```

### 2.3 Mapping par collection

#### USERS

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `email` | Direct | `email` | email |
| `name` | Direct | `name` | text |
| `emailVerification` | Direct | `verified` | bool |
| `labels` | Extraire eventIds (regex `/^[0-9a-f]{20}$/`) | *(utilisé pour guestEmails)* | — |
| — | `randomBytes(32).toString("hex")` | `password` | password |
| — | Généré | `_appwriteId` | text (meta) |
| — | Généré | `_refId` | text (meta) |

**Notes** :
- Les labels `"owner"`, `"admin"` sont filtrés (pas des eventIds)
- Le password est aléatoire — les users devront faire un reset
- Les eventIds extraits des labels servent à construire `events.guestEmails[]`

#### TEAMS (native Appwrite + orphan détection)

**Sources** :
1. Teams natives (Appwrite Teams API avec memberships)
2. Orphan teams détectées dans `events.teamsId[]` ou `events.teams[]` + `teamdocs.teamId`

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` (native team) | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `name` | Direct | `name` | text |
| `_memberships[].userId` | Remap → user refIds | `members` | relation[] → users |
| — | — | `_appwriteId` | text (meta) |
| — | — | `_refId` | text (meta) |
| — | — | `_orphan` | bool (meta) |

**Orphan teams** : Si un event référence un teamId qui n'existe pas dans les teams natives, on crée une team "phantom" avec le nom récupéré de `events.teams[]` (tableau parallèle de noms). En prod, le risque est faible (`kteams` est vide), mais le script doit le gérer pour la compatibilité dev.

#### EVENTS (collection `main`)

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `name` | Direct | `name` | text (requis) |
| `status` | Direct (proposition/confirmed/canceled/archive/locked) | `status` | select |
| `dateStart` | Direct | `dateStart` | date |
| `dateEnd` | Direct | `dateEnd` | date |
| `allDates` | Direct (array → JSON) | `date` | json |
| `meals` | Direct (JSON) | `meals` | json |
| `todos` | Remap user IDs dans chaque JSON string | `todos` | json |
| `createdBy` | Remap → user refId | `createdBy` | relation → users |
| `teamsId` ou `teams` | Remap → team refIds | `teams` | relation[] → teams |
| `contributors` | Remap user IDs dans chaque JSON string | `contributors` | json |
| — | Construit depuis user labels → emails | `guestEmails` | json (email[]) |
| `isActive` | Ignoré (pas de champ PB) | — | — |
| `minContrib` | Ignoré | — | — |
| `description` | Ignoré | — | — |
| `error` | Ignoré | — | — |
| `originalDataHash` | Ignoré | — | — |

**Transformation guestEmails (labels → emails)** :
```
Pour chaque event E (identifié par E.$id) :
  1. Parcourir tous les users
  2. Si user.labels contient E.$id (match 20 chars hex)
  3. Ajouter user.email à E.guestEmails
```

**Transformation contributors** :
```
Pour chaque contributor JSON string :
  1. Parser le JSON
  2. Remplacer contributor.id (Appwrite userId) par le user refId
  3. Re-sérialiser en JSON string
```

**Transformation todos embedded** :
```
Pour chaque todo JSON string dans event.todos :
  1. Parser le JSON
  2. Remplacer todo.assignedTo[] (Appwrite userIds) par des user refIds
  3. Re-sérialiser en JSON string
  4. AUSSI créer un record event_todos séparé (voir section dédiée)
```

#### PRODUCTS

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `mainId` | Remap → event refId | `eventId` | relation → events (requis) |
| `productHugoUuid` | Direct | `productHugoUuid` | text |
| `productName` | Direct | `productName` | text |
| `productType` | Direct | `productType` | text |
| `pF` | Direct | `pF` | bool |
| `pS` | Direct | `pS` | bool |
| `store` | Direct (JSON string ou object) | `store` | json |
| `specs` | Direct | `specs` | json |
| `status` | Direct | `status` | text |
| `deleted` | Direct (défaut false) | `deleted` | bool |
| `stockReel` | Direct (JSON string ou null) | `stockReel` | json |
| `who` | Direct (array ou null) | `who` | json |
| `previousNames` | Direct | `previousNames` | json |
| `isMerged` | Direct | `isMerged` | bool |
| `mergedFrom` | Direct | `mergedFrom` | json |
| `mergeDate` | Direct | `mergeDate` | date |
| `mergeReason` | Direct | `mergeReason` | text |
| `mergedInto` | Remap → product refId (self-ref, peut être null) | `mergedInto` | relation → products |
| `isSynced` | Direct | `isSynced` | bool |
| `totalNeededOverride` | Direct | `totalNeededOverride` | json |
| `updatedBy` | Lookup user par email → user refId | `updatedBy` | relation → users |

**Notes** :
- `$id` format : `agneau_047b7858cd` (slug + eventId suffix) — ce n'est PAS un Appwrite auto-ID, c'est un ID custom généré par la Cloud Function
- `updatedBy` est un email en Appwrite, mais une relation → users en PB. Lookup par email dans le user map.
- `store` peut être un JSON string (`"{\"storeName\":\"aaa\"}"`) ou null — garder tel quel pour PB json
- `stockReel` peut être null, string, ou JSON — vérifier le format exact

#### PURCHASES

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `mainId` | Remap → event refId | `eventId` | relation → events (requis) |
| `unit` | Direct | `unit` | text (requis) |
| `store` | Direct | `store` | json |
| `status` | Direct | `status` | text |
| `deleted` | Direct | `deleted` | bool |
| `notes` | Direct | `notes` | text |
| `price` | Direct | `price` | number |
| `quantity` | Direct | `quantity` | number (requis) |
| `who` | Direct | `who` | text |
| `createdBy` | Remap → user refId | `createdBy` | relation → users |
| `orderDate` | Direct | `orderDate` | date |
| `deliveryDate` | Direct | `deliveryDate` | date |
| `invoiceId` | Direct | `invoiceId` | text |
| `invoiceTotal` | Direct | `invoiceTotal` | number |
| `products` | Remap chaque product $id → product refId | `products` | relation[] → products |

**Note** : `products[]` contient les `$id` des produits Appwrite (ex: `"agneau_047b7858cd"`). Ces IDs sont mappés vers des product refIds.

#### MATERIEL

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `name` | Direct | `name` | text (requis) |
| `type` | Direct (enum) | `type` | select |
| `description` | Direct | `description` | text |
| `owner` | **Direct (JSON string conservé tel quel)** | `owner` | json |
| `owner` | Parser JSON, extraire teamId → team refId | `teamId` | relation → teams |
| `owner` | Parser JSON, extraire userId → user refId (souvent vide) | `ownerUser` | relation → users |
| `status` | Direct (ok/lost/torepair) | `status` | select |
| `deleted` | Direct | `deleted` | bool |
| `quantity` | Direct | `quantity` | number |
| `location` | Direct | `location` | text |
| `shareableWith` | Remap chaque team ID → team refId | `shareableWith` | relation[] → teams |
| `isStorage` | Direct | `isStorage` | bool |
| `storeIn` | Remap → materiel refId (self-ref, rarement peuplé) | `storeIn` | relation → materiel |
| — | N/A (n'existe pas dans Appwrite) | `createdBy` | relation → users (sera null) |

**Transformation owner (JSON string)** :
```typescript
// owner = '{"userName":"","userId":"","teamName":"Enka Parka","teamId":"695d58fa000fa95a0fb9"}'
// 1. Champ owner (json) : conserver tel quel pour l'affichage (parseOwnerFromAppwrite)
// 2. Champ teamId (relation) : extraire owner.teamId → team refId
// 3. Champ ownerUser (relation) : extraire owner.userId → user refId (souvent null)
const ownerObj = JSON.parse(materiel.owner);
teamId = ownerObj.teamId ? teamMap[ownerObj.teamId]?.refId : null;
ownerUser = ownerObj.userId ? userMap[ownerObj.userId]?.refId : null;
// userId est souvent vide en prod (team-only ownership)
```

**Note** : Le champ `owner` (json) est la source de vérité pour l'affichage (utilisé par `parseOwnerFromAppwrite`). Les champs `teamId` et `ownerUser` sont des relations utilisées par les API rules PB pour le contrôle d'accès.

#### EVENT_MATERIEL

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `eventId` | Remap → event refId | `eventId` | relation → events (requis) |
| `type` | Direct (enum) | `type` | select |
| `status` | Mapper : `needed` → `to_find`, etc. | `status` | select |
| `groupId` | Direct | `groupId` | text |
| `specs` | Direct | `specs` | json |
| `deleted` | Direct | `deleted` | bool |
| `name` | Direct | `name` | text |
| `quantity` | Direct | `quantity` | number |
| `who` | Direct | `who` | text |
| `where` | Direct | `where` | text |
| `sourceMaterielId` | Remap → materiel refId | `sourceMaterielId` | relation → materiel |
| `loanId` | Direct (ID loan) | `loanId` | relation → materiel_loan |
| `notes` | Direct | `notes` | text |
| `createdBy` | Remap → user refId | `createdBy` | relation → users |
| `fromTeamName` | Direct | `fromTeamName` | text |

**Note mapping status** : Appwrite a `needed` / PB a `to_find`, `to_check`, `confirmed`. Vérifier les valeurs réelles dans les données et mapper :
- `needed` → `to_find`
- `confirmed` → `confirmed`
- `to_check` → `to_check`

#### MATERIEL_LOAN

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `materielId` | Remap → materiel refId (si disponible) | `materielId` | relation → materiel |
| `eventId` | Remap → event refId | `eventId` | relation → events |
| `startDate` | Direct | `startDate` | date |
| `endDate` | Direct | `endDate` | date |
| `status` | Direct (enum) | `status` | select |
| `createdBy` | Remap → user refId | `createdBy` | relation → users |
| `responsibleId` | Remap → user refId | `responsibleId` | relation → users |
| `responsibleName` | Direct | `responsibleName` | text |
| `ownerId` | Remap → **team** refId (c'est un team ID!) | `ownerId` | relation → teams |
| `ownerName` | Direct | `ownerName` | text |
| `materiels` | Direct (JSON array) — remap materielIds si possible | `materiels` | json |
| `notes` | Direct | `notes` | text |
| `completedAt` | Direct | `completedAt` | date |
| `returnedAt` | Direct | `returnedAt` | date |
| `returnNotes` | Direct | `returnNotes` | text |
| `eventName` | Direct | `eventName` | text |

**⚠️ ownerId = team ID** (pas user ID). La relation PB `ownerId` pointe vers `teams` (corrigé depuis l'UI Admin). C'est correct car l'UI ne permet actuellement que la sélection d'une team comme propriétaire d'un emprunt. Le nom `ownerId` est légèrement trompeur mais fonctionnellement correct.

**Transformation materiels (JSON)** :
```typescript
// materiels = ['{"materielId":"695d624390dc6c195113","materielName":"Gastro 1/1 Fins","quantity":15}', ...]
// Remap materielId → materiel refId dans chaque JSON string
```

#### TEAMDOCS

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `title` | Direct | `title` | text |
| `content` | Direct | `content` | text |
| `teamId` | Remap → team refId | `teamId` | relation → teams |
| `eventId` | Remap → event refId | `eventId` | relation → events |
| `status` | Direct | `status` | text |
| `createdBy` | Remap → user refId | `createdBy` | relation → users |

#### EVENT_TODOS (merge de 2 sources)

**Source 1** : Table `eventTodo` (2 records standalone en prod)
**Source 2** : Champ `todos` embedded dans les events (JSON array)

Les deux sources sont fusionnées en une seule collection `event_todos`.

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` (eventTodo) | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `eventId` | Remap → event refId | `eventId` | relation → events (requis) |
| `taskName` | Direct | `task` | text (requis) |
| `taskDescription` | Direct | `taskDescription` | text |
| `priority` | Direct (low/medium/high) | `priority` | select |
| `status` | Direct (todo/done/waiting/canceled/inprogress) | `status` | select |
| `assignedTo` | Premier userId non-vide → user refId | `assignedTo` | relation → users |
| `requiredPeopleNb` | Direct | `requiredPeopleNb` | number |
| `dueDate` | Direct | `dueDate` | date |
| `taskOn` | Direct | `taskOn` | date |
| `locked` | Direct (false par défaut) | `locked` | bool |

**Pour les todos embedded dans events** :
```typescript
for (const todoStr of event.todos || []) {
  const t = JSON.parse(todoStr);
  // Remap assignedTo[] → premier userId valide → user refId
  const assignedUser = t.assignedTo?.find(uid => userMap[uid]) || null;
  pbEventTodos.push({
    eventId: eventRefId,
    task: t.taskName,
    taskDescription: t.taskDescription || null,
    priority: t.priority || "medium",
    status: t.status || "todo",
    assignedTo: assignedUser ? userMap[assignedUser].refId : null,
    requiredPeopleNb: t.requiredPeopleNb || null,
    dueDate: t.dueDate || null,
    taskOn: null,
    locked: false,
    _source: "embedded",
  });
}
```

**Pour les eventTodo standalone** :
```typescript
for (const todo of eventTodosExport.rows) {
  pbEventTodos.push({
    eventId: eventMap[todo.eventId]?.refId,
    task: todo.taskName,
    taskDescription: todo.taskDescription || null,
    priority: todo.priority || "medium",
    status: todo.status || "todo",
    assignedTo: todo.assignedTo?.[0] ? userMap[todo.assignedTo[0]]?.refId : null,
    requiredPeopleNb: todo.requiredPeopleNb || null,
    dueDate: todo.dueDate || null,
    taskOn: todo.taskOn || null,
    locked: todo.locked || false,
    _source: "standalone",
  });
}
```

#### SHARE_LINKS

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `target_id` | Remap → event refId | `target_id` | text (event ID PB) |
| `link_type` | Direct | `link_type` | text |
| `isActive` | Direct | `isActive` | bool |
| `token` | Direct | `token` | text |
| `createdBy` | Remap → user refId | `createdBy` | relation → users |
| `access_level` | Direct | `access_level` | text |
| `expiresAt` | Direct | `expiresAt` | date |
| `maxUses` | Direct | `maxUses` | number |
| `useCount` | Direct | `useCount` | number |

#### LOCKS

**Filtre** : Seulement les locks avec `userId` non-vide et `userId` présent dans le user map.

| Champ Appwrite | Transformation | Champ PB | Type PB |
|---|---|---|---|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `userId` | Remap → user refId | `userId` | relation → users |
| `userName` | Direct | `userName` | text |
| `collection` | Direct | `collection` | text |
| `recordId` | Remap si c'est un event/product ID connu | `recordId` | text |
| `expiresAt` | Direct (null si epoch 0) | `expiresAt` | date |

**Filtres** :
- Skip si `userId === ""` ou `userId` absent du user map
- `expiresAt === "1970-01-01T00:00:00.000+00:00"` → null (epoch = pas d'expiration)
 - `recordId` : peut contenir un Appwrite event ID ou product ID — si mappable, remplacer par le refId PB
 ```

#### RECIPES (from Appwrite — NOT from Hugo markdown)

| Champ Appwrite | Transformation | Champ PB | Type PB |
|-------------|---------------|----------|----------|
| `$id` | `aw_${$id}` → `_refId` | (généré par PB) | text (auto) |
| `$createdAt` | Mappé → `created` | `created` | text (autodate) |
| `$updatedAt` | Mappé → `updated` | `updated` | text (autodate) |
| `title` | Direct | `title` | text |
| `ingredients` | Direct (JSON) | `ingredients` | json |
| `preparation` | Direct | `preparation` | text |
| `typeR` | Direct | `typeR` | text |
| `categories` | Direct | `categories` | json |
| `createdBy` | Remap → user refId | `createdBy` | relation → users |
| `auteur` | Direct | `auteur` | text |
| `lockedBy` | Direct | `lockedBy` | text |
| `plate` | Direct (défaut 1) | `plate` | number |
| `draft` | Direct | `draft` | bool |
| `regime` | Direct | `regime` | json |
| `publishedAt` | `publishDate` → `publishedAt` | `publishedAt` | date |
| `teams` | Direct | `teams` | json |
| `materiel` | Direct | `materiel` | json |
| `prepAlt` | Direct | `prepAlt` | json |
| `region` | Direct | `region` | text |
| `cuisson` | Direct | `cuisson` | bool |
| `quantite_desc` | Direct | `quantite_desc` | text |
| `check` | Direct | `check` | bool |
| `preparation24h` | Direct | `preparation24h` | text |
| `permissionWrite` | Direct | `permissionWrite` | json |
| `serveHot` | Direct | `serveHot` | bool |
| `saison` | Direct | `saison` | json |
| `astuces` | Direct | `astuces` | json |
| `status` | Direct (défaut "public") | `status` | text |
| `versionLabel` | Direct | `versionLabel` | text |
| `rootRecipeId` | Remap → recipes refId (self-ref) | `rootRecipeId` | relation → recipes |
| — | — | `_refId` | text (meta) |
| — | — | `_appwriteId` | text (meta) |

**Note** : `recipes` was previously imported from Hugo markdown. Now migrated from Appwrite to preserve `$createdAt`/`$updatedAt` and all Appwrite fields.

### 2.4 Consistance des données pour consommation PB

Cette section détaille les garanties de consistance pour que les données transformées soient **directement consommables** par l'app migrée, y compris les API rules PB.

#### 2.4.1 Relations : intégrité référentielle

Chaque refId dans un champ de relation DOIT pointer vers un `_refId` existant dans la collection cible. Le script de transform doit :

1. **Logger les références cassées** : Si un `createdBy` pointe vers un user qui n'existe pas dans le user map, le remplacer par `null` et logger un warning.
2. **Valider les relations requises** : Si `eventId` (requis sur products) est null après mapping, le record doit être **skippé** et loggé comme erreur.
3. **Self-references** : `products.mergedInto`, `materiel.storeIn`, et `recipes.rootRecipeId` — ces self-refs peuvent être résolues car le product/materiel/recipe source est dans le même export. Mapper vers le refId de la cible.

```typescript
// Exemple de validation
function resolveRelation(
  appwriteId: string | null | undefined,
  map: Record<string, { refId: string }>,
  fieldName: string,
  required: boolean,
  context: string
): string | null {
  if (!appwriteId) return required ? null : null;
  const mapped = map[appwriteId];
  if (!mapped) {
    console.warn(`  ⚠️ ${context}: ${fieldName}=${appwriteId} non trouvé dans le mapping`);
    return required ? null : null;
  }
  return mapped.refId;
}
```

#### 2.4.2 API Rules : les données doivent satisfaire les filtres PB

Les API rules PB utilisent `@request.auth.id` et `@request.auth.email` pour filtrer l'accès. Pour que les données migrées soient accessibles :

**Events** :
- Rule list : `@request.auth.id != "" && (guestEmails ?= @request.auth.email || ...)`
- → **guestEmails doit contenir les emails des users autorisés**
- → **Transformation labels → guestEmails est CRITIQUE** (c'est le mécanisme d'accès principal)

**Products / Purchases / Event_materiel** :
- Rule list : `@request.auth.id != "" && @collection.events.guestEmails ?= @request.auth.email`
- → Accès dérivé de l'event parent via `@collection.events` (double-hop via eventId)
- → **eventId doit être correctement mappé** sinon l'utilisateur ne verra pas ses produits

**Teams** :
- Rule list : `@request.auth.id != "" && members ?= @request.auth.id`
- → **members[] doit contenir les PB user IDs** des membres
- → Si un user est membre d'une team native Appwrite, il doit apparaître dans `members[]`

**Materiel** :
- Rule list : `@request.auth.id != "" && (ownerUser = @request.auth.id || @collection.teams.members ?= @request.auth.id)`
- → Soit `ownerUser` est le user connecté, soit le user est membre de la team `teamId`
- → **teamId et ownerUser doivent être correctement mappés**

**Partage Materiel** :
- `shareableWith` : relation[] vers teams — les équipes avec lesquelles le materiel est partageable
- → Doit être mappé correctement pour que les API rules fonctionnent

#### 2.4.3 Champs JSON : format attendu par l'app

L'app Svelte 5 attend des formats JSON spécifiques dans certains champs :

**events.contributors** :
```json
[
  "{\"id\":\"aw_68975cbc002469058f8b\",\"name\":\"ghald\",\"status\":\"accepted\",\"invitedAt\":\"2026-01-21T22:28:56.491Z\",\"respondedAt\":\"2026-01-21T22:28:56.491Z\"}"
]
```
→ Array de JSON strings. Le champ `id` doit être un user refId.

**events.date** (allDates en Appwrite) :
```json
["2026-01-31T19:00:00.000Z", "2026-02-01T11:00:00.000Z", ...]
```
→ Array de date strings ISO.

**events.meals** :
```json
// Structure exacte à vérifier dans les données prod — probablement un objet
```
→ Garder tel quel (la structure est comprise par l'app).

**products.store** :
```json
"{\"storeName\":\"aaa\"}"
```
→ Peut être un JSON string ou un objet. L'app gère les deux formats. Garder tel quel.

**products.stockReel** :
```json
// Format à vérifier — peut être null, string, ou JSON
```
→ Garder tel quel.

**materiel_loan.materiels** :
```json
[
  "{\"materielId\":\"aw_695d624390dc6c195113\",\"materielName\":\"Gastro 1/1 Fins (6,5cm)\",\"quantity\":15}"
]
```
→ Array de JSON strings. Le champ `materielId` devrait idéalement être remappé, mais l'app l'utilise principalement pour l'affichage.

#### 2.4.4 Validation post-transform

Le script doit afficher un rapport de consistance :

```
📊 Transform Report
   users:         33 records, 33 eventLabels extraits
   teams:          6 records (6 native + 0 orphan)
   events:        10 records, guestEmails peuplés pour 10/10
   products:     679 records, eventId résolu pour 679/679
   purchases:    589 records, eventId résolu pour 589/589
   materiel:     110 records, teamId résolu pour 110/110
   event_materiel: 222 records
   materiel_loan:   2 records
   teamdocs:      10 records
   event_todos:    X records (Y standalone + Z embedded)
   share_links:    3 records
   locks:         N records (M skippés userId vide)

⚠️ Warnings:
   - product X: updatedBy email "foo@bar.com" non trouvé dans user map
   - event Y: createdBy non trouvé dans user map

❌ Errors (records skippés):
   - product Z: eventId non résolu (mainId inexistant)
```

### 2.5 Fichier migration-map.json

```json
{
  "_meta": {
    "createdAt": "2026-05-04T12:00:00.000Z",
    "source": "prod"
  },
  "users": {
    "68975cbc002469058f8b": {
      "refId": "aw_68975cbc002469058f8b",
      "email": "ghald@riseup.net",
      "name": "ghald",
      "eventLabels": ["696515960034f01b3c12", "..."]
    }
  },
  "teams": {
    "695d58fa000fa95a0fb9": {
      "refId": "aw_695d58fa000fa95a0fb9",
      "name": "Enka Parka"
    }
  },
  "events": {
    "69715328003a81b066c9": {
      "refId": "aw_69715328003a81b066c9",
      "name": "2101 eee"
    }
  },
  "products": {
    "agneau_047b7858cd": {
      "refId": "aw_agneau_047b7858cd",
      "productName": "Agneau"
    }
  },
  "purchases": { "...": "..." },
  "materiel": { "...": "..." },
  "recipes": {
    "68975cbc002469058f8b_recipe1": {
      "refId": "aw_68975cbc002469058f8b_recipe1",
      "title": "Tagine d'agneau"
    }
  }
}
```

Ce fichier est **essentiel** pour :
1. Le script d'import (résoudre les refIds → PB IDs)
2. Le script de reset (identifier les records PB à supprimer)
3. Le traçage (savoir quel record AW correspond à quel record PB)
4. Le support incrémental (identifier les records déjà migrés)

### 2.6 Propriétés

- **Déterministe** : Même input → même output (refIds stables)
- **Idempotent** : Rejouable, écrase les fichiers existants
- **Validant** : Logge les warnings et erreurs de consistance
- **Audit trail** : `_appwriteId` et `_refId` dans chaque record pour traçabilité

---

## Scripts utilitaires (à implémenter)

### cleanup-pb.ts — Purge des collections PB

```
Usage: bun run scripts_dev/cleanup-pb.ts [--target=migrated|all]
```

**Mode `migrated`** (défaut) : Supprime uniquement les records issus de la migration
- Utilise `migration-map.json` pour identifier les records PB
- Supprime dans l'ordre inverse des dépendances
- Ne touche PAS aux données statiques (ingredients, categories, recipes)

**Mode `all`** : Supprime TOUTES les données des collections dynamiques
- Ordre de suppression (inverse des dépendances) :
  ```
  locks → share_links → event_todos → teamdocs → materiel_loan
  → event_materiel → purchases → products → events
  → materiel → teams → users
  ```
- garde les données statiques (ingredients, categories, recipes) intactes

### validate-migration.ts — Vérification post-import

```
Usage: bun run scripts_dev/validate-migration.ts
```

Vérifie :
1. Count par collection PB = count dans pb-import/*.json
2. Relations résolues (expand sur events.teams, products.eventId, etc.)
3. guestEmails[] non-vides sur les events avec des labels
4. Pas de records orphelins (products sans eventId, etc.)
5. Users PB : email + verified correspondent aux données Appwrite

---

## Stratégie de ré-exécution et incrémental

### Ré-exécution complète (replay)

Le pipeline est conçu pour être **rejouable de zéro** :

```
1. cleanup-pb.ts --target=migrated   # Purge les données migrées
2. 1-export-appwrite.ts               # Re-export depuis AW
3. 2-transform-data.ts                # Re-transform
4. 3-import-pb.ts                     # Re-import
5. validate-migration.ts              # Vérification
```

Chaque étape est indépendante et idempotente.

### Import sur PB self-hosted (VPS)

Pour la prod, le script d'import se connectera au PB du VPS :

```env
PB_URL=https://pb.oupla.net              # URL PB prod
PB_ADMIN_EMAIL=admin@enka.oupla.net      # Superuser PB
PB_ADMIN_PASSWORD=<secure_password>
```

L'auth se fait via `pb.admins.authWithPassword()` (superuser).

### Mise à jour incrémentale (évolutif)

Le pipeline peut évoluer pour supporter les mises à jour incrémentales :

1. **Export incrémental** : Ajouter un filtre `Query.greaterThan("$updatedAt", lastSyncTimestamp)` pour ne récupérer que les records modifiés depuis le dernier export
2. **Transform différentiel** : Comparer avec le migration-map existant pour identifier les nouveaux/modified records
3. **Import upsert** : Créer les nouveaux records, mettre à jour les existants (via lookup email pour users, appwriteId pour les autres)

**Complexité** : Modérée. Le principal risque est la gestion des suppressions (record supprimé dans AW mais toujours dans PB). Pour la phase initiale, le replay complet est recommandé.

---

## Ordre d'exécution résumé

```
PHASE 1 : EXPORT (1-export-appwrite.ts)
========================================
1. Configurer .env.local avec API key prod
2. bun run scripts_dev/1-export-appwrite.ts
3. Vérifier les fichiers dans appwrite-export/
4. Contrôler que events ont bien contributors, todos, meals, allDates

PHASE 2 : TRANSFORM (2-transform-data.ts)
==========================================
5. bun run scripts_dev/2-transform-data.ts
6. Vérifier les fichiers dans pb-import/
7. Contrôler le rapport de consistance (warnings, errors)
8. Vérifier migration-map.json

PHASE 3 : IMPORT (3-import-pb.ts — plan séparé)
=================================================
9. cleanup-pb.ts --target=migrated  (si données existantes)
10. bun run scripts_dev/3-import-pb.ts
11. validate-migration.ts
12. Tester l'app : login, events, products, materiel

PHASE 4 : ITÉRATIONS
=====================
13. Si corrections nécessaires :
    a. Modifier les scripts
    b. cleanup-pb.ts --target=migrated
    c. Rejouer depuis l'étape nécessaire
14. Valider sur dev puis prod
```

---

## Risques et mitigations

| Risque | Gravité | Mitigation |
|---|---|---|
| API key insuffisante | **Bloquant** | Vérifier les scopes avant l'export (test avec un appel simple) |
| Champs Appwrite inattendus | Moyen | Export complet du premier event pour inspection manuelle |
| Relations cassées (userId inexistant) | Faible | Logger + fallback à null, sauf si champ requis → skip |
| guestEmails vide | **Élevé** | Risque bloquant pour l'accès aux events. Double validation : labels → emails + vérification croisée |
| Products avec eventId inexistant | Moyen | Skip et logger — ce sont des produits orphelins |
| Doublons d'email users | Faible | Prod a 33 users uniques, mais vérifier |
| Volume trop grand pour une seule transaction | Faible | Import collection par collection, pas de transaction globale |
| PB self-hosted inaccessible | **Bloquant** | Tester la connexion avant l'import |

---

## ⚠️ Instructions pour les agents

1. **Lire ce plan en entier** avant de commencer l'implémentation
2. **Source de vérité schéma PB** : **TOUJOURS utiliser `svelte-app/src/lib/types/pb-generated.ts`** pour comprendre le schéma PB. Les fichiers de migration (`pocketbase/pb_migrations/*.js`) sont un historique qui a connu des erreurs et corrections — ils ne reflètent pas l'état actuel du schéma.
3. **Pas de SDK npm** — L'export utilise **fetch HTTP natif** (API REST Appwrite directe). Le package `appwrite` npm est **incompatible** avec le serveur self-hosted 1.8.1 (SDK v25+ nécessite 1.9.x). Ne pas installer le package `appwrite`.
4. **Configurer `.env.local`** avec l'API key Appwrite et les identifiants PB (déjà fait dans `scripts_dev/.env.local`)
5. **Commencer par l'étape 1** (export) et valider les données avant de passer à l'étape 2
6. **Toujours vérifier** qu'un event exporté contient bien `contributors`, `allDates`, `todos`, `meals`
7. **Logger les warnings** — ne pas silently skip les données
8. **Ne jamais modifier la base Appwrite source** — opérations en lecture seule uniquement
9. **Tester sur dev** si possible, puis valider sur prod
10. **Garder les fichiers intermédiaires** — ils servent d'audit trail
11. Mettre à jour ce plan au fur et à mesure (statuts, notes d'implémentation)
