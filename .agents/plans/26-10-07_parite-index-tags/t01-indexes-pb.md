# T01 — Indexes PocketBase pertinents (delta-sync, scopes, lookups)

**Sources** : run.md § Faits établis ; audit port-hardening §3.A (comment la sync requête) ; pattern des index Appwrite prod (jamais portés)
**Prérequis** : aucun backend externe

## Objectif

Ajouter les index que les patterns de requêtes réels réclament, avec preuve mesurée (EXPLAIN QUERY PLAN avant/après).

## Inventaire des patterns (à compléter/vérifier par grep)

| Pattern | Collections concernées | Index candidat |
|---|---|---|
| Delta-sync : `updated >= since` ORDER BY `updated` (`pb-collection.initialFetch`) | events, products, purchases, event_materiel, materiel, materiel_loan, recipes, teamdocs, ingredients, categories | `updated` (simple) |
| Sync scopé : `eventId = X AND updated >= since` (ProductsStore ×2 collections, EventMaterielStore) | products, purchases, event_materiel | composite `(eventId, updated)` — le composite couvre le filtre + le range ; évaluer simple vs composite par EXPLAIN |
| Hook join-event / getEventShareLinks : `target_id` + `link_type` (+ isActive) | share_links | composite `(target_id, link_type)` |
| Locks acquire/release : `recordId` + `collection` (chemin chaud) ; deleteRule `userId` | locks | composite `(recordId, collection)` ; `userId` simple |
| Rules events : `createdBy = @request.auth.id` (EVENT-1 list/view, delete) | events | `createdBy` simple |

**Ne pas indexer** : les relations multi (`~` = LIKE sur JSON, non indexable) ; les json (idem).

## Méthode

1. **Preuve avant** : pour 4-5 requêtes représentatives (delta simple, delta scopé, lookup share_links, lookup locks), `sqlite3` `EXPLAIN QUERY PLAN` sur la dev DB → noter `SCAN` (attendu aujourd'hui).
2. Backup pb_data → `/tmp/orchestrate/pb_data-backup-t01p2/` + sha256 ; bootcheck sur copie d'abord.
3. **Une migration** (timestamp > 1791304200) ajoutant les index via `collection.indexes` (pattern JSVM ; down() retire). Appliquer copie puis dev.
4. **Preuve après** : mêmes EXPLAIN → `USING INDEX idx_…` ; `sqlite_master` : index présents. Verdicts dans run.md.
5. Si un index n'est PAS utilisé par l'EXPLAIN (PB réécrit la requête, préfixe de composite non respecté…) : ajuster (ordre des colonnes, simple vs composite) et documenter — la preuve prime sur le candidat.
6. Sonde fonctionnelle légère : boot PB, un delta curl `filter: updated >= '2000-01-01'&sort=updated` sur products → 200 (pas de régression requêtes).
7. Canons client intacts (aucun code client) ; `bun run check` quand même (filet).

## Critères

- [x] Inventaire des patterns vérifié par grep (complété si besoin) dans run.md
- [x] EXPLAIN avant/après par requête représentative (SCAN → USING INDEX), commandes exactes loggées
- [x] Migration appliquée (copie puis dev, backups faits) ; down() fonctionnel (testé sur copie)
- [x] Aucune régression sonde ; canons inchangés ; run.md amendé (journal T01)

## Résultat (07-10)

11 index posés (`1791333000_query_indexes.js`) : `updated` simple ×7, `(eventId, updated)` ×3 (products/purchases/event_materiel — toujours fetchés scopés, pas d'index `updated` simple pour eux), `(target_id, link_type)` share_links. Candidats rejetés par la preuve : `events.createdBy` (règles en OR avec `~` non-indexable, EXPLAIN reste SCAN), locks (client 100 % PK, `recordId`/`collection` vestiges jamais requêtés). Journal complet : run.md.
