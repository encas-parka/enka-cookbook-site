/**
 * RecipeEventModel - Modèle pour gérer le scaling d'une recette pour un événement
 *
 * Version 2.0 - Utilise les données pré-calculées du JSON Hugo
 *
 * Changements par rapport à v1:
 * - Utilise RecipeData depuis recipes.types.ts (avec RecipeIngredient pré-parsé)
 * - Les conversions d'unités sont déjà faites par Hugo (normalizedQuantity/Unit)
 * - Plus besoin de UnitConverter pour les recettes statiques
 * - Garde uniquement la logique de scaling (règle de 3)
 */

import type { RecipeData, RecipeIngredient } from "../types/recipes.types";

/**
 * Ingrédient scalé pour un événement
 */
export interface ScaledIngredient extends RecipeIngredient {
  scaledQuantity: number; // Quantité normalisée scalée
  scaleFactor: number; // Facteur appliqué
}

/**
 * Modèle réactif pour une recette dans un événement
 * Gère le scaling des quantités en fonction du nombre de convives
 */
export class RecipeEventModel {
  // Données de base de la recette (depuis RecipesStore)
  baseData = $state<RecipeData>({} as RecipeData);

  // Nombre de convives cible (réactif)
  targetGuests = $state<number>(1);

  constructor(recipeData: RecipeData, initialGuests?: number) {
    this.baseData = recipeData;
    this.targetGuests = initialGuests || recipeData.plate;
  }

  /**
   * Facteur de scaling (règle de 3)
   * Réactif - se recalcule automatiquement quand targetGuests change
   */
  get scaleFactor(): number {
    const base = this.baseData.plate || 1;
    const target = this.targetGuests || 1;
    return target / base;
  }

  /**
   * Liste des ingrédients scalés
   * Réactif - se recalcule automatiquement quand targetGuests ou baseData change
   *
   * Utilise les quantités normalisées pré-calculées par Hugo
   */
  scaledIngredients = $derived.by<ScaledIngredient[]>(() => {
    return this.baseData.ingredients.map((ing) => {
      // Calcul manuel ici pour éviter d'importer scaleIngredient qui est déprécié
      // On utilise directemnet QuantityFormatter pour le formatage si besoin,
      // mais ici on stocke juste la valeur numérique scalée.
      // Cas spécial : "au goût" - ne pas scaler
      const scaledQty =
        ing.normalizedUnit === "au goût"
          ? ing.normalizedQuantity
          : ing.normalizedQuantity * this.scaleFactor;

      return {
        ...ing,
        scaledQuantity: scaledQty,
        scaleFactor: this.scaleFactor,
      };
    });
  });

  /**
   * Met à jour le nombre de convives
   */
  setGuests(guests: number): void {
    if (guests > 0) {
      this.targetGuests = guests;
    }
  }

  /**
   * Réinitialise au nombre de convives de base
   */
  resetToBase(): void {
    this.targetGuests = this.baseData.plate;
  }

  /**
   * Met à jour les données de la recette
   * Utile si la recette est rechargée depuis le store
   */
  updateRecipeData(newData: RecipeData): void {
    this.baseData = newData;
    // Optionnel : réinitialiser targetGuests
    // this.targetGuests = newData.plate;
  }
}
