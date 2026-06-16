# Stress Test Appwrite (ec-dev)

Script de stress test pour évaluer la capacité du VPS Appwrite ec-dev (self-hosted, version 1.9.0) à absorber une charge réaliste : 6 virtual users en parallèle exécutant des rafales de reads/writes sur un sandbox auto-provisionné.

## Prérequis

- **Bun** runtime (déjà utilisé par le projet)
- **API key admin ec-dev** — créer dans Appwrite Console > Overview > API Keys > Create API Key avec les scopes :
  - `tables.read`, `tables.write`
  - `rows.read`, `rows.write`
  - `users.read`, `users.write`
  - `teams.read`, `teams.write`
  - `sessions.write` (optionnel)
- **6 users test existants** sur ec-dev (identifiés par email dans `.env.local`)

## Configuration

Copier `.env.local.example` vers `.env.local` et remplir :

```bash
cp .env.local.example .env.local
```

Variables obligatoires :
- `STRESS_API_KEY` : API key admin ec-dev (préfixe `standard_`)
- `STRESS_USER_1_EMAIL` à `STRESS_USER_6_EMAIL` : emails des 6 users test

Variables optionnelles (avec valeurs par défaut) :
- `STRESS_PRODUCTS_COUNT` (30) : nombre de products créés dans le sandbox
- `STRESS_RECIPES_COUNT` (10) : nombre de recipes fetch pour les productHugoUuid
- `STRESS_RAFALES` (100) : nombre de rafales
- `STRESS_DURATION_MS` (180000) : durée max en ms
- `STRESS_JITTER_MIN_MS` / `STRESS_JITTER_MAX_MS` (100/500) : délai aléatoire entre users

## Usage

```bash
# Test complet par défaut (100 rafales, ~3 min, 6 virtual users)
bun run scripts/stress-test.ts

# Test court (10 rafales)
bun run scripts/stress-test.ts --rafales 10

# Valider le setup sandbox sans lancer les rafales
bun run scripts/stress-test.ts --setup-only

# Cleanup d'urgence des sandboxes orphelins
bun run scripts/stress-test.ts --cleanup-orphans

# Garder le sandbox après le test pour investigation
bun run scripts/stress-test.ts --no-cleanup

# Voir la config résolue
bun run scripts/stress-test.ts --print-config

# Aide
bun run scripts/stress-test.ts --help
```

## Ce que fait le script

### Phases

1. **Pre-flight** : parse CLI, scan orphelins (best-effort, limitation serveur)
2. **Setup sandbox** : crée un event `STRESS_TEST_{ts}` + N products dérivés de recipes réelles
3. **Bootstore simulé** : 6 listRows en parallèle par virtual user (main, recettes, materiel, materiel_loan, kteams, teamdocs) — reproduit App.svelte lignes 38-70
4. **Rafales** : N itérations, chaque virtual user fait en parallèle :
   - 3× listRows sur products (read)
   - 2× updateRow sur products (store + updatedBy)
   - Jitter 100-500ms entre users
5. **Teardown** : supprime tous les products du sandbox + l'event
6. **Rapport** : p50/p95/p99 par scénario, taux d'erreur, throughput

### Métriques collectées

- **Latence** : p50, p95, p99, min, max, avg par scénario (read, write, bootstore)
- **Taux d'erreur** : global + catégorisé par code HTTP
- **Throughput** : req/s global
- **Santé globale** : EXCELLENT (<1%) / BON (<5%) / DÉGRADÉ (<20%) / CRITIQUE

## Monitoring VPS en parallèle

Pour corréler les métriques du script avec l'état du VPS :

```bash
# Sur le VPS (via SSH) pendant le test
docker stats --no-stream
htop
```

À surveiller :
- **CPU MariaDB** (container appwrite-db)
- **RAM** globale
- **Connexions réseau** sur `aw.oupla.net`

## Architecture des modules

```
scripts/
├── stress-test.ts       # Script principal (orchestration 4 phases)
├── stress-config.ts     # Parser .env.local + CLI overrides
├── stress-client.ts     # StressClient (1 par virtual user, fetch-based)
├── stress-setup.ts      # Sandbox provisioning (event + products)
├── stress-scenarios.ts  # Scénarios read/write (CF retiré en V1)
└── stress-reporter.ts   # Stats p50/p95/p99 + rapport coloré
```

## Limitations connues (serveur 1.9.0)

Le serveur ec-dev est en Appwrite **1.9.0** (dernière version self-hosted stable). Plusieurs limitations impactent le script :

1. **SDK npm `appwrite@24.1.1` incompatible user-auth en Bun** : le SDK attend un cookie store navigateur absent en runtime Bun standalone. → **Contournement** : utilisation d'une API key admin via header `X-Appwrite-Key` (fetch direct, pas de SDK).

2. **`queries[]` non supporté** : `?queries[]=equal(...)` retourne `400 Invalid query: Syntax error`. `?equal=attr,value` est ignoré. → **Contournement** : filtrage côté client via `listRowsAndFilter()`.

3. **`listRows` ne retourne pas les rows récents** : latence d'indexation non documentée — un event créé il y a 10s peut ne pas être visible dans listRows. → **Contournement** : `scanOrphans()` est best-effort. `teardownSandbox()` utilise les productIds stockés depuis `createProducts()` (pas besoin de re-filter).

4. **`limit=N` parfois ignoré** selon les collections. → **Contournement** : on slice côté client quand nécessaire.

5. **`orderDesc=$createdAt` non fiable**. → **Contournement** : pas de tri attendu, on filtre tout côté client.

6. **WebSocket / Realtime non disponible en Bun** : le SDK utilise `window.WebSocket`. → **V1 sans realtime**. Couvre read/write uniquement. V2 possible via polyfill large ou WebSocket natif custom.

7. **Cloud Functions non testées** : les droits d'exécution CF sont gérés au niveau de la CF (pas via scopes API key). Sans scope `execution.write`, les CF ne sont pas appelables. → **V1 sans CF**. La charge read/write seule est suffisante pour monitorer le VPS.

## Modes spéciaux

| Flag | Description |
|---|---|
| `--setup-only` | Setup + vérification + attente Entrée, puis teardown. Sans rafales. |
| `--cleanup-orphans` | Scan et supprime les sandboxes orphelins, puis exit. |
| `--no-cleanup` | Skip le teardown — sandbox conservé pour investigation manuelle. |
| `--print-config` | Affiche la config résolue et exit. |
| `--rafales N` | Override le nombre de rafales. |
| `--duration MS` | Override la durée max en ms. |
| `--products N` | Override le nombre de products créés. |
| `--recipes N` | Override le nombre de recipes fetch. |
| `--jitter MIN MAX` | Override le jitter en ms. |

## Troubleshooting

### Le script reste bloqué au bootstore

Le bootstore fait 6 listRows par virtual user en parallèle (36 requêtes). Si le serveur est lent ou rate-limited, ça peut prendre du temps. Patienter ou réduire le nombre de virtual users dans `.env.local`.

### Erreur "STRESS_API_KEY manquant"

Créer une API key dans Appwrite Console > Overview > API Keys > Create API Key avec les scopes listés dans la section Prérequis.

### Erreur "user X introuvable sur ec-dev"

Vérifier que les emails dans `.env.local` correspondent à des users existants sur ec-dev. Lister les users via CLI :
```bash
cd ../../appwrite-ec-dev
appwrite users list --json
```

### Sandbox orphelin après Ctrl+C

Si le script est interrompu brutalement, l'event sandbox peut rester. Pour cleanup :

```bash
# Option 1 : via le script (best-effort, peut rater les orphelins récents)
bun run scripts/stress-test.ts --cleanup-orphans

# Option 2 : via CLI manuel (plus fiable)
cd ../../appwrite-ec-dev
appwrite tables-db list-rows --database-id 689d15b10003a5a13636 --table-id main --json | grep STRESS_TEST
# Puis delete chaque event + ses products
```

### Beaucoup d'erreurs 429 (rate limit)

Réduire la charge : diminuer `STRESS_RAFALES`, augmenter `STRESS_JITTER_MIN_MS` et `STRESS_JITTER_MAX_MS`.

## V2 possible

- **Realtime (WebSocket)** : polyfill window large ou WebSocket natif custom
- **Cloud Functions** : si l'utilisateur ajoute le scope `execution.write` à l'API key
- **Auth user-auth multi-sessions** : si le serveur ec-dev est upgrade un jour
- **aw-sync layer** : via Playwright (IndexedDB + Dexie)
- **Stress locks concurrent** : `acquireLock` simultané pour révéler la potential race condition
