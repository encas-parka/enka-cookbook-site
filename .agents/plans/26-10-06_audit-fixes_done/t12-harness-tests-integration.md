# T12 — Harness de tests d'intégration stores/db-sync (port Étape 8, avant le curseur)

**Sources** : port-hardening §1.12 (2d04928a + e48133c6) et Étape 8 ; §4 Étape 8 (option « avant l'étape 3 » retenue)
**Prérequis** : aucun backend (client pur)

## Objectif

Installer le harness qui permettra de valider en TDD le portage du curseur scopé (t13) : fake-indexeddb + jsdom + `conditions: ["browser"]` + tests de réactivité stores portés contre pb-sync (mock du client PB).

## Contenu

1. `svelte-app/package.json` : devDeps `fake-indexeddb`, `jsdom`.
2. `vitest.config.ts` : `conditions: ["browser"]` pour les tests stores (**sans ça SvelteMap ne redéclenche pas** — fait établi du rapport) ; environnement jsdom sur les tests stores (les tests utils existants restent node).
3. Port des tests de réactivité ProductsStore (side enka-next, commits 2d04928a/e48133c6 — les consulter via `git log`/show si utiles) **adaptés pb-sync** : mock du client PB (les méthodes `initialFetch`/`subscribe`/`create`/`update`/`remove` de `pb-collection.ts` mockées — mocker le SDK ou la collection, au choix le plus robuste).
4. `softReset()` sur ProductsStore et RecipesStore (reset d'état entre tests — pattern side).

## Contraintes

- Les 69 tests existants restent verts (nouveau canon = total).
- Ne pas modifier le code de production (harness only) — si un bug de production est révélé : deferred finding dans run.md, PAS de fix ici.
- Le mock PB doit refléter le CONTRAT réel (format des records `PbDoc`, dates espace PB) pour que t13 soit significatif.

## Critères

- [x] Harness en place ; tests de réactivité portés et verts (au moins un scénario : sync initiale → mutation store réactive) — 6 tests verts sur 2 fichiers, dont le scénario requis (`products-store-reactivity.test.ts`) + delta lexical/realtime/create (`pb-sync-delta-realtime.test.ts`)
- [x] `softReset()` disponible sur ProductsStore/RecipesStore (+ refactor reset/softReset/destroy, destroy async sans call site impacté)
- [x] 69/69 existants verts ; nouveau canon loggé dans run.md (75/75 = 69 + 6)
- [x] `bun run check` 0 err/6 warn ; check-legacy delta 0 (190 = baseline, 0 erreur `__tests__`) ; run.md amendé (journal T12)
