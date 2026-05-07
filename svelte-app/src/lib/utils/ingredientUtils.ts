/**
 * Utilitaires pour la validation et le parsing des ingrédients
 * Gère la transformation entre RecipeIngredient[] et le format DB (objets natifs)
 */

import type { RecipeIngredient } from "../types/recipes.types";

// =============================================================================
// PARSING DEPUIS DB (objets natifs ou legacy string[])
// =============================================================================

/**
 * Parse des ingrédients depuis la DB (objets natifs PB ou legacy string[])
 * Accepte RecipeIngredient[] (natif PB), string[] (legacy Appwrite), null/undefined
 */
export function parseIngredients(
  ingredients: RecipeIngredient[] | string[] | null | undefined,
): RecipeIngredient[] {
  if (!ingredients || !Array.isArray(ingredients)) {
    return [];
  }

  return ingredients
    .map((item) => {
      if (
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.uuid === "string"
      ) {
        return item as RecipeIngredient;
      }

      if (typeof item === "string") {
        try {
          const parsed = JSON.parse(item);
          if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.uuid === "string"
          ) {
            return parsed as RecipeIngredient;
          }
        } catch {
          console.warn("[ingredientUtils] Failed to parse ingredient:", item);
        }
      }

      return null;
    })
    .filter(
      (ingredient): ingredient is RecipeIngredient => ingredient !== null,
    );
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Vérifie si un ingrédient est valide
 */
export function isValidIngredient(
  ingredient: any,
): ingredient is RecipeIngredient {
  return (
    ingredient &&
    typeof ingredient === "object" &&
    typeof ingredient.uuid === "string" &&
    typeof ingredient.name === "string" &&
    typeof ingredient.originalQuantity === "number" &&
    typeof ingredient.originalUnit === "string" &&
    typeof ingredient.normalizedQuantity === "number" &&
    typeof ingredient.normalizedUnit === "string" &&
    typeof ingredient.comment === "string" &&
    Array.isArray(ingredient.allergens) &&
    typeof ingredient.type === "string"
  );
}

/**
 * Nettoie et valide un tableau d'ingrédients
 */
export function cleanIngredients(
  ingredients: RecipeIngredient[],
): RecipeIngredient[] {
  return ingredients.filter(isValidIngredient);
}

// =============================================================================
// UTILITAIRES SUPPLÉMENTAIRES
// =============================================================================

/**
 * Extrait uniquement les noms des ingrédients (pour le filtrage)
 */
export function getIngredientNames(ingredients: RecipeIngredient[]): string[] {
  return ingredients.map((ingredient) => ingredient.name);
}

/**
 * Extrait les types uniques d'ingrédients
 */
export function getIngredientTypes(ingredients: RecipeIngredient[]): string[] {
  const types = ingredients.map((ingredient) => ingredient.type);
  return [...new Set(types)]; // Déduplication
}

/**
 * Extrait tous les allergènes des ingrédients
 */
export function getAllAllergens(ingredients: RecipeIngredient[]): string[] {
  const allAllergens = ingredients.flatMap(
    (ingredient) => ingredient.allergens || [],
  );
  return [...new Set(allAllergens)]; // Déduplication
}
