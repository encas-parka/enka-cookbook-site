/**
 * Utilitaires pour parser et transformer les données de recettes
 */

import type {
  RecipeIngredient,
  RecipeForDisplay,
  RecipeIndexEntry,
} from "../types/recipes.types";
import { ingredientsFromAppwrite } from "./ingredientUtils";

// =============================================================================
// TYPE DE RECETTE - Labels et Icônes (Sprite SVG)
// =============================================================================

/**
 * Mapping des catégories vers les IDs d'icônes dans le sprite SVG
 */
const CATEGORY_ICON_MAP: Record<string, string> = {
  "Bouchées salées": "sandwich",
  Boisson: "cup-soda",
  Cake: "cake-slice",
  "Crèmes dessert": "fast-food-pudding",
  Friture: "fryer",
  Gateau: "cake-slice",
  Pain: "bread",
  "Plat au Four": "oven",
  "Plat en Sauce": "pot",
  Salade: "lettuce",
  Sauce: "sauce",
  Snacking: "hamburger",
  Soupe: "soup",
  "Tarte (salée)": "pizza",
  "Tarte (sucrée)": "pie",
  Tartinade: "tartinade",
};

/**
 * Mapping des types vers les IDs d'icônes (fallback)
 */
const TYPE_ICON_MAP: Record<string, string> = {
  entree: "salad",
  plat: "dish",
  dessert: "fast-food-pudding",
};

/**
 * Type pour le display d'un type/catégorie de recette
 */
export interface TypeDisplay {
  label: string;
  iconId: string; // ID de l'icône dans le sprite SVG
}

/**
 * Retourne le label et l'ID de l'icône pour une recette
 * Priorité : catégorie > type (fallback)
 *
 * @param typeR - Type de recette ("entree", "plat", "dessert")
 * @param category - Catégorie de recette (optionnel)
 *
 * @example
 * getTypeDisplay("plat", "Salad")           // → { label: "Salad", iconId: "lettuce" }
 * getTypeDisplay("plat", undefined)          // → { label: "Plat", iconId: "no-cat" }
 * getTypeDisplay("entree", "Bouchées salées") // → { label: "Bouchées salées", iconId: "bouchees_salees" }
 * getTypeDisplay("plat", "Snacking")         // → { label: "Snacking", iconId: "hamburger" }
 */
export function getTypeDisplay(
  typeR: string,
  category?: string | string[],
): TypeDisplay {
  // Si une catégorie est fournie, l'utiliser en priorité
  const categoryToUse = Array.isArray(category) ? category[0] : category;

  if (categoryToUse && CATEGORY_ICON_MAP[categoryToUse]) {
    return {
      label: categoryToUse,
      iconId: CATEGORY_ICON_MAP[categoryToUse],
    };
  }

  // Sinon, utiliser le type comme fallback
  const label = getTypeLabel(typeR);
  const iconId = TYPE_ICON_MAP[typeR] || "no-cat";

  return { label, iconId };
}

/**
 * Retourne le label localisé pour un type de recette
 *
 * @example
 * getTypeLabel("entree")  // → "Entrée"
 * getTypeLabel("plat")    // → "Plat"
 * getTypeLabel("dessert") // → "Dessert"
 */
export function getTypeLabel(type: string): string {
  switch (type) {
    case "entree":
      return "Entrée";
    case "plat":
      return "Plat";
    case "dessert":
      return "Dessert";
    default:
      return type;
  }
}

// =============================================================================
// ASTUCES - Transformation Appwrite ↔ App
// =============================================================================

/**
 * Type pour une astuce
 */
export interface Astuce {
  astuce: string;
}

/**
 * Convertit les astuces depuis Appwrite (string[] JSON) vers le format applicatif
 *
 * @example
 * // Appwrite: ['{"astuce":"Conseil 1"}', '{"astuce":"Conseil 2"}']
 * // → [{astuce: "Conseil 1"}, {astuce: "Conseil 2"}]
 */
export function astucesFromAppwrite(
  astuces: string[] | null | undefined,
): Astuce[] {
  if (!astuces || !Array.isArray(astuces)) {
    return [];
  }

  return astuces
    .map((astuceStr) => {
      try {
        const parsed = JSON.parse(astuceStr);
        if (parsed && typeof parsed.astuce === "string") {
          return parsed;
        }
        // Fallback: si c'est juste une string
        if (typeof astuceStr === "string") {
          return { astuce: astuceStr };
        }
      } catch (e) {
        console.warn("[recipeUtils] Failed to parse astuce:", astuceStr, e);
      }
      return null;
    })
    .filter((item): item is Astuce => item !== null);
}

/**
 * Convertit les astuces vers Appwrite (string[] JSON)
 *
 * @example
 * // [{astuce: "Conseil 1"}, {astuce: "Conseil 2"}]
 * // → ['{"astuce":"Conseil 1"}', '{"astuce":"Conseil 2"}']
 */
export function astucesToAppwrite(
  astuces: string[] | { astuce: string }[] | null | undefined,
): string[] | null {
  if (!astuces || !Array.isArray(astuces) || astuces.length === 0) {
    return null;
  }

  return astuces.map((astuce) =>
    typeof astuce === "string"
      ? JSON.stringify({ astuce })
      : JSON.stringify(astuce),
  );
}

/**
 * Parse un ingrédient depuis le JSON Hugo
 *
 * Format : {uuid, name, originalQuantity, originalUnit, ...}
 *
 * @param ingredientData - Données depuis recipe.json
 * @returns RecipeIngredient parsé
 */
export function parseRecipeIngredient(ingredientData: any): RecipeIngredient {
  if (
    !ingredientData ||
    typeof ingredientData !== "object" ||
    Array.isArray(ingredientData)
  ) {
    throw new Error(
      `Format d'ingrédient invalide: ${JSON.stringify(ingredientData)}`,
    );
  }

  return {
    uuid: ingredientData.uuid || "",
    name: ingredientData.name || "",
    originalQuantity: ingredientData.originalQuantity || 0,
    originalUnit: ingredientData.originalUnit || "",
    normalizedQuantity: ingredientData.normalizedQuantity || 0,
    normalizedUnit: ingredientData.normalizedUnit || "",
    comment: ingredientData.comment || "",
    allergens: Array.isArray(ingredientData.allergens)
      ? ingredientData.allergens
      : [],
    type: ingredientData.type || "",
    pF: ingredientData.pF ?? false,
    pS: ingredientData.pS ?? false,
  };
}

/**
 * Parse les données complètes d'une recette depuis le JSON Hugo
 *
 * @param rawData - Données brutes depuis recipe.json
 * @returns RecipeForDisplay parsé
 */
export function parseRecipeData(rawData: any): RecipeForDisplay {
  if (!rawData || typeof rawData !== "object") {
    throw new Error("Données de recette invalides");
  }

  // Parser les ingrédients
  const ingredients: RecipeIngredient[] = [];
  if (Array.isArray(rawData.ingredients)) {
    rawData.ingredients.forEach((ingData: any) => {
      try {
        ingredients.push(parseRecipeIngredient(ingData));
      } catch (err) {
        console.warn("[parseRecipeData] Ingrédient invalide ignoré:", err);
      }
    });
  }

  return {
    ...rawData,
    // Mapper 'id' depuis Hugo vers '$id' pour notre format interne
    $id: rawData.$id || rawData.id || "",
    // Mapper 'createdAt'/'updatedAt' depuis Hugo vers '$createdAt'/'$updatedAt' pour notre format interne
    $createdAt: rawData.$createdAt || rawData.createdAt || "",
    $updatedAt: rawData.$updatedAt || rawData.updatedAt || "",
    ingredients,
  };
}

/**
 * Parse une entrée d'index depuis le data.json
 *
 * @param rawData - Données brutes depuis data.json
 * @returns RecipeIndexEntry nettoyé et parsé
 */
export function parseRecipeIndexEntry(rawData: any): RecipeIndexEntry {
  if (!rawData || typeof rawData !== "object") {
    throw new Error("Données d'index de recette invalides");
  }

  // Nettoyer et convertir les ingrédients en tableau de noms seulement
  const ingredients: string[] = [];
  if (Array.isArray(rawData.ingredients)) {
    rawData.ingredients.forEach((ing: any) => {
      if (typeof ing === "string") {
        ingredients.push(ing);
      } else if (ing && typeof ing.name === "string") {
        ingredients.push(ing.name);
      }
    });
  }

  return {
    title: rawData.title || "",
    typeR: rawData.typeR || "",
    categories: Array.isArray(rawData.categories) ? rawData.categories : [],
    regime: rawData.regime || null,
    draft: rawData.draft ?? false,
    materiel: Array.isArray(rawData.materiel) ? rawData.materiel : [],
    region: rawData.region || "",
    serveHot: rawData.serveHot ?? false,
    cuisson: rawData.cuisson ?? false,
    check: rawData.check ?? false,
    saison: Array.isArray(rawData.saison) ? rawData.saison : [],
    permissionWrite: Array.isArray(rawData.permissionWrite)
      ? rawData.permissionWrite
      : [],
    lockedBy: rawData.lockedBy || null,
    plate: rawData.plate ?? 100,
    ingredients,
    auteur: rawData.auteur || "",
    createdBy: rawData.createdBy || "",
    // Mapper 'id' depuis Hugo vers '$id' pour notre format interne
    $id: rawData.$id || rawData.id || "",
    $createdAt: rawData.$createdAt || rawData.createdAt || "",
    $updatedAt: rawData.$updatedAt || rawData.updatedAt || "",
  };
}

/**
 * Convertit une recette Appwrite (Recettes) en entrée d'index (RecipeIndexEntry)
 *
 * @param recipe - Recette brute depuis Appwrite
 * @returns RecipeIndexEntry pour l'index
 */
export function parseAppwriteRecipeToIndexEntry(recipe: any): RecipeIndexEntry {
  // Extraire les noms d'ingrédients
  let ingredientNames: string[] = [];
  if (recipe.ingredients) {
    const ingredients = ingredientsFromAppwrite(recipe.ingredients);
    ingredientNames = ingredients.map((ing) => ing.name);
  }

  return {
    title: recipe.title,
    typeR: recipe.typeR,
    categories: recipe.categories,
    regime: recipe.regime,
    draft: recipe.draft || false,
    saison: recipe.saison,

    // Champs de filtrage rapide
    ingredients: ingredientNames,
    materiel: recipe.materiel,
    region: recipe.region || null,
    serveHot: recipe.serveHot,
    cuisson: recipe.cuisson,
    check: recipe.check,
    auteur: recipe.auteur || recipe.createdBy,

    // Champs de permission
    permissionWrite: recipe.permissionWrite,

    // Champs de gestion
    lockedBy: recipe.lockedBy || null,
    $id: recipe.$id,
    $createdAt: recipe.$createdAt,
    $updatedAt: recipe.$updatedAt,
    createdBy: recipe.createdBy,
    plate: recipe.plate,

    // Champs de versionnage
    rootRecipeId: recipe.rootRecipeId || null,
    versionLabel: recipe.versionLabel || null,
  };
}
