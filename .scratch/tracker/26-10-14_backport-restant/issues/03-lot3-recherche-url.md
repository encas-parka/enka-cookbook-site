# Lot 3 — Recherche recettes (C) + sync filtres↔URL (G) — investigation design d'abord

## C — recherche dans les titres de recettes

Sœur : `components/eventProducts/ProductsFilters.svelte:89` (`onchange → setSearchInRecipes(…)`),
store `ProductsStore.svelte.ts:192,520,1275-1276,1505,2043`. Mig : `setSearchInRecipes` absent (store + filtre) ;
le store mig n'a que `searchQuery` ([ProductsStore.svelte.ts](svelte-app/src/lib/stores/ProductsStore.svelte.ts) `:554-557`).

## G — filtres synchronisés avec l'URL (commit sœur `14dde0a3`)

Deep-links de filtres + persistance au rechargement. Infra mig existante : [`searchParams`](svelte-app/src/lib/router/index.ts)
(`:65`, via `sv-router`) — déjà utilisé par `RecipesListPage`, pas par les filtres produits.

## Investigation demandée (avant implémentation)

1. Cartographier le flux d'état des filtres mig (`#filters`, `matchesFilters`, reconstructions `#groups`) et le point de branchement sœur.
2. Proposer le design de sync bidirectionnelle (lire au montage, écrire au changement + debounce) **sans boucle réactive**
   (écrire → notifié → ré-écrire), compatible `sv-router` `searchParams`.
3. Plan de tests (dont un test de non-boucle).

Livrable : note courte dans ce dossier (`design-lot3.md`). L'implémentation suivra sur la base de cette note.
Périmètre lecture seule — **aucune modification de code**.
