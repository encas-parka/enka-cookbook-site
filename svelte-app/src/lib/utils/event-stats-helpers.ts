/**
 * Event Stats Helpers
 *
 * Fonctions pures pour calculer les statistiques d'un événement.
 * Ces fonctions sont utilisées avec des $derived dans les composants Svelte 5.
 *
 * Avantages par rapport à EventStatsStore :
 * - Pas de cache statique (évite les bugs de synchronisation)
 * - Fonctions pures testables
 * - Réactivité garantie via Svelte 5 $derived
 * - Utilise directement les données de EnrichedEvent (dateStart, dateEnd, allDates déjà présents)
 */

import type { EnrichedEvent } from "$lib/types/events";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";

// =============================================================================
// FONCTIONS PURES DE CALCUL
// =============================================================================

/**
 * Nombre de repas dans l'événement
 */
export function getMealsCount(event: EnrichedEvent | null): number {
  return event?.meals?.length || 0;
}

/**
 * Nombre total d'invités (tous repas confondus)
 */
export function getTotalGuests(event: EnrichedEvent | null): number {
  if (!event?.meals) return 0;
  return event.meals.reduce((sum, meal) => sum + (meal.guests || 0), 0);
}

/**
 * Nombre total de recettes uniques dans l'événement
 */
export function getTotalRecipes(event: EnrichedEvent | null): number {
  if (!event?.meals) return 0;
  const recipeIds = new Set<string>();
  event.meals.forEach((meal) => {
    meal.recipes?.forEach((r) => {
      if (r.recipeUuid) recipeIds.add(r.recipeUuid);
    });
  });
  return recipeIds.size;
}

/**
 * Nombre de todos dans l'événement
 */
export function getTodosCount(event: EnrichedEvent | null): number {
  return event?.todos?.length || 0;
}

/**
 * Nombre total d'ingrédients uniques dans l'événement
 * Note: Dépend de recipesStore pour récupérer les détails des recettes
 */
export function getTotalIngredients(event: EnrichedEvent | null): number {
  if (!event?.meals) return 0;

  const allIngredients = new Set<string>();

  event.meals.forEach((meal) => {
    if (meal.recipes) {
      meal.recipes.forEach((mealRecipe) => {
        const recipeIndex = recipesStore.getRecipeIndexByUuid(
          mealRecipe.recipeUuid,
        );
        if (recipeIndex?.ingredients) {
          recipeIndex.ingredients.forEach((ing) => allIngredients.add(ing));
        }
      });
    }
  });

  return allIngredients.size;
}

/**
 * Repas triés par date
 */
export function getSortedMeals(event: EnrichedEvent | null) {
  if (!event?.meals) return [];
  return [...event.meals].sort((a, b) => a.date.localeCompare(b.date));
}

// =============================================================================
// CONRIBUTEURS
// =============================================================================

/**
 * Liste des contributeurs de l'événement
 */
export function getContributors(event: EnrichedEvent | null) {
  return event?.contributors || [];
}

/**
 * Statut d'un utilisateur contributeur
 */
export function getContributorStatus(
  event: EnrichedEvent | null,
  userId: string,
): "accepted" | "declined" | "invited" | null {
  const contributor = getContributors(event).find((c) => c.id === userId);
  return contributor?.status || null;
}

/**
 * Vérifie si un utilisateur est contributeur
 */
export function isContributor(
  event: EnrichedEvent | null,
  userId: string,
): boolean {
  return getContributors(event).some((c) => c.id === userId);
}

/**
 * Statistiques des contributeurs
 */
export function getContributorsStats(event: EnrichedEvent | null) {
  const contributors = getContributors(event);

  return {
    total: contributors.length,
    accepted: contributors.filter((c) => c.status === "accepted").length,
    declined: contributors.filter((c) => c.status === "declined").length,
    pending: contributors.filter((c) => c.status === "invited").length,
  };
}

// =============================================================================
// HELPER POUR LES COMPOSANTS
// =============================================================================

/**
 * Liste des recettes manquantes (réclamées par l'event mais absentes du cache)
 */
export function getMissingRecipes(event: EnrichedEvent | null): Set<string> {
  if (!event?.meals) return new Set();

  const missingRecipes = new Set<string>();

  event.meals.forEach((meal) => {
    if (meal.recipes) {
      meal.recipes.forEach((mealRecipe) => {
        const recipeIndex = recipesStore.getRecipeIndexByUuid(
          mealRecipe.recipeUuid,
        );
        if (!recipeIndex) {
          missingRecipes.add(mealRecipe.recipeUuid);
        }
      });
    }
  });

  return missingRecipes;
}

/**
 * Helper pour les composants qui ont besoin de toutes les stats
 * Retourne un objet avec toutes les statistiques calculées
 */
export function useEventStats(event: EnrichedEvent | null) {
  const contributors = getContributors(event);
  const missingRecipes = getMissingRecipes(event);

  return {
    mealsCount: getMealsCount(event),
    totalGuests: getTotalGuests(event),
    totalRecipes: getTotalRecipes(event),
    totalIngredients: getTotalIngredients(event),
    contributors,
    contributorsStats: getContributorsStats(event),
    eventName: event?.name || "",
    // NOTE: dateStart, dateEnd et allDates sont déjà dans EnrichedEvent (hérités de Main)
    startDate: event?.dateStart || null,
    endDate: event?.dateEnd || null,
    missingRecipes,
  };
}
