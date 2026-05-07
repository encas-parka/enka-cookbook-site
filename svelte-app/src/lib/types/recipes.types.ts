/**
 * Types pour le système de recettes et ingrédients
 */

import type { Recettes } from "./pb";
import {
  RecipesTypeROptions,
  RecipesStatusOptions,
  type IngredientsRecord,
  type IngredientsTypeOptions,
  type CategoriesRecord,
} from "./pb-generated";
import type { Astuce } from "../utils/recipeUtils";
import type { PbDoc } from "$lib/db-sync/aw-types";

export { RecipesTypeROptions as RecettesTypeR, RecipesStatusOptions as RecettesStatus };

// Types étendus pour bridgeToMap + delta sync (nécessitent id, created, updated)
export type IngredientsDoc = IngredientsRecord & PbDoc;
export type CategoriesDoc = CategoriesRecord & PbDoc;

// =============================================================================
// INGRÉDIENTS
// =============================================================================

/**
 * Ingrédient du catalogue (depuis PocketBase ingredients).
 * Noms de champs normalisés (correspondent directement au schéma PB).
 */
export interface Ingredient {
  ref: string; // Ref court (ex: "xo0ibs") — correspond au champ PB `ref`
  name: string; // Nom (ex: "Abricot")
  type: string; // Type (ex: "legumes", "epices", etc.)
  allergens?: string[]; // Allergènes optionnels (ex: ["Sésame"])
  pF?: boolean; // Produit frais
  pS?: boolean; // Produit surgelé
  saisons?: string[]; // Saisons (ex: ["printemps", "ete"])
}

/** Ingrédient enrichi côté client */
export interface EnrichedIngredient extends Ingredient {
  searchableText?: string;
}

/** Résultat de recherche fuzzy avec score et highlight */
export interface FuzzyIngredientResult {
  ingredient: Ingredient;
  score: number;
  highlighted: string;
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
 * Les ingrédients et astuces sont typés pour l'affichage
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
  ref: string;
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

// =============================================================================
// CONVERTISSEURS IngredientsRecord (PB) ↔ Ingredient (app)
// =============================================================================

/**
 * Convertit un IngredientsDoc (PB + system fields) vers le format Ingredient.
 *
 * Normalise les valeurs par défaut et résout le ref de fallback.
 * La clé de mapping est le `ref` PB (pas le `id` système), car les
 * consommateurs de l'application (`getIngredientByRef`) utilisent
 * la ref métier comme identifiant.
 */
export function toAppIngredient(record: IngredientsRecord & { id?: string }): Ingredient {
  // Le ref PB est l'identifiant principal pour l'app
  // Fallback sur record.id pour les ingrédients créés sans ref explicite
  const ref = record.ref || record.id || "";

  return {
    ref,
    name: record.name,
    type: record.type,
    allergens: (record.allergens as string[]) ?? [],
    pF: record.pF ?? false,
    pS: record.pS ?? false,
    saisons: record.saisons as string[] | undefined,
  };
}

/**
 * Convertit un Ingredient app (noms courts) vers un payload de création
 * PocketBase (noms longs).
 *
 * Utilisé par addIngredient() pour créer un enregistrement avec les
 * bons noms de champs PB.
 */
export function toIngredientsRecord(
  ingredient: Ingredient,
): Omit<IngredientsRecord, "id" | "created" | "updated"> {
  return {
    ref: ingredient.ref,
    name: ingredient.name,
    type: ingredient.type as IngredientsTypeOptions,
    allergens: ingredient.allergens ?? [],
    pF: ingredient.pF ?? false,
    pS: ingredient.pS ?? false,
    saisons: ingredient.saisons ?? [],
  };
}
