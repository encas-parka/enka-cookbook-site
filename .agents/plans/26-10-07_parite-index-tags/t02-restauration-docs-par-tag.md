# T02 — Restaurer « documents liés par tag » (fonctionnel, pas une coquille)

**Sources** : run.md § Faits établis ; code pré-suppression `git show 8d4541a9^:<path>` ; référence fonctionnelle site (`enka-cookbook-site/svelte-app/src/lib/{components/documents/EventDocumentsBloc.svelte,stores/TeamdocsStore.svelte.ts}`)
**Prérequis** : T01 (chaîne + boots partagés)

## Objectif

Rendre la fonctionnalité réellement fonctionnelle (elle n'a jamais eu sa couche données, même en prod) : champ `tags` sur teamdocs PB, code client restauré, mapping pipeline, tests.

## Phase schéma

- Migration delta : `tags` **json** (array de strings — pattern repo des champs json + `safeJsonParse`) sur `teamdocs`. Nullable (les docs existants n'en ont pas). down() retire.
- Vérifier la définition originelle (`git log --all --oneline -- '*1700000009*'` / `git show` sur le fichier supprimé) pour le nommage exact — l'intention d'origine.
- Sondes curl : create teamdoc avec `tags: ["produit","recette"]` → 200 + persisté (SQL) ; sans tags → 200. Rules inchangées (le champ traverse les rules existantes eventId/teamId).

## Phase pipeline

- `2-transform-data.ts` §9 : `tags: awDoc.tags || null` (tolérance standard — prod n'a pas l'attribut → null). Dry-run : 22 rows, tags null partout, zéro crash.

## Phase client (restauration depuis git)

- Reprendre les hunks supprimés par `8d4541a9` (NE PAS revert le commit entier — les fichiers portent aussi des fixes du triage) : `EventDocumentsBloc.svelte` (re-créer), `DocCard`, portions de `CreateDocumentPage`, `DocumentListPage`, `EditDocumentPage`, `EventDocumentCreatePage`, `EventDocumentEditPage`, `EventMaterielPage`, `EventProductsPage`, `TeamdocsStore.svelte.ts` (`getEventDocumentsByTag`, collecte des tags d'équipe), type `EnrichedTeamdoc.tags: string[]`.
- **Parité site** : le bloc doit apparaître sur les MÊMES pages que la référence : EventMaterielPage, EventProductsPage (tag `produit` confirmé), EventRecipesPage, EventTodosPage — vérifier les tag strings exactes côté site (`grep "tag=" site/…/routes/Event*Page.svelte`) et les réutiliser à l'identique.
- Les json teamdocs se parsent avec le pattern repo (`safeJsonParse`) — vérifier comment les autres json synchronisés sont consommés (le store est un SvelteMap générique).
- Tests : unitaire store (`getEventDocumentsByTag` filtre eventId+tag) dans le harness existant ; non-vacuité des gardes si nouvelles.

## Contraintes

- `check-legacy` = **0** — NE PAS régresser (typage propre dès l'écriture).
- Canons : check 0/6 ; test 104/104 → canon final = total nouveau.
- Pas de `bun run build` (portail orchestrateur).
- Si un choix de design diverge (ex. nom du champ, shape json vs select), suivre la référence site OU l'intention 1700000009, et documenter.

## Critères

- [ ] Migration tags appliquée (copie puis dev, backups) ; sondes curl create/persist
- [ ] Pipeline : mapping tags + dry-run 22 rows (verdict loggé)
- [ ] Client restauré : bloc sur les 4 pages (tags identiques au site), store + type complétés
- [ ] Tests verts ; canons verts (legacy 0)
- [ ] run.md amendé (journal T02 : décisions, preuves)
