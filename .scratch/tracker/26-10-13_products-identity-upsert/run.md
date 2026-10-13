# Run — 26-10-13_products-identity-upsert

Mode : checkpoint (pause après chaque ticket atterri, rapport pédagogique entre étapes).
Base : `befc6d54` (verdict : arbre sale au démarrage — baseline tracker commise par l'orchestrateur, voir ci-dessous).

## Fences en vigueur

- RUN-CONTRACT : `/home/geo/.agents/docs/RUN-CONTRACT.md` (lu par l'orchestrateur ; chaque dispatch l'impose en première lecture).
- Pas de push. Commits conventionnels, périmètre par ticket, fichiers un par un.
- WIP étranger (ne pas toucher, ne pas committer) :
  - `M .gitignore` (user, 13-10 — hors scope).
  - `M .scratch/tracker/26-10-12_clickthrough-fixes/issues/12-gate-recheck-phase1-exit.md` (annotations gate du user).
  - `?? pocketbase/pb_migrations/1791887561_updated_products.js`, `1791908969_updated_locks.js`, `1791910787_updated_products.js`, `1791915239_updated_products.js` (relax ids via console — revendiquées par le ticket 01).
- Canon : vitest 175/175 (26 fichiers) au dernier point connu ; check 0 erreur / 6 warnings. Suites zone produits : `products-store-create`, `products-store-update-upsert`, `products-store-reactivity`, `pb-sync-*`.

## Investigations préalables (gap-only — ne pas re-dériver)

- `.scratch/handoff/26-10-13_pb-id-strategy-products-crud.md` — cadrage, faits §1-8, lot initial.
- `.scratch/handoff/26-10-13_invest_identite.md` — matching needs↔produits, index uniques A/B, keepId, recensement appelants.
- `.scratch/handoff/26-10-13_invest_oupla-sync.md` — upsertRecord = miroir Dexie (déjà inline chez nous) ; seul emprunt réel = `CollectionBatch.upsert` + `bulkUpsert` natifs + modèle de test ; pas d'upsert mono-record au SDK (0.26.8 et 0.27.0) ; aucun index unique sur productName (donc pas de 400 doublon aujourd'hui).
- `.scratch/handoff/26-10-13_invest_backport.md` — merge présent sœur / absent mig (18 fusionnés affichés en double en dev) ; 5 composants absents ; productName requis sœur vs nullable PB, 0 NULL des deux côtés ; séquencement identité → merge → required.
- Pas d'investigator dédié au run : les trois rapports couvrent le lot ; seul gap marqué « to verify » = sonde création id sémantique + relation achat (ticket 01).

## Faits (mesuré / inféré / doc)

- (à remplir par les implementers — un fait = ancre symbole/chemin + label de certitude)

## Pièges

- Piège de lecture export PB : les `fields` précèdent la clé `"name"` de la collection dans le snapshot.
- Typage `CollectionBatch.create` sans `id?` alors que le runtime le garde (écart à corriger au ticket 03).
- `||` vs `??` dans GroupPurchaseModal (micro-régression, ticket 06 ou backlog).
- `stats.merged` mort des deux côtés (trancher au ticket 05).

## Vérifications empiriques

- (sonde → verdict, chemin de log — à remplir)

## Décisions par ticket

- (une ligne par ticket — à remplir)

## Deferred findings

- (découvertes accidentelles + tag `!` / `S2` / `?` — l'orchestrateur les verse au backlog en fin de run, jamais les sub-agents)
