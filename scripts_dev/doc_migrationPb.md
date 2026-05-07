# Pipeline de migration Appwrite → PocketBase

## Vue d'ensemble

4 phases, 8 scripts :

| Phase | Rôle | Scripts |
| ----- | ---- | ------- |
| A | Schéma PB (migrations automatiques) | — |
| B | Export Appwrite → Transform → Import PB | `1-export-appwrite.ts`, `2-transform-data.ts`, `3-import-pb.ts` |
| C | Données Hugo (recettes, ingrédients, catalog) → JSON | `2b-transform-recipes.ts`, `2c-transform-ingredients.ts`, `2d-transform-catalog.ts` |
| D | Post-import (timestamps) → Validation | `4-fix-timestamps.ts`, `validate-migration.ts` |

### Flux de données

```
Appwrite REST API                    Hugo static files
       │                                    │
       ▼                                    ▼
 1-export-appwrite.ts              2b-transform-recipes.ts
        │                          2c-transform-ingredients.ts
        ▼                          2d-transform-catalog.ts
appwrite-export/*.json                     │
       │                                    │
       ▼                                    │
2-transform-data.ts ───────────────────────►│
       │                                    │
       ▼                                    ▼
pb-import/*.json + migration-map.json ◄─────┘
       │
       ▼
3-import-pb.ts ──► PocketBase (HTTP API)
       │
       ▼
pb-import/id-map.json
       │
       ▼ (PB stopped)
4-fix-timestamps.ts ──► data.db (direct SQL)
```

---

## Prérequis

### PocketBase

```bash
bun run dev:pb    # port 8090, Admin UI: http://127.0.0.1:8090/_/
```

### `.env.local` (dans `scripts_dev/`)

```bash
# PocketBase Admin (requis par 3-import-pb, 4-fix-timestamps, validate-migration, cleanup-pb)
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=qaldek@gmx.com
PB_ADMIN_PASSWORD=<password>

# Appwrite (requis par 1-export-appwrite uniquement — lecture seule)
APPWRITE_PROJECT_ID=696b7acb0037bde79e3f
APPWRITE_API_KEY=standard_<key>
APPWRITE_ENDPOINT=https://aw.oupla.net/v1
```

### Fichiers source (Phase C)

- `content/recipe/*/index.md` — recettes Hugo markdown (pour `2b-transform-recipes.ts`)
- `static/data/ingredients.json` — ingrédients statiques (pour `2c-transform-ingredients.ts`)
- `static/data/recipe-info.json` — catalogue (pour `2d-transform-catalog.ts`)

---

## Phase A — Schéma PocketBase

Les migrations dans `pocketbase/pb_migrations/` sont appliquées automatiquement au démarrage de PB.

- **27 migrations** : 15 collections + 12 fixups
- **13 collections** + `users` built-in : teams, events, products, purchases, materiel, materiel_loan, event_materiel, teamdocs, locks, notifications, event_todos, share_links, ingredients, categories, recipes
- Voir `pocketbase/pb_migrations/` pour le détail

### Démarrage

```bash
bun run dev:pb    # applique les migrations automatiquement
```

---

## Phase B — Données Appwrite

### `1-export-appwrite.ts`

Exporte 11 collections Appwrite en JSON brut via REST API (pas de SDK).

- **Source** : Appwrite REST API (`/v1/databases/{id}/collections/{id}/documents`)
- **Output** : `appwrite-export/*.json` (un fichier par collection)
- **Config** : `.env.local` (`APPWRITE_*`)
- **Collections exportées** : events, products, purchases, materiel, event_materiel, materiel_loan, teamdocs, event_todos, share_links, locks, user_notifications
- **Pagination** : 500 par page
- **Note** : les users sont exportés séparément via `/v1/users` (endpoint global)

```bash
bun run scripts_dev/1-export-appwrite.ts
```

### `2-transform-data.ts`

Transforme les données Appwrite en format PB-ready avec remappage d'IDs.

- **Input** : `appwrite-export/*.json`
- **Output** : `pb-import/*.json` + `migration-map.json`
- **Transformations** :
  - Remappage IDs : `refId = "aw_" + appwriteId` (format déterministe, globalement unique)
  - Labels Appwrite → `guestEmails[]` sur les events
  - Users : extraction depuis les documents events (labels = accès) + export users séparé
  - Teams : déduplication des noms, `members` en refIds
  - Events : `contributors`, `todos`, `date`, `meals` préservés en JSON
  - Relations : remplacées par des refIds (résolus lors de l'import)
  - Champs texte : `null` → `""` ou omission
- **Validation** : rapport avec warnings/erreurs en fin d'exécution

```bash
bun run scripts_dev/2-transform-data.ts
```

### `3-import-pb.ts`

Importe TOUTES les données dans PocketBase via HTTP API (pas de SDK).

- **Input** : `pb-import/*.json` + `migration-map.json`
- **Output** : `pb-import/id-map.json` (refId → PB ID mapping)
- **Auth** : superuser via `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`
- **Import par ordre de dépendance** :

  1. `users` (auth collection, password random)
  2. `teams` (members → users)
  3. `materiel` (teamId, ownerUser → users/teams)
  4. `events` (createdBy, teams → users/teams)
  5. `products` (eventId, updatedBy → events/users)
  6. `purchases` (eventId, createdBy, products → events/users/products)
  7. `materiel_loan` (eventId, ownerId → events/teams)
  8. `event_materiel` (eventId, sourceMaterielId, loanId → events/materiel/materiel_loan)
  9. `teamdocs` (teamId, eventId → teams/events)
  10. `event_todos` (eventId, assignedTo → events/users)
  12. `ingredients` (standalone)
  13. `categories` (standalone)
  14. `recipes` (createdBy → users, IDs forcés, rootRecipeId self-ref)

- **Résolution des refIds** : chaque refId `aw_xxx` est mappé au vrai PB ID après création
- **Gère** : relations single/multi, champs JSON (remappage deep), champs texte avec refIds, IDs forcés (recipes)

```bash
bun run scripts_dev/3-import-pb.ts
```

---

## Phase C — Données Hugo (recettes)

> **Tous les scripts Phase C sont des purs transforms — aucune dépendance PocketBase.**
> Ils produisent du JSON dans `pb-import/`, importé ensuite par `3-import-pb.ts`.

### `2b-transform-recipes.ts`

Transforme les recettes Hugo markdown en JSON PB-ready.

- **Input** : `content/recipe/*/index.md` (frontmatter markdown)
- **Output** : `pb-import/recipes.json`
- **Résolution `createdBy`** : stocke les Appwrite user IDs (résolus par `3-import-pb.ts` via `refToPb`)
- **Tri topologique** : recettes originales avant les v2 (résout `rootRecipeId` FK constraint)
- **IDs forcés** : nom du répertoire Hugo (ex: `babka-vegane-harissa-e_qph5vukgdjb6`)
- **Dépendance** : `pb-import/users.json` doit exister (pour résolution createdBy)
- **Options** : `--dry-run`

```bash
bun run scripts_dev/2b-transform-recipes.ts
bun run scripts_dev/2b-transform-recipes.ts --dry-run
```

### `2c-transform-ingredients.ts`

Transforme les ingrédients statiques en JSON PB-ready.

- **Input** : `static/data/ingredients.json`
- **Output** : `pb-import/ingredients.json`
- **Déduplication** : vérifie l'unicité des UUIDs
- **Mapping** : `u` → `uuid`, `n` → `name`, `t` → `type`, `a` → `allergens`
- **Aucune dépendance PB**
- **Options** : `--dry-run`

```bash
bun run scripts_dev/2c-transform-ingredients.ts
bun run scripts_dev/2c-transform-ingredients.ts --dry-run
```

### `2d-transform-catalog.ts`

Transforme le catalogue en JSON PB-ready.

- **Input** : `static/data/recipe-info.json`
- **Output** : `pb-import/categories.json`
- **Contenu** : equipment tags (`materiel[]`) + categories
- **Aucune dépendance PB**
- **Options** : `--dry-run`

```bash
bun run scripts_dev/2d-transform-catalog.ts
bun run scripts_dev/2d-transform-catalog.ts --dry-run
```

---

## Phase D — Post-import

### `4-fix-timestamps.ts`

Corrige les timestamps `created`/`updated` (ignorés par PB AutodateField lors de l'import API).

- **Input** : `pb-import/*.json` (timestamps originaux) + `pb-import/id-map.json` (mapping IDs)
- **Action** : SQL direct sur `pocketbase/pb_data/data.db` via `bun:sqlite`
- **Collections** : users, teams, materiel, events, products, purchases, materiel_loan, event_materiel, teamdocs, event_todos, share_links, recipes
- **Safety** : backup automatique de `data.db` avant modification
- **Options** : `--dry-run`

> **PocketBase DOIT être arrêté** avant exécution (WAL mode, cohérence du cache).

```bash
# Arrêter PB d'abord !
bun run scripts_dev/4-fix-timestamps.ts
bun run scripts_dev/4-fix-timestamps.ts --dry-run
```

### `validate-migration.ts`

Vérifie l'intégrité des données importées.

- **Vérifications** :
  1. Record counts : PB vs fichiers `pb-import/`
  2. Relation integrity : tous les champs relation pointent vers des records PB existants
  3. guestEmails : tous les events ont leurs emails attendus
  4. RefId coverage : tous les refIds dans `migration-map.json` ont un PB ID correspondant
- **Collections validées** : users, teams, materiel, events, products, purchases, materiel_loan, event_materiel, teamdocs, event_todos, share_links, recipes

```bash
# PB doit tourner
bun run scripts_dev/validate-migration.ts
```

---

## Ordre d'exécution complet

```bash
# Phase A — Démarrer PB (migrations auto)
bun run dev:pb

# Phase B — Données Appwrite
bun run scripts_dev/1-export-appwrite.ts
bun run scripts_dev/2-transform-data.ts

# Phase C — Données Hugo (peut tourner en parallèle de Phase B si users.json existe)
bun run scripts_dev/2b-transform-recipes.ts       # nécessite pb-import/users.json
bun run scripts_dev/2c-transform-ingredients.ts   # standalone
bun run scripts_dev/2d-transform-catalog.ts       # standalone

# Phase B+C — Import Appwrite + Hugo (PB doit tourner)
bun run scripts_dev/3-import-pb.ts

# Phase D — Fix timestamps (PB doit être arrêté)
# Stop PB first!
bun run scripts_dev/4-fix-timestamps.ts

# Phase D — Validation (redémarrer PB)
bun run dev:pb
bun run scripts_dev/validate-migration.ts
```

---

## Ré-initialisation

### `cleanup-pb.ts`

Purge les données migrées de PocketBase pour re-tester.

```bash
bun run scripts_dev/cleanup-pb.ts                     # supprime les records du migration-map
bun run scripts_dev/cleanup-pb.ts --target=migrated   # idem (défaut)
bun run scripts_dev/cleanup-pb.ts --target=all        # supprime TOUT sauf ingredients + categories
```

- **Mode `migrated`** (défaut) : supprime uniquement les records listés dans `migration-map.json`
- **Mode `all`** : supprime tous les records des collections dynamiques (users, teams, events, products, purchases, materiel, materiel_loan, event_materiel, teamdocs, event_todos, share_links, locks, recipes)
- **Collections statiques préservées** : `ingredients`, `categories` (jamais supprimées)
- **Suppression** : ordre inverse des dépendances (records référençants d'abord)

---

## Notes techniques

### `null` → champs vides

PocketBase ne gère pas toujours `null` correctement. Les transforms utilisent :

- Champs texte : `""` ou omission
- Relations : omission (PB default : `null` ou `[]`)
- Select : `""` ou `[]`
- JSON : `null` est valide

### IDs forcés (recipes)

Les recettes utilisent le nom du répertoire Hugo comme ID PB (ex: `babka-vegane-harissa-e_qph5vukgdjb6`). Ceci permet aux `rootRecipeId` d'être résolus directement.

### Résolution `createdBy`

1. Le transform (`2-transform-data.ts`) stocke l'Appwrite user ID dans `createdBy` (comme refId)
2. Le transform Hugo (`2b-transform-recipes.ts`) résout name/email → Appwrite user ID via `pb-import/users.json`
3. L'import (`3-import-pb.ts`) résout les Appwrite IDs via `refToPb` (peuplé lors de l'import des users)

### `productHugoUuid`

Ce champ est **LEGACY mais ACTIF** — il distingue les produits manuels (`null`) des produits liés aux recettes (UUID Hugo). À conserver dans le pipeline.

### refId format

Format : `aw_{appwriteId}` (ex: `aw_695d58fa000fa95a0fb9`). Déterministe et globalement unique. Permet de résoudre les relations avant que les vrais PB IDs ne soient connus.

### Users import

Les users sont créés avec un mot de passe aléatoire (`randomBytes(32).toString("hex")`). Les mots de passe Appwrite (argon2) ne sont pas portables vers PB (bcrypt). Un mécanisme de reset sera nécessaire (OTP/magic link).

### Dettes connues (qualité données)

1. **Double-sérialisation JSON** : `events.meals` et `events.contributors` peuvent contenir des strings JSON au lieu d'objets. Fix : corriger `2-transform-data.ts` + re-importer.
2. ~~**IDs Appwrite dans owner JSON**~~ : `materiel.owner` entièrement retiré du schéma PB (`66015c58`). Le transform résout désormais `owner.teamId` → `teamId` et `owner.userId` → `ownerUser` directement.
3. **`users` listRule restrictif** : `id = @request.auth.id` empêche `expand: 'members'`. Fix : assouplir le listRule ou fetch séparément.
