# 03: Primitive upsert de la couche de synchronisation

**What to build:** la couche de synchronisation expose l'upsert (créer-ou-mettre-à-jour à id stable) à l'unité et en lot : quand l'appelant ne sait pas si le record existe déjà côté serveur, la primitive décide (mise à jour si présent, création sinon), avec miroir local et annulation optimiste. La documentation décrit le code réel.

**Blocked by:** 01 (contraintes d'id posées).

**Status:** done (13-10 — implementer ticket 03, commits ef9f9d31 + a12d6b0b + 9e7f0f98)

- [x] Upsert de lot disponible (mise à jour si l'id existe, création sinon) + variante groupée + sucre unitaire via lot d'une opération
- [x] Typage de l'id client sur les créations de lot corrigé (parité avec la création unitaire)
- [x] Annulation optimiste sur échec (restauration des instantanés, suppression des lignes neuves orphelines)
- [x] Documentation nettoyée des sections héritées d'un autre projet ; seuls les comportements réels sont décrits
- [x] Tests traversant la couture (upsert unitaire + lot, miroir local, rollback), suivant le modèle d'intégration du projet frère

Notes d'atterrissage (13-10) :

- Tests à la couture via le harnais maison (fake PB + fake-indexeddb), pas le modèle « vrai PB + authenticateAdmin » du frère : le harnais mig n'a pas de machinerie admin/seed serveur — le dispatch posait « si le harness le permet ». Le batch natif est implémenté côté fake avec le wire contract (PUT /records, transactionnel), même style que le prior art `pb-sync-fullchain.test.ts`. 5 tests, log `/tmp/orchestrate/tests-t03-upsert.log`.
- Sucre unitaire `upsert()` et `bulkUpsert()` posés sur `pb-collection.ts` ; PAS de branchement store (ticket 04) — aucun changement de comportement des stores.
- Le harnais `stub-pb.ts` a été refactoré au passage (helpers record partagés entre `collection()` et le nouveau `createBatch()`) : 14 suites consommatrices re-validées vert (68 tests, log `/tmp/orchestrate/tests-t03-harness-regression.log`).
