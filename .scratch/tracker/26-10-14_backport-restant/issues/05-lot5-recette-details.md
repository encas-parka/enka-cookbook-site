# Lot 5 — J : détails recette (`ProductRecipeDetails` + `RecipeDetailDrawer`)

## Contexte

Sœur : `components/eventProducts/ProductRecipeDetails.svelte` + `components/recipes/RecipeDetailDrawer.svelte`
(commits `2fc12a97`, `df120879`, `5cb69301`, `a33901d2`). Mig : **les deux fichiers absents** (vérifié) ;
le lien « aller à la recette » existe déjà ([RecipesManager.svelte](svelte-app/src/lib/components/eventProducts/RecipesManager.svelte) `:80-94`).

## Travail

1. Porter les 2 composants (adaptations : `id` pas `$id`, json natifs, dates PB via `toInputDate` si dates affichées).
2. Brancher : aperçu par carte + tiroir, aux mêmes points que la sœur
   (`routes/EventProductsPage.svelte`, carte produit).
3. Lancer **après le lot 6 ? Non — avant** : les lots 5 et 6 touchent tous deux `EventProductsPage.svelte`,
   ils sont donc **séquentiels (5 puis 6)** pour éviter les conflits.

## Périmètre

2 fichiers neufs + branchement page/carte + tests ciblés si harness adapté. **Ne pas commiter.**
