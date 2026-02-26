/**
 * Utilitaires de sérialisation pour IndexedDB
 *
 * Convertit les objets réactifs Svelte 5 ($state) en objets plain JavaScript
 * pour éviter l'erreur "Proxy object could not be cloned"
 */

import type { RecipeInfo } from "../types/recipes.types";

/**
 * Sérialise un objet RecipeInfo en retirant les Proxies Svelte
 */
export function serializeRecipeInfo(recipeInfo: RecipeInfo): RecipeInfo {
  return {
    materiel: [...recipeInfo.materiel],
    categories: [...recipeInfo.categories],
    regimes: [...recipeInfo.regimes],
  };
}

/**
 * Sérialise profondément un objet en retirant tous les Proxies
 * Utile pour les structures complexes
 */
export function deepSerialize<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Primitives
  if (typeof obj !== "object") {
    return obj;
  }

  // Arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSerialize(item)) as T;
  }

  // Objects
  const serialized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      serialized[key] = deepSerialize(obj[key]);
    }
  }
  return serialized as T;
}

/**
 * Clone un objet en profondeur via JSON (simple mais efficace)
 * Alternative plus rapide pour les structures simples
 */
export function jsonClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
