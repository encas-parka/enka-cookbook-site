# Lot 3 — Recherche recettes (C) + sync filtres↔URL (G) — note de design

> Investigation lecture seule (branche `mig/pocketbase`). Référence sœur en lecture seule :
> `enka-cookbook-site` + commit `14dde0a3` ("Sync products filters with URL", 25-06).
> Ticket : `issues/03-lot3-recherche-url.md`.

---

## 1. Contexte du ticket

Deux backports indépendants sur les filtres produits :

- **C** — recherche fuzzy étendue aux **titres de recettes** : absent côté mig (store + UI).
- **G** — **deep-links de filtres via l'URL** (persistance reload / back / partage) : absent côté mig,
  alors que l'infra `searchParams` existe et sœur a déjà tranché le design.

Livrable = cette note ; l'implémentation viendra après.

---

## 2. Faits — flux d'état actuel (mig)

### 2.1 État des filtres

| Fait | Référence |
| --- | --- |
| `FiltersState` : `searchQuery`, `selectedStores/Who/ProductTypes/Temperatures`, `temperatureFilter`, `storeFilterMode`, `whoFilterMode`, `deliveryDateFilter`, `completionStatus`, `groupBy`, `sortColumn/Direction` — **pas de `searchInRecipes`** | `svelte-app/src/lib/utils/productsUtils.ts:21-35` |
| `#filters = $state<FiltersState>({…})` (source unique, `$state` profond) | `ProductsStore.svelte.ts:181-195` |
| Getters publics `filters` (`:672-674`), `hasFilters` (`:703-716`), `isSearchActive` (`:718-720`), `activeFiltersDescription` (`:722-761`) | idem |

### 2.2 Flux de reconstruction (documenté en tête de fichier, `ProductsStore.svelte.ts:64-68`)

```
liveQuery → #onDataChange → #productModels + #rebuildGroups
filtres   → setter        → #rebuildGroups          (écriture directe de #filters)
date      → $effect       → #rebuildGroups          (#setupDateRangeEffect, :1040-1050)
```

- `#rebuildGroups()` : `ProductsStore.svelte.ts:545-602` — rebuild **explicite** (pas de `$derived`),
  calcule le fuzzy **à chaque appel** (`:554-559`, `Array.from(#productModels).map(m => m.data)`).
- `#passesFilters()` : `:605-638` — applique `matchesFilters` (`:610`), puis completion (`:613-617`),
  delivery (`:620-627`), date range (`:630-635`).
- `matchesFilters()` : `productsUtils.ts:265-…` — la recherche fuzzy **se combine (AND)** aux autres
  filtres (`:271-275`).
- `setSearchQuery` = `useDebounce(fn, () => 500)` (`ProductsStore.svelte.ts:1214-1228`) et
  **détruit les autres filtres** si la requête est non vide (`:1217-1224`).
- Tous les setters écrivent `#filters` puis appellent `#rebuildGroups()` : `:1230-1357`
  (`toggleProductType`, `setTemperatureFilter`, `setGroupBy`, `toggleStore`, `toggleWho`,
  `setStoreFilterMode`, `setWhoFilterMode`, `setCompletionStatus`, `setDeliveryDateFilter`,
  `handleSort`, `clearFilters`).
- Deux reset complets dupliquent le literal de `#filters` : `clearFilters` `:1340-1357` et
  `reset()` `:2106-2120` → tout champ ajouté doit être ajouté aux **deux**.

### 2.3 Points d'entrée UI

| Fait | Référence |
| --- | --- |
| Filtres : input recherche `value={filters.searchQuery}` + `oninput → setSearchQuery` | `components/eventProducts/ProductsFilters.svelte:60-78` |
| **Second** champ de recherche (mobile) branché sur le même setter | `routes/EventProductsPage.svelte:735-754` |
| Indicateur flottant : `productsStore.activeFiltersDescription` + reset → `clearFilters()` | `components/eventProducts/ActiveFiltersIndicator.svelte:7-9`, `ProductsFilters.svelte:45-52` |
| Montage : `onMount → productsStore.initialize(eventId)` ; re-init idempotente si même event | `EventProductsPage.svelte:167-186`, `ProductsStore.svelte.ts:891-894` |
| Lifecycle effets : création dans `initialize()` (étapes 5 et 7 : `:958`, `:965`), cleanup dans `reset()` (`:2071-2075`) | idem |
| Route `/products` (page autonome, pas partagée) | `router/routes.ts:129` |

### 2.4 État sœur (à backporter)

| Fait | Référence sœur |
| --- | --- |
| `searchInRecipes: boolean` dans `FiltersState` | `site/.../productsUtils.ts:26` |
| Toggle UI « Inclure les titres de recettes » + placeholder conditionnel | `site/.../ProductsFilters.svelte:65-67, 80-91` |
| `setSearchInRecipes(v)` = écrit `#filters` + `#rebuildGroups()` | `site/.../ProductsStore.svelte.ts:1275-1278` |
| Cache fuzzy `#fuzzySearchable: {$id, productName, recipeNames}[]` — reconstruit dans `#onDataChange`, vidé dans `reset()` | `site/.../ProductsStore.svelte.ts:414-419, 495-504, 2026` |
| `computeFuzzySearchMatches(searchable, query, searchInRecipes)` — `keys: searchInRecipes ? ["productName","recipeNames"] : ["productName"]`, `threshold: 0.6`, retour `r.obj.$id` | `site/.../productsUtils.ts:293-304` |
| **Recherche = bypass** des autres filtres (`if (searchQuery) return fuzzy.has(id)`), qui restent donc **préservés** | `site/.../productsUtils.ts:308-315` |
| `#passesFilters` ignore completion + delivery pendant une recherche | sœur `ProductsStore.svelte.ts` (diff `14dde0a3`) |
| `setSearchQuery` ne détruit plus les filtres ; écrit `search=true\|null` (debouncé) | idem (diff) |
| Indicateur contextuel : pendant une recherche affiche `"query"` et son bouton sort de la recherche | sœur `ActiveFiltersIndicator.svelte` (diff `14dde0a3`) |
| `clearFilters` = vidange URL (vue) + reset mémoire (search/tri) | sœur `ProductsStore.svelte.ts:1487-1512` |

### 2.5 Sources de noms de recettes côté mig

- `RecipeOccurrence.r` = nom de recette (`types/store.types.ts:351-361`), porté par
  `ByDateEntry.recipes` (`:363-366`) → récupérable via `EnrichedProduct.byDate[*].recipes[].r`
  (même formule que la sœur : `Object.values(byDate).flatMap(e => e.recipes.map(r => r.r))`).
- ⚠ `EnrichedProduct` **n'a pas** de champ `recipeNames` : le `recipeNames: string[]` de
  `store.types.ts:95` appartient à `NeededConsolidated` → il faut un cache de searchables
  (comme la sœur), pas un champ sur le produit.
- Fonction existante : `computeFuzzySearchMatches(products, query)` — `key: "productName"` unique,
  `threshold: 0.3`, retour `r.obj.id` (`productsUtils.ts:253-263`). fuzzysort `^3.1.0` (identique
  sœur, `svelte-app/package.json:51`).

---

## 3. Faits — infra `searchParams` (sv-router 0.13.0)

| Fait | Référence |
| --- | --- |
| Export `searchParams` depuis `$lib/router` | `svelte-app/src/lib/router/index.ts:20, 65` |
| C'est un wrapper autour de **`SvelteURLSearchParams`** (réactif) ; chaque `set/append/delete/sort` appelle `history.pushState` **ou** `replaceState` | `node_modules/sv-router/src/search-params.svelte.js:1-8, 47-57` |
| Signatures : `set(name, value, {replace?})`, `delete(name, value?, {replace?})` ; `get()` renvoie `string \| number \| boolean \| null` | `sv-router/src/index.d.ts:274-287` |
| `get()` passe par `parseSearchValue` → `'true'→true`, numérique→number : **lire via `String(v)`** | `sv-router/src/helpers/utils.js:167-179` |
| `syncSearchParams(search)` synchronise l'instance réactive à chaque `navigate()` | `sv-router/src/create-router.svelte.js:229-231` |
| Back/forward : `Router.svelte:14` écoute `popstate` → `onNavigate()` → `syncSearchParams` → **l'instance `$state` est mutée en place** → un `$effect` qui lit `searchParams.get()` re-run. Notre `pushState` direct, lui, ne déclenche **pas** `popstate` (pas de double traitement). |
| Lire dans un `$effect` = dépendance trackée sur `searchParams` | doc officielle du module, `router/index.ts:43-64` |
| Précedent in-repo de read-side : `$derived.by(() => searchParams.get(...))` (composant) | `routes/EventRecipesPage.svelte:84-95` |
| Écritures in-repo dans les handlers | `routes/RecipesListPage.svelte:207-235` (mais back géré via `hashchange`, `:303-312` → ⚠ **mort** : le routeur est path-based, `router/index.ts:32-33` — ne pas calquer) |
| Phase 2 : `searchParams` → `$page.url.searchParams` (SvelteKit) — une seule table de correspondance | `.agents/plans/4_routing-sveltekit.md:36` |

### Design sœur retenu (commit `14dde0a3`)

- L'**URL est la source de vérité des filtres "vue"** ; `searchQuery` / `searchInRecipes` / tri
  restent **en mémoire**.
- Write-side : setters → `#applyUrlChanges(changes)` (batch de `set`/`delete`, `null` = supprimer) ;
  **garde d'égalité par clé** (`if (this.#urlGet(k) === v) continue`) → 0 écriture URL si rien ne
  change ; premier changement réel = `pushState`, les suivants = `replaceState` → **exactement une
  entrée d'historique par action utilisateur**.
- Read-side : `#setupUrlFiltersEffect()` = `$effect.root(() => $effect(() => this.#applyUrlFilters()))`,
  créé en fin d'`initialize()` (« 8. URL filters effect »), nettoyé dans `reset()` via
  `#cleanupUrlEffect` — exactement le motif des effets déjà présents côté mig
  (`#setupDateRangeEffect` `:1040-1050`, `#setupMealsSyncEffect` `:1056-1071`, cleanup `:2071-2075`).
- Clés : `status`, `group`, `temp`, `types` (CSV encodé), `stores`, `smode`, `who`, `wmode`,
  `delivery`, `search` (flag de présence). Lecture blindée `String()` (`#urlGet`) + `decodeURIComponent`
  pour les listes (`#urlGetList`).
- `searchQuery` n'est **pas** dans l'URL : seul le flag `search=true` y figure (le Back sort de la
  recherche), le texte lui-même vit en mémoire.

---

## 4. Risque de boucle réactive — analyse Svelte 5 (point critique du design)

Analyse statique du runtime installé (`svelte ^5.55.2`) :

1. `internal_set` notifie dès que `!source.equals(value)` —
   `node_modules/svelte/src/internal/client/reactivity/sources.js:181-186` ; `equals` par défaut est
   `===` strict (`reactivity/equality.js:3-5`), et `mutable_source` passe en `safe_equals`
   (`sources.js:110-118`) → **pour une valeur objet/tableau, TOUTE assignation notifie**, même à
   contenu identique.
2. Une écriture faite **pendant** l'exécution d'un `$effect` reschedule cet effet (commentaire
   explicite `$effect(() => x++)`) — `sources.js:240-252`.
3. Au-delà de la profondeur max : `effect_update_depth_exceeded`
   « *effect reads and writes the same piece of state* » — `reactivity/batch.js:881`,
   `reactivity/errors.js:239-247`.

**Conséquence pour le portage tel quel** : dans la sœur, `#applyUrlFilters()` appelle
`#rebuildGroups()` **à la fin de son propre `$effect`**, or `#rebuildGroups` / `#passesFilters` /
`matchesFilters` **lisent** `#filters.*` (mig : `ProductsStore.svelte.ts:554, 610, 613, 620`,
`productsUtils.ts:271-310`). L'effet devient donc dépendant des sources qu'il réécrit, et les
champs tableau (`selectedProductTypes/Stores/Who`) sont réassignés avec un **nouveau tableau à
chaque run** → auto-invalidation potentielle. Incertitude **haute** (analyse non validée
empiriquement, périmètre lecture seule) : c'est précisément ce que le test de non-boucle §6.3 doit
trancher.

---

## 5. Design proposé (sans boucle réactive)

### 5.1 Trois invariants (à écrire en commentaire au-dessus du bloc)

1. **Read-side = seul écrivain des champs « vue » de `#filters`.** Il ne touche **jamais**
   `searchParams`.
2. **Write-side (setters) = seul écrivain de `searchParams`.** Il ne touche **jamais** `#filters`.
3. **Le read-side ne dépend que de `searchParams`.** `#rebuildGroups()` et toute lecture de
   `#filters` s'exécutent dans `untrack()` → l'effet ne peut jamais se rescheduler lui-même.

Chaque aller-retour URL→store s'arrête en **un** passage : l'effet n'écrit pas l'URL (règle 1), donc
aucune contre-notification.

### 5.2 Read-side

```ts
import { untrack } from "svelte";            // pas encore importé côté mig

#cleanupUrlEffect: (() => void) | null = null;   // à côté de #cleanupDateEffect (:178)

#setupUrlFiltersEffect() {                   // appelé en fin d'initialize(), étape 8 (après :965)
  this.#cleanupUrlEffect?.();
  this.#cleanupUrlEffect = $effect.root(() => {
    $effect(() => {
      // ⬇ SEULES lectures trackées : chaque get() est une dépendance sur searchParams
      const snapshot = this.#readUrlSnapshot();
      // ⬇ écriture de #filters + rebuild, hors tracking (règle 3)
      untrack(() => this.#applyUrlFilters(snapshot));
    });
  });
}
```

- `#readUrlSnapshot()` lit les 10 clés avec `String(searchParams.get(k))` (blindage
  `parseSearchValue`, cf. §3) — c'est ici, et **uniquement ici**, que le tracking est voulu.
- `#applyUrlFilters(snapshot)` : normalisation stricte des enums (`status`, `group`, `temp`,
  `smode`, `wmode`, `delivery`), CSV→`string[]` pour `types/stores/who` (avec
  `decodeURIComponent` tolérant), assignation dans `#filters`, **reset mémoire de `searchQuery`
  si le flag `search` a disparu** (Back) — cette lecture de `searchQuery` doit rester dans le
  `untrack()`, sinon chaque frappe re-run l'effet.
- `untrack()` autour de `#rebuildGroups()` : effet secondaire bénéfique, l'effet ne se re-exécute
  plus sur chaque changement de `#productModels` / dateRange (ce sont `#onDataChange` et
  `#setupDateRangeEffect` `:1040-1050` qui assurent déjà ces rebuilds) — on évite ainsi des
  rebuilds redondants à chaque donnée entrante.
- Garde supplémentaire (défense en profondeur) : n'assigner un champ tableau que s'il diffère
  réellement (égalité élément par élément) → même en cas d'oubli d'`untrack`, le run suivant est
  stable car `equals` (`===`) devient vrai.
- Cleanup : `#cleanupUrlEffect?.(); #cleanupUrlEffect = null;` dans `reset()` à côté de
  `:2071-2075`, sinon un effet survit à un changement d'événement.

### 5.3 Write-side

`#applyUrlChanges(changes: Record<string, string | null>)` repris de la sœur (§3) : garde
d'égalité, `first` → `push`, suivants → `replace`. Puis conversion de **tous** les setters
`ProductsStore.svelte.ts:1214-1357` en écriture d'URL **sans** `#rebuildGroups()` local
(le read-side fait le rebuild). Les deux literals `#filters` (`clearFilters` `:1340-1357`,
`reset()` `:2106-2120`) ne réinitialisent plus les champs vue par assignation brute, mais par
vidange URL + reset mémoire (search/tri), sinon on crée un conflit avec le read-side.

Mapping : `status`, `group`, `temp`, `types`, `stores`, `smode`, `who`, `wmode`, `delivery`,
`search`. **Hors URL** (volontaire, parité sœur) : `searchQuery`, `searchInRecipes`, `sort*`,
`dateRange`.

### 5.4 Couplage obligatoire avec la recherche

Si `setSearchQuery` continue de **détruire** les autres filtres (`:1217-1224`), le read-side les
**ressuscite** à la moindre mutation d'URL → conflit garanti. Le portage de G impose donc le
bypass sœur :

- `matchesFilters` : `if (filters.searchQuery.trim()) return fuzzyMatchedIds?.has(product.id) ?? false;`
  (`productsUtils.ts:271-275`) ;
- `#passesFilters` : envelopper completion + delivery dans `if (!this.isSearchActive)`
  (`ProductsStore.svelte.ts:612-627`, getter `isSearchActive` déjà présent `:718-720`) ;
- `setSearchQuery` : ne toucher que `searchQuery` + `#applyUrlChanges({ search: q.trim() ? "true" : null })`.
- Conséquence UI : `ActiveFiltersIndicator` doit afficher la recherche pendant qu'elle est active
  (parité sœur, sinon l'indicateur devient vide alors que la recherche masque les filtres —
  `ProductsFilters.svelte:93-101` désactive visuellement les autres filtres).

### 5.5 Lot C — recherche dans les titres de recettes

1. `FiltersState.searchInRecipes: boolean` (`productsUtils.ts:21-35`) + init `false` aux
   `:182` / `:1342` / `:2107`, + `setSearchInRecipes(v)` = assign + `#rebuildGroups()` (à placer
   juste après `setSearchQuery`, `:1228`).
2. Cache de searchables dans le store (parité sœur `#fuzzySearchable`) reconstruit **dans
   `#onDataChange`** (et non dans `#rebuildGroups`) — corrige au passage le coût O(P) par frappe
   de `:554-559` ; vidé dans `reset()` à côté de `:2086-2091`.
3. `computeFuzzySearchMatches(searchable, query, searchInRecipes)` :
   `keys: searchInRecipes ? ["productName", "recipeNames"] : ["productName"]`
   (`recipeNames` = `byDate[*].recipes[].r` rejoins, cf. §2.5) ; garder le retour sur `id` (champ
   PB, pas `$id`).
4. UI : toggle dans `ProductsFilters.svelte` sous l'input (parité sœur `:80-91`) + placeholder
   conditionnel (`:65-67`) ; statuer sur le second input mobile `EventProductsPage.svelte:735-754`.
5. Optionnel (parité sœur, hors périmètre strict) : champ mort `selectedTemperatures`
   (`productsUtils.ts:28`, store `:1240-1248`, `hasFilters :709`) — jamais lu par `matchesFilters`.

---

## 6. Plan de tests

Fichier : `svelte-app/src/lib/stores/__tests__/products-store-url-filters.test.ts`
(`@vitest-environment jsdom` + mocks identiques à `products-store-reactivity.test.ts:22-57` ;
canons : `docs/svelte-app.md:56-60` — `resolve.conditions: ["browser"]` déjà posé dans
`vitest.config.ts`). Astuce : dans le test, importer `searchParams` directement depuis
`"sv-router"` (même instance module que celle re-exportée par `$lib/router`) pour éviter de tirer
`routes.ts`/`guards.ts`.

### 6.1 Hydratation (read-side)

1. `history.replaceState(null, "", "/products?status=incomplete&group=store&types=boissons")`
   **avant** `initialize()` → après `waitForTick()` : `filters.completionStatus === "incomplete"`,
   `filters.groupBy === "store"`, `filters.selectedProductTypes = ["boissons"]`, et
   `groupedProducts` reflète le filtre.
2. URL vide → tous les défauts (`:181-195`).

### 6.2 Écriture (write-side) + historique

3. `setCompletionStatus("incomplete")` → `searchParams.get("status")` et `location.search` portent
   la valeur ; `filters.completionStatus` à jour après `waitForTick` (passage read-side).
4. **Idempotence / garde d'égalité** : `spyOn(history, "pushState")` → rappeler un setter avec la
   même valeur ⇒ **0** appel (sinon : `pushState` à chaque run → boucle d'écriture visible).
5. **Une entrée d'historique par action** : `setCompletionStatus("incomplete")` (écrit `status` +
   supprime `delivery`) ⇒ `pushState` appelé **1×** et `replaceState` **≤1×**.
6. Vider : `clearFilters()` → les 10 clés absentes de `location.search`.

### 6.3 Non-boucle (test clé)

7. Après **une** action utilisateur : `spyOn(console, "error")` + spy des deux méthodes history ;
   `await waitForTick(10)` ; assertions :
   - aucun log contenant `effect_update_depth_exceeded` (`svelte/src/internal/client/errors.js:239`)
     ;
   - `pushState` ≤ 1 appel (toute itération supplémentaire du read-side devrait se stabiliser :
     0 écriture URL supplémentaire) ;
   - profondeur bornée : deux snapshots de `productsStore.filters` pris à 10 ticks d'écart sont
     strictement égaux (`JSON.parse(JSON.stringify(...))`) — un read-side qui boucle ne converge
     jamais (nouveaux tableaux à chaque run).
8. **Isolation de la règle 3** : `setSearchQuery("x")` (champ mémoire) ne doit provoquer ni
   `pushState` supplémentaire au-delà du flag `search`, ni rebuild parasite des filtres vue —
   prouve que `searchQuery` est bien `untrack`é.
9. **Back simulé** : `searchParams.delete("status")` (équivalent exact de `syncSearchParams`,
   cf. §3 — le `popstate` réel passe par `Router.svelte:14`, non monté dans un test store) →
   `filters.completionStatus` revient à `"all"` ; idem pour `search` absent + recherche active en
   mémoire → `searchQuery` vidé.

### 6.4 Lot C (fuzzy recettes) & non-régression

10. `makeNeedRow({ recipes dans byDate })` (`harness/fixtures.ts:185-212`) : produit nommé
    « Crème » avec recette « Tarte aux pommes » → `setSearchInRecipes(true)` +
    `setSearchQuery("tarte")` ⇒ visible ; `false` ⇒ masqué.
11. Bypass : `status=incomplete` en URL + recherche active → un produit **complet** correspondant à
    la requête reste affiché ; après `setSearchQuery("")` → le filtre `status` se réapplique
    (préservation).
12. Debounce 500 ms : `vi.useFakeTimers()` + `vi.advanceTimersByTime(500)` (précédent :
    `pb-realtime-signals.test.ts:73,104-106`) → un seul `pushState` pour une série de frappes.
13. Cycle de vie : `reset()` / `softReset()` → plus d'effet URL actif (un setter post-reset ne
    déclenche plus de read-side) et `#filters` remis aux défauts ; `initialize()` d'un 2ᵉ event →
    un seul effet (pas d'empilement).

### 6.5 Canons

`bun run test` (vert) · `bun run check` avant commit critique (`docs/svelte-app.md:56-60`).

---

## 7. ADR et conventions rencontrées

- **Aucun ADR** sur le périmètre : `docs/adr/` ne contient qu'un `.gitkeep` (aucune décision
  formalisée sur routing/filtres).
- `.agents/plans/4_routing-sveltekit.md:36` — table de correspondance Phase 2 :
  `searchParams` → `$page.url.searchParams` → **confiner toute l'URL-sync dans le store**
  (un seul fichier à porter en Phase 2).
- `docs/svelte-app.md:39-44` — « jamais copier de données store dans un état local, toujours
  `$derived` » → pas d'état filtre dupliqué dans `EventProductsPage`/`ProductsFilters` ; l'URL
  n'est pas un état local, c'est la source de vérité (règle 1 §5.1).
- `docs/svelte-app.md:31-37` — `searchParams` réactif documenté dans `router/index.ts:43-64`.
- Conventions store : effets créés via `$effect.root` + cleanup dans `reset()`
  (`ProductsStore.svelte.ts:1040-1050, 1056-1071, 2071-2075`) → le nouvel effet suit ce motif.
- Symbole domaine : `FiltersState`, `#rebuildGroups`, `isSearchActive`, `hasFilters`,
  `activeFiltersDescription`, `PbDoc` (non touché).

---

## 8. Incertitudes

| Niveau | Sujet |
| --- | --- |
| **Haute** | Boucle auto-entretenue du design sœur (`#applyUrlFilters` → `#rebuildGroups` lit `#filters` qu'il réécrit, §4). Non vérifiable en lecture seule. Mitigation proposée (`untrack` + garde d'égalité, §5.2) et test §6.3.7. **Décision attendue** : adopter la mitigation ou reproduire la sœur telle quelle. |
| Moyenne | `threshold` fuzzy : mig `0.3` vs sœur `0.6` (`fuzzysort` 3.1.0, `denormalizeScore` — seuil plus haut = plus strict). Avec `keys` multiples, les hits sur titres de recettes sont plus faibles : un portage à `0.6` peut masquer des résultats. À arbitrer (parité sœur vs régression perçue). |
| Moyenne | `searchQuery` hors URL : pas de deep-link de la requête elle-même (seul le flag `search`), donc reload = filtres conservés mais texte de recherche perdu. Parité sœur assumée — à confirmer. |
| Moyenne | Effet store singleton **survit à la page** : naviguer hors `/products` vide les params (`syncSearchParams` à chaque `navigate`, `create-router.svelte.js:229-231`) → les filtres vue reviennent au défaut. Accepté (identique à la sœur) ; alternative = lifetime montée/démontée de la page. |
| Basse | `hasFilters` (`:703-716`) ignore `groupBy`/tri → bouton « Tout effacer » (`ProductsFilters.svelte:45-52`) désactivé si seul `group=store` diffère (parité sœur, comportement existant). |
| Basse | Listener `hashchange` de `RecipesListPage.svelte:303-312` probablement mort (routeur path-based, `router/index.ts:32-33`) → ne pas copier ce pattern de back-handling. |
| Basse | Deux champs de recherche (`ProductsFilters.svelte:62`, `EventProductsPage.svelte:741`) : le placeholder/toggle C doit être décidée pour les deux. |
| Basse | Champ mort `selectedTemperatures` (§5.5.5) : suppression à faire ou non dans ce lot. |

---

*Note rédigée en investigation lecture seule : seul ce fichier a été écrit, aucun fichier du codebase n'a été modifié.*
