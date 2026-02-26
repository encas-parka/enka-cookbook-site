/**
 * Utilitaires pour la conversion des ingrédients entre différents formats
 * Gère la transformation entre RecipeIngredient[] et string[] (Appwrite)
 */

import type { RecipeIngredient } from '../types/recipes.types';

// =============================================================================
// CONVERSION VERS APPWRITE (string[])
// =============================================================================

/**
 * Convertit un tableau de RecipeIngredient en string[] pour Appwrite
 * Chaque ingrédient est transformé en JSON stringifié
 */
export function ingredientsToAppwrite(ingredients: RecipeIngredient[]): string[] {
  return ingredients.map(ingredient => JSON.stringify(ingredient));
}

/**
 * Convertit un seul RecipeIngredient en string pour Appwrite
 */
export function ingredientToAppwrite(ingredient: RecipeIngredient): string {
  return JSON.stringify(ingredient);
}

// =============================================================================
// CONVERSION DEPUIS APPWRITE (string[])
// =============================================================================

/**
 * Convertit un string[] d'Appwrite en RecipeIngredient[]
 * Gère les erreurs de parsing silencieusement
 */
export function ingredientsFromAppwrite(ingredients: string[] | null | undefined): RecipeIngredient[] {
  if (!ingredients || !Array.isArray(ingredients)) {
    return [];
  }

  return ingredients
    .map(ingredientStr => {
      try {
        return JSON.parse(ingredientStr) as RecipeIngredient;
      } catch (error) {
        console.warn('[ingredientUtils] Failed to parse ingredient:', ingredientStr, error);
        return null;
      }
    })
    .filter((ingredient): ingredient is RecipeIngredient => ingredient !== null);
}

/**
 * Convertit un seul string d'Appwrite en RecipeIngredient
 */
export function ingredientFromAppwrite(ingredientStr: string): RecipeIngredient | null {
  try {
    return JSON.parse(ingredientStr) as RecipeIngredient;
  } catch (error) {
    console.warn('[ingredientUtils] Failed to parse ingredient:', ingredientStr, error);
    return null;
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Vérifie si un ingrédient est valide
 */
export function isValidIngredient(ingredient: any): ingredient is RecipeIngredient {
  return (
    ingredient &&
    typeof ingredient === 'object' &&
    typeof ingredient.uuid === 'string' &&
    typeof ingredient.name === 'string' &&
    typeof ingredient.originalQuantity === 'number' &&
    typeof ingredient.originalUnit === 'string' &&
    typeof ingredient.normalizedQuantity === 'number' &&
    typeof ingredient.normalizedUnit === 'string' &&
    typeof ingredient.comment === 'string' &&
    Array.isArray(ingredient.allergens) &&
    typeof ingredient.type === 'string'
  );
}

/**
 * Nettoie et valide un tableau d'ingrédients
 */
export function cleanIngredients(ingredients: RecipeIngredient[]): RecipeIngredient[] {
  return ingredients.filter(isValidIngredient);
}

// =============================================================================
// UTILITAIRES SUPPLÉMENTAIRES
// =============================================================================

/**
 * Extrait uniquement les noms des ingrédients (pour le filtrage)
 */
export function getIngredientNames(ingredients: RecipeIngredient[]): string[] {
  return ingredients.map(ingredient => ingredient.name);
}

/**
 * Extrait les types uniques d'ingrédients
 */
export function getIngredientTypes(ingredients: RecipeIngredient[]): string[] {
  const types = ingredients.map(ingredient => ingredient.type);
  return [...new Set(types)]; // Déduplication
}

/**
 * Extrait tous les allergènes des ingrédients
 */
export function getAllAllergens(ingredients: RecipeIngredient[]): string[] {
  const allAllergens = ingredients.flatMap(ingredient => ingredient.allergens || []);
  return [...new Set(allAllergens)]; // Déduplication
}
