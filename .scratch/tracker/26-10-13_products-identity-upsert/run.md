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

- (mesuré, sqlite `_collections` dev + copie) État final `products.id` : required / min 11 / max 40 / `^[a-z0-9_-]+$` — les 4 migrations console sont appliquées sur le dev (`_migrations` : `1791887561`→`1791915239`, ordre lexicographique = ordre d'application). `locks.id` : min 12 / max 40 / underscore. Chaîne des 3 forwards products cohérente : `1791887561` (min15→) → `1791910787` (min11) → `1791915239` (underscore) ; chaque down retombe exactement sur le up du précédent.
- (mesuré, sqlite dev) `products.productName` : field id `text1398119645`, text, position 3, min 0 / max 0 / pattern vide, required **0→1** via migration manuelle `1791920000_products_productname_required.js` (addAt(3) plein-spec, modèle console ; down = required 0).
- (mesuré) Replay complet de la chaîne sur pb_data vierge (8092, `pocketbase migrate up`) : 29 migrations appliquées, état final products/locks conforme ci-dessus — le lot versionné tient debout from scratch.
- (mesuré, sqlite dev) 993 produits, **0** productName vide → pas de backfill (critère 4).
- (mesuré, sonde `scripts_dev/probe-t11-products-semantic-id.ts`) 4/4 verdicts vert : create id=`sel_qq9ziy9kpw` (13 car.) → 200 stocké verbatim ; purchase `products:[sel_qq9ziy9kpw]` → 200 ; id 10 car. → 400 `validation_min_text_constraint` ; productName vide → 400 `validation_required`. Log `/tmp/orchestrate/probe-t11-semantic-id.log`.
- (mesuré) `3-import-pb.ts --upsert` exit 0 : products 982 patched / 0 failed, purchases 955 / 0 ; seul fail teamdocs −1 = écart connu verdicté (`content > 5000 chars`, préexistant). Log `/tmp/orchestrate/import-upsert-t11.log`.
- (doc) `ProductsStore.createProduct` (`svelte-app/src/lib/stores/ProductsStore.svelte.ts:1362`) écrit toujours productName — le requis ne bloque aucun appelant SPA ; le payload SPA miroité par la sonde.
- (doc) Ids déterministes de l'import = `hash15(_refId)` (15 car., `[a-z0-9]`, `3-import-pb.ts` § Id déterministe) — admissibles sous min 11 ; slug recettes idem.

## Pièges

- Piège de lecture export PB : les `fields` précèdent la clé `"name"` de la collection dans le snapshot. (Complément implementer : dans `1791277647_collections_snapshot.js`, le tableau `fields` qui suit le `"name"` d'une collection appartient à la collection **suivante** — lire les blocs par la fin.)
- Le kill du pocketbase enfant d'un `dev:all` user est refusé par le sandbox (permission.rejected) → technique des **instances jetables** : copie `sqlite3 .backup` du pb_data dans `/tmp/opencode/` + `pocketbase serve --http=127.0.0.1:8091` (ou `migrate up` sur répertoire vierge) + `PB_URL_OVERRIDE` que la sonde et l'import honorent déjà. Ne touche ni au process user ni à ses timestamps (`updated` bumpés seulement sur la copie jetable).
- Typage `CollectionBatch.create` sans `id?` alors que le runtime le garde (écart à corriger au ticket 03).
- `||` vs `??` dans GroupPurchaseModal (micro-régression, ticket 06 ou backlog).
- `stats.merged` mort des deux côtés (trancher au ticket 05).

## Vérifications empiriques

- Sonde id sémantique + achat + requis : `/tmp/orchestrate/probe-t11-semantic-id.log` — 4/4 verdicts vert, cleanup 204/204, exit 0 (instance jetable 8091, copie du pb_data dev).
- Replay chaîne migrations from scratch : `pocketbase migrate up` sur pb_data vierge — 29 appliquées, état final products.id (min11/max40/underscore) + productName requis conforme (sqlite sur la copie).
- Import pipeline : `/tmp/orchestrate/import-upsert-t11.log` — exit 0, 3838 patched, 1 failed (teamdocs −1, verdict attendu) ; post-run sqlite copie : 993 produits, 0 nom vide, ids 15/15.
- Suites zone + check : `/tmp/orchestrate/tests-products-zone-t11.log` (7 fichiers / 33 tests vert), `/tmp/orchestrate/check-t11.log` (0 erreur / 6 warnings — canon).

## Décisions par ticket

- **01** : le « nom requis » du critère 1 venu en 5e migration manuelle (`1791920000_products_productname_required.js`) — le lot console ne le portait pas ; committé avec lui pour tenir « versionnées ensemble ». Sondes et import passés sur instance jetable 8091 (kill du dev PB user refusé sandbox) — même données, zéro impact sur le dev 8090. Vérif pipeline en mode `--upsert` (cible peuplée, pas de purge) ; `4-fix-timestamps` non requis (timestamps bumpés sur la copie jetable seulement). WIP étranger croisé (`.gitignore`, gate-recheck T12) : non touché, non committé.
- **01 (nettoyage)** : instance jetable 8091 (`serve` sur `/tmp/opencode/pb-t11-copy`) **arrêtée par l'user** après le run (13-10) — plus rien ne tourne côté implementer ; le dev 8090 (`dev:all` user) n'a jamais été touché. La copie jetable reste dans `/tmp/opencode/pb-t11-copy` (et le vierge `/tmp/opencode/pb-t11-fresh`) si une re-mesure est utile.

## Deferred findings

- Découvertes accidentelles + tag `!` / `S2` / `?` — l'orchestrateur les verse au backlog en fin de run, jamais les sub-agents.
- `?` AGENTS.md drift (préexistant) : « pb_migrations (13 collections) » vs 19 collections dans `pb-generated.ts` et 22 fichiers de migrations après le ticket 01 — à rafraîchir quand la Phase 1 se referme.
- `?` `3-import-pb.ts --upsert` : les produits présents en PB mais absents des sources (11 sur le dev : créés runtime après le dernier import full) ne sont ni purgés ni verdictés — le count-delta ne compare que son propre POST/PATCH vs sources. Conforme au contrat « NO purge » du mode, mais à savoir en lisant les chiffres (982 patched ≠ 993 en base).
