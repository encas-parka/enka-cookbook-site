# 11: Brouillons masqués de la liste publique de recettes

**What to build:** un visiteur non authentifié ne voit plus les recettes en brouillon
dans la liste publique. C'est un filtre UX côté liste : l'accès direct par URL reste
possible, aucune sécurisation serveur n'est demandée.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §5, item `[~]` :
« en tant que 'draft', les recettes ne devraient pas être affichées pour les user
non-auth (pas forcément besoin de sécuriser cela côté serveur, c'est surtout
d'un point de vue ux/ui : le site ne doit afficher les brouillons que pour les
auth, du moins dans la page de liste recipes. Si un user non-auth va directement
sur l'url, c'est ok.) »

> Arbitration investigation 12-10 (`mesuré`) : le marqueur porteur de la liste est
> le booléen `draft`, pas `status` (deux marqueurs coexistent ; défaut création
> constaté : `status: "private"`). Filtre à poser sur `draft` ; listRule recipes
> publique (`""`) confirmée.

**Blocked by:** None (can start immediately).

**Status:** done (13-10)

## Verdict — filtre UX livré au marqueur `draft` (arbitration suivie)

Fait de cohérence demandé par le dispatch, vérifié dans le code : **la création
UI pose bien `draft`** — `$effect` sur RecipeCreatePage/RecipeEditPage
(`check !== true` → `draft = true`), duplication explicite `draft: true`, et le
payload passe par le spread de `createRecipe` (qui pose en parallèle
`status: "private"`). Les deux marqueurs coexistent et divergent structurellement
; le filtre n'en consomme qu'un (`draft`).

Fix (client-only, aucune règle PB touchée — listRule `""` inchangée) :

- `filterRecipesForViewer(recipes, isAuthenticated)` (`$lib/utils/recipeUtils`)
  — liste retournée telle quelle si authentifié, sinon sans les `draft === true` ;
- `RecipesListPage` dérive `visibleRecipes` une fois : les DEUX chemins de
  `filteredRecipes` (recherche fuzzy — qui ignorait les filtres — et filtres)
  et les facettes catégories en partent ;
- accès direct par URL inchangé (`getRecipeByUuid` / vue publique non touchés).

**Tests** : `recipeUtils.test.ts` (4 — rouges avant fix : export absent, log
`/tmp/orchestrate/vitest-t11-red-26-10-13.log` ; verts après, log
`/tmp/orchestrate/vitest-t11-green-26-10-13.log`) ; canon : check 0 erreur /
6 warnings, suite **175/175, 26 fichiers** (logs
`/tmp/orchestrate/tests-check-26-10-13-fix11.log`,
`/tmp/orchestrate/tests-vitest-26-10-13-fix11.log`). Commits : `e2ad02f0`
(test rouge), `8f9320ee` (fix). Re-click-through navigateur (visiteur sur
`/recipe`) = porte T12.

- [x] Liste de recettes en visiteur : les brouillons n'apparaissent pas. (seam unitaire + câblage des deux chemins de la liste et des facettes ; navigateur = T12)
- [x] Liste de recettes en user authentifié : comportement actuel préservé. (liste retournée telle quelle si authentifié — test 2)
- [x] Accès direct par URL d'un brouillon en visiteur : inchangé (toujours ok). (aucun diff sur `getRecipeByUuid` / RecipeDetailPage)
- [x] Test vitest du filtre au seam store, vert. (`recipeUtils.test.ts`, 4/4)
