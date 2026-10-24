# ADR 0004 — Tests composants pour les contrats de données de l'UI ; le reste à la passe click-through

## Contexte

L'app a deux couches de test automatisé : fonctions pures (utils) et stack
client intégrée (vrai store + vrai pb-sync + transport PocketBase factice).
Tout ce qui est au-dessus — le rendu réel, le vrai serveur, les parcours —
repose sur la passe click-through manuelle, dont la checklist accumulée
(650+ lignes) mesure le coût. Deux faits ont motivé une couche intermédiaire :

- Le bug « réformer puis Enregistrer » (2026-10, lot granularité des
  dommages) : un composant pouvait **corrompre des données** (restaurer
  silencieusement un stock réformé) — un bug de couche UI, inaccessible aux
  tests store/utils, attrapé par l'audit de revue mais resté sans garde
  ensuite.
- Les tests composants sont l'étage standard manquant de la pyramide :
  monter un composant réel en jsdom, interagir, asserte la structure et le
  texte. La config vitest du repo a déjà tout le nécessaire (runtime client
  Svelte 5 via `resolve.conditions: ["browser"]`, jsdom, harness).

## Décision

1. **Tout composant porteur d'un contrat de données a un test composant** :
   - toute écriture déclenchée depuis l'UI (gestes, submit, suppression) ;
   - tout affichage d'état dérivé (badges, libellés conditionnels) ;
   - tout contrat de validation (dirty/save, bornage de saisie).
   Les composants de présentation pure (layout, style) n'en ont pas besoin.
2. **Outillage** : montage sans lib de rendu — `mount`/`unmount`/
   `flushSync` de Svelte 5 via le helper `src/lib/test/mount-svelte.ts`,
   requêtes DOM natives ; `@testing-library/user-event` pour les
   interactions (séquences réalistes). `window.matchMedia` est stubé au
   harness setup (jsdom ne l'implémente pas ; `svelte/reactivity/window`
   l'exige à l'import).
3. **Pitfall jsdom documenté** : sur un composant qui réassigne une prop
   `$bindable` dans son handler, la délégation d'événements ne délivre
   qu'un seul événement fiable par montage — écrire les scénarios à **une
   interaction par montage** (état initial via props). Les chaînes async
   **déclenchées par une interaction** (update optimiste + liveQuery +
   resync) s'attendent par **condition (polling)**, jamais par un nombre
   de ticks figé — le seed de setup, lui, garde la convention
   `waitForTick` du harness.
4. **Le click-through manuel garde** : la cohérence visuelle (jsdom ne fait
   aucun layout), les décisions produit, et un parcours de bout en bout
   condensé par lot. La checklist click-through ne contient plus que ce qui
   n'est pas couvert automatiquement.

## Alternatives rejetées

- **Couverture composants généralisée** (« tester tous les composants ») :
  coût de maintenance élevé, fausse confiance (jsdom ne rend ni CSS ni
  layout) — la valeur concentre sur les contrats de données.
- **E2E navigateur piloté (Playwright)** : couvrirait les parcours, au prix
  d'une infrastructure lourde (binaires, flakiness, CI) — à réévaluer
  seulement si les passes manuelles redeviennent le goulot.
- **Garde d'intégration live PocketBase (règles API)** : **différée, pas
  rejetée** — les write paths actuels sont simples et les règles stables ;
  à construire (en calquant les primitives de `scripts_dev/migrate.ts`)
  le jour où les règles évoluent (multi-rôles, partages) ou après un
  incident règle/coercition.

## Conséquences

- Les exigences opérationnelles vivent dans `docs/svelte-app.md`
  § Canons de vérification ; `AGENTS.md` y renvoie avant toute UI.
- Chaque nouveau lot UI réduit sa passe click-through à ses items visuels
  et produit.
- Le premier lot appliqué : MaterielForm (gestes, resync, rebut),
  MaterielCard (badge d'état dérivé), MaterielFilters (états dérivés) —
  16 tests.
