# T14 — Split `syncInitial()` / `syncRevalidate()` (port Étape 5)

**Sources** : port-hardening Étape 5 (5f7546c7) ; synthèse Lot 4 item 5
**Prérequis** : t13 (le delta scopé est la mécanique commune)

## Objectif

Séparer le chargement initial (toggle `#loading`, premier paint) de la revalidation silencieuse (post-visibility/reconnect, sans flash UI) sur les 6 stores — prépare l'orchestrateur t15.

## Mécanique

- `syncInitial` = corps actuel de `syncFromRemote` (toggle `#loading`).
- `syncRevalidate` = même delta SANS toggle, gardes internes (déjà en cours → skip), **rethrow** pour l'orchestrateur.
- Renommage **d'un coup** (recommandation du rapport, worktree pré-prod) : supprimer `syncFromRemote` et migrer tous les call sites en une passe — grep `syncFromRemote` = filet (0 occurrence restante attendue, sinon @deprecated explicite).

## Call sites

Stores : `EventsStore`, `TeamdocsStore`, `MaterielStore`, `NativeTeamsStore`, `ProductsStore`, `RecipesStore` (.svelte.ts). Call sites : `App.svelte`, `GlobalState.svelte.ts`, pages Join/Notification, et tout grep `syncFromRemote` supplémentaire. Terrain à plugins d'oublis : le grep final est LE critère.

## Validation

- `bun run check` + check-legacy delta 0 + `bun run test` (canon t12/t13) — les tests du harness doivent rester verts (adapter les mocks si les tests nomment syncFromRemote).
- Le toggle `#loading` ne doit plus se déclencher sur revalidate : un test de réactivité du harness peut le prouver (si le harness couvre ; sinon assertion de code + note).

## Critères

- [x] `syncInitial`/`syncRevalidate` en place sur les 6 stores (grep `syncFromRemote` = 0 occurrence, ou @deprecated documentée) — grep live = 0 (`svelte-app/src` + CLAUDE.md ×2 ; docs historiques `.agents/plans/` non réécrites, cf. journal T14)
- [x] Call sites migrés ; revalidate sans toggle — prouvé par test harness (`syncRevalidate()` n'atteint jamais `#loading`, mid-flight et post ; garde déjà-en-cours prouvée discriminante par red-check)
- [x] Canons verts ; run.md amendé (journal T14)
