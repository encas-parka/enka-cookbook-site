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
- **Préflight** : la cible doit être vide (exit 1 sinon) — `--force` ignore (mode dev explicite)

```bash
bun run scripts_dev/3-import-pb.ts
```

#### Mode dev `--upsert`

Ré-importe les sources sur une cible **déjà peuplée par ce pipeline** : POST
par record ; en cas de rejet d'existence (champ unique → `validation_not_unique`,
id déterministe déjà pris → `validation_pk_invalid`), PATCH du record existant
par son id déterministe (`hash15(refId)`, ou le slug pour les recettes).

```bash
PB_URL_OVERRIDE=http://127.0.0.1:8094 bun run scripts_dev/3-import-pb.ts --upsert
```

- **⚠️ Ne garantit pas PB = sources** : aucun record absent des sources n'est
  purgé (pas de delete). Les records supprimés côté source restent en PB.
- **Cible** : doit avoir été peuplée par ce pipeline (ids déterministes). Une
  cible peuplée autrement produit des PATCH 404 — visibles, jamais silencieux.
- **Compteurs** : `created` (nouveaux records) / `patched` (rafraîchis) /
  `failed` (POST et PATCH échoués). Il n'y a pas d'état « skipped » : tout
  `not_unique` débouche sur un PATCH.
- **Timestamps** (comportement attendu, mesuré PB 0.37.5 — pas un bug) : le
  PATCH ignore silencieusement `created`/`updated` fournis — `created` est
  conservée, `updated` devient la date de l'upsert. Relancer
  `4-fix-timestamps` ensuite (PB arrêté) pour restaurer les dates sources.
- **users** : le PATCH ne touche jamais `password`/`passwordConfirm` (les
  mots de passe sources sont aléatoires à chaque transform — les tourner à
  chaque upsert serait une rotation silencieuse).
- **Verdicts** : un run `--upsert` n'émet aucun count-delta pour les records
  patchés (comptes inchangés) ; les rejets éventuels restent émis
  (`import-rejected`, mêmes clés que le mode normal). `validate-migration`
  en sortie d'upsert n'est pas un critère : son contrat suppose le reset du
  pipeline (cible vide → fix timestamps → validate).
- **Flags** : `--upsert` implique la tolérance cible peuplée (pas besoin de
  `--force`, qui reste l'échappatoire du mode normal). Cible vide + upsert =
  équivalent à un import normal.

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

Vérifie l'intégrité des données importées. Cible retargetable par env
`PB_URL_OVERRIDE` (instance jetable), sinon `.env.local` `PB_URL`.

- **Vérifications** :
  1. Record counts : PB vs **sources brutes** (appwrite-export + Hugo `content/recipe` + `static/data`) — tout écart doit être couvert par un verdict
  2. Relation integrity : tous les champs relation pointent vers des records PB existants
  3. Recipe field population : created/createdBy/permissionWrite/rootRecipeId peuplés comme dans `pb-import/recipes.json`
  4. guestEmails : tous les events ont leurs emails attendus
  5. RefId coverage : tous les refIds dans `migration-map.json` ont un PB ID correspondant (tolère les absences couvertes par un verdict)
  6. Convergence des recettes Appwrite (id = slug Hugo) vs leur copie PB : divergence de contenu = bloquant sauf verdict ; drift de `updatedAt` au jour = informatif (Hugo est la source la plus fraîche) ; absentes = inventaire verdicté
  7. Structurel : `teams.roles` peuplé (non-NULL), `materiel.createdBy`/`ownerUser` vides par design (deleteRules team-scopées, pas de backfill)
  8. teamdocs over-limit : absence expliquée par la limite du champ texte et verdictée
- **Collections validées** : users, teams, materiel, events, products, purchases, materiel_loan, event_materiel, teamdocs, event_todos, share_links, recipes, ingredients, categories

#### Verdicts attendus (`pb-import/expected-verdicts.json`)

Inventaire machino-lisible des écarts acceptés pour le run courant. Émis par
le pipeline, pas écrit à la main : `2-transform-data` (deltas d'orphelins),
`2b-transform-recipes` (absents + convergence), `2c-transform-ingredients`
(dédup UUID) et `3-import-pb` (rejets d'import) — writer partagé
`verdicts-file.ts`, règles d'ownership en tête de fichier : chaque émetteur
remplace ses propres verdicts et ceux de même clé (type, collection/slug),
l'output est canoniquement trié (déterministe : 2 runs = bytes identiques).
Effacé par `cleanup-pb` avec le reste de `pb-import/*.json`. Schéma et règles
de matching documentés en tête de `validate-migration.ts` : chaque écart
observé doit consommer exactement un verdict — un écart sans verdict
(compteur « non-verdicté » > 0) ou un verdict sans écart (« stale ») fait
échouer validate.

> **Limite texte PocketBase** : un champ texte dont le schéma déclare `max: 0`
> applique quand même une limite par défaut de **5000 caractères** à la
> validation (`validation_max_text_constraint`) — cf. `core/field_text.go`
> ("If zero, a default limit of 5000 is applied"). C'est ce qui rejette le
> teamdocs de 6317 chars malgré `content.max: 0` ; décision produit en attente
> (relever le `max` du schéma ou tronquer).

```bash
# PB doit tourner
bun run scripts_dev/validate-migration.ts

# Instance jetable (harness)
PB_URL_OVERRIDE=http://127.0.0.1:8091 bun run scripts_dev/validate-migration.ts
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

Ou en une commande : `migrate.ts` (section suivante).

---

## Orchestration — `migrate.ts`

Point d'entrée opérateur : enchaîne tout le pipeline (phases A–D) contre une
cible PocketBase et écrit un rapport daté. Les scripts individuels restent
utiles pour le débogage — le chemin canonique d'un run complet, c'est celui-ci.

```bash
bun run scripts_dev/migrate.ts --help

# Run complet en mode managé (cible spawnée par l'orchestrateur) :
bun run scripts_dev/migrate.ts \
  --pb-bin=pocketbase/pocketbase \
  --pb-dir=/chemin/vers/pb_data_vierge \
  --content-synced --yes
```

Enchaînement : preflight (env + superuser + cible adressable) → cleanup
`--target=all` → transforms (2, 2b, 2c, 2d) → import (3) → **stop cible** →
`4-fix-timestamps` → **restart cible** → validate → rapport. Fail-fast : toute
étape en échec stoppe le run, **le rapport est écrit quand même** (état atteint
+ erreur) et l'exit est non-zéro. Verdict global VERT seulement si toutes les
étapes passent et validate est 100 % vert.

- **Mode managé** (`--pb-bin` + `--pb-dir`, les deux requis) : l'orchestrateur
  spawn lui-même la cible (`serve`), la stoppe **par PID** autour de
  `4-fix-timestamps` (le fix sqlite exige la cible arrêtée), la relance pour
  validate, et ne tue jamais un process qu'il n'a pas spawné. Le `pb_data`
  doit être pré-provisionné : migrations appliquées
  (`pocketbase migrate up`), vide (contrat du run = reset complet), avec un
  superuser correspondant à `.env.local` (`pocketbase superuser upsert`).
  Lancez l'instance avec `--migrationsDir`/`--hooksDir` pointés **hors du
  repo** : PB y écrit ses migrations dynamiques.
- **Mode opérateur** (sans ces flags) : cible déjà démarrée requise ; le run
  s'arrête à `4-fix-timestamps` si la cible répond (message d'arrêt explicite —
  c'est à celui qui a démarré l'instance de l'arrêter), puis attend le
  redémarrage (120 s) avant validate.
- **Gates humaines** : rappel du pré-requis de sync du contenu Hugo
  (`content/recipe` vient du repo site — non automatisable ici), ack par
  prompt interactif ou `--content-synced` ; un run `--yes` ne fabrique jamais
  cet ack. `cleanup-pb` reçoit toujours `--yes` de l'orchestrateur (le run
  entier EST la confirmation du reset).
- **Cible** : `PB_URL_OVERRIDE` > `.env.local` `PB_URL` > 8090 (convention
  commune) ; port explicite requis en mode managé.
- **Sortie** : rapport `scripts_dev/runs/<date>.md` — sources (mtimes),
  étapes (durées, exit, comptes clés), verdicts émis par le pipeline, récap
  validate, verdict global — plus logs par étape dans
  `scripts_dev/runs/<date>-logs/`. Gitignored (artefact de run, comme
  `pb-import/`).
- **Prérequis Phase B/C** : `appwrite-export/*.json` frais
  (`1-export-appwrite.ts`), `content/recipe` synchronisé du repo site,
  `static/data/ingredients.json` + `recipe-info.json` (trackés).

---

## Ré-initialisation

### `cleanup-pb.ts`

Purge les données migrées de PocketBase pour re-tester.

```bash
bun run scripts_dev/cleanup-pb.ts [--target=migrated|all] [--yes]
bun run scripts_dev/cleanup-pb.ts                     # idem --target=migrated
bun run scripts_dev/cleanup-pb.ts --target=all        # supprime TOUT sauf ingredients + categories
```

- **Mode `migrated`** (défaut) : supprime uniquement les records listés dans `migration-map.json`
- **Mode `all`** : supprime tous les records des collections dynamiques (users, teams, events, products, purchases, materiel, materiel_loan, event_materiel, teamdocs, event_todos, share_links, locks, recipes)
- **Collections statiques préservées** : `ingredients`, `categories` (jamais supprimées)
- **Suppression** : ordre inverse des dépendances (records référençants d'abord)
- **Confirmation** : demande un « yes » interactif avant toute purge ; `--yes` le
  court-circuite (requis en non-interactif — l'orchestrateur `migrate.ts` le passe toujours)
- **Cible** : `PB_URL_OVERRIDE` > `.env.local` `PB_URL` > 8090 (convention commune au pipeline)

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

### `ingredientRef`

Ce champ (anciennement `productHugoUuid`) distingue les produits manuels (`null`) des produits liés aux recettes (ref ingrédient). Renommé pour clarifier le lien avec `ingredients.ref`.

### refId format

Format : `aw_{appwriteId}` (ex: `aw_695d58fa000fa95a0fb9`). Déterministe et globalement unique. Permet de résoudre les relations avant que les vrais PB IDs ne soient connus.

### Users import

Les users sont créés avec un mot de passe aléatoire (`randomBytes(32).toString("hex")`). Les mots de passe Appwrite (argon2) ne sont pas portables vers PB (bcrypt). Un mécanisme de reset sera nécessaire (OTP/magic link).

### Dettes connues (qualité données)

1. **Double-sérialisation JSON** : `events.meals` et `events.contributors` peuvent contenir des strings JSON au lieu d'objets. Fix : corriger `2-transform-data.ts` + re-importer.
2. ~~**IDs Appwrite dans owner JSON**~~ : `materiel.owner` entièrement retiré du schéma PB (`66015c58`). Le transform résout désormais `owner.teamId` → `teamId` et `owner.userId` → `ownerUser` directement.
3. **`users` listRule restrictif** : `id = @request.auth.id` empêche `expand: 'members'`. Fix : assouplir le listRule ou fetch séparément.
