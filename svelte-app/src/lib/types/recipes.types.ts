/**
 * Types pour le système de recettes et ingrédients
 */

import type { Recettes } from "./pb";
import { RecipesTypeROptions, RecipesStatusOptions } from "./pb-generated";
import type { Astuce } from "../utils/recipeUtils";

export { RecipesTypeROptions as RecettesTypeR, RecipesStatusOptions as RecettesStatus };

// =============================================================================
// INGRÉDIENTS
// =============================================================================

/**
 * Ingrédient tel que chargé depuis data.json (Hugo)
 * Format compressé avec clés abrégées pour optimiser la taille du fichier
 */
export interface Ingredient {
  u: string; // UUID court (ex: "xo0ibs")
  n: string; // Nom (ex: "Abricot")
  t: string; // Type (ex: "legumes", "epices", etc.)
  a?: string[]; // Allergènes optionnels (ex: ["Sésame"])
  pF?: boolean; // Produit frais
  pS?: boolean; // Produit surgelé
  saisons?: string[]; // Saisons (ex: ["printemps", "ete"])
}

/** Ingrédient enrichi côté client */
export interface EnrichedIngredient extends Ingredient {
  searchableText?: string;
}

// =============================================================================
// RECETTES - Types basés sur PocketBase
// =============================================================================

/**
 * @deprecated Use Recettes directly (alias for backward compatibility)
 */
export type RecipeFromAppwrite = Recettes;

/**
 * Format parsé pour affichage dans l'UI
 * Les ingrédients et astuces sont parsés depuis JSON
 */
export type RecipeForDisplay = Omit<Recettes, "ingredients" | "astuces"> & {
  ingredients: RecipeIngredient[];
  astuces: Astuce[];
};

/**
 * @deprecated Use RecipeForDisplay directly
 */
export type RecipeData = RecipeForDisplay;

// =============================================================================
// INDEX DE RECETTES
// =============================================================================

/**
 * Entrée d'index de recette (depuis data.json ou PocketBase)
 * Contient uniquement les champs nécessaires pour le filtrage rapide et l'affichage
 */
export type RecipeIndexEntry = Pick<
  Recettes,
  | "title"
  | "typeR"
  | "categories"
  | "regime"
  | "draft"
  | "materiel"
  | "region"
  | "serveHot"
  | "cuisson"
  | "check"
  | "saison"
  | "permissionWrite"
  | "lockedBy"
  | "plate"
  | "createdBy"
  | "id"
  | "created"
  | "updated"
> & {
  ingredients: string[];
  auteur?: string;
  rootRecipeId?: string | null;
  versionLabel?: string | null;
  teams?: string[] | null;
  status?: RecipesStatusOptions;
};

// =============================================================================
// INGRÉDIENTS DANS UNE RECETTE
// =============================================================================

/** Ingrédient dans une recette (depuis recipe.json) */
export interface RecipeIngredient {
  uuid: string;
  name: string;
  originalQuantity: number;
  originalUnit: string;
  normalizedQuantity: number;
  normalizedUnit: string;
  comment: string;
  allergens: string[];
  type: string;
  pF?: boolean;
  pS?: boolean;
}

/** Ingrédient scalé pour un nombre de convives */
export interface ScaledIngredient extends RecipeIngredient {
  scaledQuantity: number;
  scaleFactor: number;
}

// =============================================================================
// RECIPE INFO (depuis recipe-info.json)
// =============================================================================

export interface RecipeInfo {
  materiel: string[];
  categories: string[];
  regimes: string[];
}

// =============================================================================
// CACHE & METADATA
// =============================================================================

export interface IngredientsCacheMetadata {
  lastSync: string | null;
  dataJsonHash: string | null;
  ingredientsCount: number;
}

export interface RecipeDataCacheMetadata {
  lastSync: string | null;
  dataJsonHash: string | null;
  ingredientsCount: number;
}

export interface RecipesCacheMetadata {
  buildTimestamp: number | null;
  lastAppwriteSync: string | null; // TODO: rename to lastPBSync after migration
  recipesCount: number;
  cacheVersion?: number;
  migrationVersion: number;
  syncVersion?: number;
}

// =============================================================================
// TYPES DE CRÉATION/MISE À JOUR
// =============================================================================

/** Données pour créer une recette (exclut id, created, updated auto-générés) */
export type CreateRecipeData = Omit<Recettes, "id" | "created" | "updated">;

/** Données pour mettre à jour une recette */
export type UpdateRecipeData = Partial<CreateRecipeData>;

/** Données pour créer un nouvel ingrédient */
export interface CreateIngredientData {
  name: string;
  type: string;
  allergens: string[];
  pF: boolean;
  pS: boolean;
  saisons?: string[];
}
