import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { toastService } from "$lib/services/toast.service.svelte";
import {
  type RecipeIngredient,
  type CreateRecipeData,
  RecettesTypeR,
  type RecipeIndexEntry,
  RecettesStatus,
} from "$lib/types/recipes.types";
import { SvelteSet } from "svelte/reactivity";
import { UnitConverter } from "$lib/utils/UnitConverter";
import { generateSlugUuid35 } from "$lib/utils/slugUtils";
import { deleteRecipeAppwriteWithGithub } from "$lib/services/appwrite-recipes";

// ============================================================================
// TYPES
// ============================================================================

export interface RecipeFormState extends Omit<
  CreateRecipeData,
  | "ingredients"
  | "astuces"
  | "prepAlt"
  | "typeR"
  | "cuisson"
  | "serveHot"
  | "check"
  | "$id"
  | "createdBy"
> {
  $id?: string;
  ingredients: RecipeIngredient[];
  astuces: { astuce: string }[];
  prepAlt: string[];
  typeR: RecettesTypeR | "";
  cuisson: boolean | "";
  serveHot: boolean | "";
  check: boolean | null;
  $createdAt?: string;
  $updatedAt?: string;
  createdBy?: string;
  plate: number;
  quantite_desc: string | null;
  description: string | null;
  region: string | null;
  draft: boolean;
  // Métadonnées (optionnelles car null dans Hugo)
  teams: string[] | null;
  status: RecettesStatus;
  rootRecipeId: string | null;
  versionLabel: string | null;
  manuallyAddedVariants: RecipeIndexEntry[];
  variantsToRemove: RecipeIndexEntry[];
}

export type ValidationError = {
  title?: string;
  versionLabel?: string;
  typeR?: string;
  cuisson?: string;
  serveHot?: string;
  plate?: string;
  quantite_desc?: string;
  description?: string;
  region?: string;
  check?: string;
  ingredients?: string;
  preparation?: string;
  preparation24h?: string;
  astuces?: string[];
};

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Liste des champs pertinents pour le dirty checking et les snapshots.
 */
export const RECIPE_SNAPSHOT_FIELDS = [
  "title",
  "description",
  "plate",
  "preparation",
  "preparation24h",
  "cuisson",
  "serveHot",
  "typeR",
  "categories",
  "regime",
  "saison",
  "ingredients",
  "quantite_desc",
  "auteur",
  "astuces",
  "prepAlt",
  "check",
  "draft",
  "permissionWrite",
  "materiel",
  "region",
  "rootRecipeId",
  "versionLabel",
  "manuallyAddedVariants",
  "variantsToRemove",
] as const;

// ============================================================================
// FACTORIES & TRANSFORMATIONS
// ============================================================================

/**
 * Crée une recette par défaut pour le mode création
 */
export function createDefaultRecipe(): RecipeFormState {
  return {
    title: "",
    plate: 100,
    ingredients: [],
    preparation: "",
    materiel: [],
    preparation24h: "",
    astuces: [],
    categories: [],
    saison: [],
    typeR: "",
    cuisson: "",
    serveHot: "",
    regime: [],
    description: "",
    quantite_desc: "",
    region: "",
    prepAlt: [],
    check: null,
    draft: true,
    lockedBy: null,
    auteur: null,
    publishedAt: null,
    createdBy: globalState.userId || "",
    permissionWrite: [globalState.userId || ""],
    // Métadonnées (valeurs par défaut)
    teams: null,
    status: RecettesStatus.PUBLIC,
    rootRecipeId: null,
    versionLabel: null,
    manuallyAddedVariants: [],
    variantsToRemove: [],
  };
}

/**
 * Transforme les données du store vers le format du formulaire
 */
export function transformStoreDataToForm(
  data: any,
  overrides: Partial<RecipeFormState> = {},
): RecipeFormState {
  return {
    ...data,
    ...overrides,
    categories: data.categories || [],
    saison: data.saison || [],
    ingredients: data.ingredients ?? [],
    astuces: data.astuces ?? [],
    prepAlt: data.prepAlt || [],
    materiel: data.materiel || [],
    regime: data.regime || [],
    check: data.check ?? null,
  } as RecipeFormState;
}

/**
 * Crée un snapshot des champs de la recette pour dirty checking
 */
export function createRecipeSnapshot(recipe: RecipeFormState): string {
  const snapshotData: Record<string, any> = {};
  RECIPE_SNAPSHOT_FIELDS.forEach((field) => {
    snapshotData[field] = recipe[field as keyof RecipeFormState];
  });
  return JSON.stringify(snapshotData);
}

/**
 * Normalise l'état du formulaire vers les types stricts Appwrite
 */
export function normalizeRecipeForAppwrite(
  recipe: RecipeFormState,
): CreateRecipeData {
  return {
    title: recipe.title,
    plate: recipe.plate,
    preparation: recipe.preparation,
    cuisson: recipe.cuisson === "" ? false : (recipe.cuisson as boolean),
    serveHot: recipe.serveHot === "" ? true : (recipe.serveHot as boolean),
    check: recipe.check ?? false,
    typeR: recipe.typeR as RecettesTypeR,
    permissionWrite:
      recipe.permissionWrite && recipe.permissionWrite.length > 0
        ? recipe.permissionWrite
        : [globalState.userId],
    draft: recipe.draft ?? true,
    categories: recipe.categories || [],
    regime: recipe.regime || [],
    saison: recipe.saison || [],
    materiel: recipe.materiel || [],
    quantite_desc: recipe.quantite_desc || null,
    description: recipe.description || null,
    region: recipe.region || null,
    auteur: recipe.auteur || null,
    preparation24h: recipe.preparation24h || null,
    teams: recipe.teams || null,
    status: recipe.status || "private",
    ingredients: [] as string[],
    astuces: null,
    prepAlt: null,
    lockedBy: null,
    publishedAt: null,
    rootRecipeId: recipe.rootRecipeId || null,
    versionLabel: recipe.versionLabel || null,
  } as CreateRecipeData;
}

/**
 * Prépare les données pour la synchronisation GitHub (Hugo)
 */
export function prepareHugoData(
  recipe: RecipeFormState,
  recipeData: any,
  meta: {
    id: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
  },
): any {
  const hugoData = {
    ...recipeData,
    ingredients: recipe.ingredients,
    id: meta.id,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    createdBy: meta.createdBy,
  };
  // @ts-ignore - On retire les clés avec $ pour Hugo
  delete hugoData.$id;
  // @ts-ignore
  delete hugoData.$createdAt;
  // @ts-ignore
  delete hugoData.$updatedAt;
  return hugoData;
}

// ============================================================================
// INGREDIENTS & ALLERGENS
// ============================================================================

/**
 * Normalise la quantité d'un ingrédient en utilisant UnitConverter
 */
export function normalizeIngredientQuantity(
  ingredient: RecipeIngredient,
): RecipeIngredient {
  if (!ingredient.originalQuantity || ingredient.originalQuantity <= 0) {
    return {
      ...ingredient,
      normalizedQuantity: 0,
      normalizedUnit: ingredient.originalUnit || "gr.",
    };
  }

  const conversion = UnitConverter.normalize(
    ingredient.originalQuantity,
    ingredient.originalUnit || "",
    ingredient.name,
  );

  return {
    ...ingredient,
    normalizedQuantity: conversion.quantity,
    normalizedUnit: conversion.unit,
  };
}

/**
 * Normalise tous les ingrédients de la liste
 */
export function normalizeAllIngredients(
  ingredientsList: RecipeIngredient[],
): RecipeIngredient[] {
  return ingredientsList.map((ingredient) =>
    normalizeIngredientQuantity(ingredient),
  );
}

/**
 * Détermine les régimes alimentaires en fonction des allergènes
 */
export function determineAllergensAndRegimes(ingredients: RecipeIngredient[]): {
  regimes: string[];
} {
  const allAllergens = new SvelteSet<string>();
  let hasAnimalProducts = false;

  ingredients.forEach((ingredient) => {
    if (ingredient.allergens && ingredient.allergens.length > 0) {
      ingredient.allergens.forEach((allergen) => allAllergens.add(allergen));
    }
    if (ingredient.type === "animaux") {
      hasAnimalProducts = true;
    }
  });

  const allergenList = Array.from(allAllergens);

  if (
    allergenList.includes("Viande") ||
    allergenList.includes("Poisson") ||
    allergenList.includes("Crustacé") ||
    allergenList.includes("Mollusque") ||
    allergenList.includes("Porc")
  ) {
    hasAnimalProducts = true;
  }

  const regimes: string[] = [];

  if (
    !hasAnimalProducts &&
    !allergenList.includes("Produit laitier") &&
    !allergenList.includes("Oeuf")
  ) {
    regimes.push("vegan");
  } else if (!hasAnimalProducts) {
    regimes.push("vegetarien");
  }

  if (!allergenList.includes("Gluten")) {
    regimes.push("sans-gluten");
  }

  if (!allergenList.includes("Produit laitier")) {
    regimes.push("sans-lactose");
  }

  return { regimes };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Valide la recette et retourne true si elle est valide
 * Gère également l'affichage des erreurs et le scroll vers la première erreur
 */
export function validateRecipe(
  recipe: RecipeFormState,
  validationErrors: { value: ValidationError },
): boolean {
  if (!recipe) return false;

  // Réinitialiser les erreurs
  validationErrors.value = {};

  let hasError = false;

  // Validation du titre
  if (!recipe.title?.trim()) {
    validationErrors.value.title = "Le titre est obligatoire";
    hasError = true;
  } else if (recipe.title.length > 100) {
    validationErrors.value.title =
      "Le titre ne peut pas dépasser 100 caractères";
    hasError = true;
  } else if (
    !/^[a-zA-Z0-9\s\-àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]+$/.test(recipe.title.trim())
  ) {
    validationErrors.value.title =
      "Le titre ne peut contenir que des lettres, chiffres, espaces et tirets";
    hasError = true;
  } else {
    // Vérifier l'unicité :
    // - Interdit si même titre ET aucune version des deux côtés
    // - Interdit si même titre ET même version des deux côtés
    const normalizedTitle = recipe.title.trim().toLowerCase();
    const currentVersion = recipe.versionLabel?.trim().toLowerCase() || "";

    const duplicate = recipesStore.recipesIndex.find((r) => {
      const isSameTitle = r.title.trim().toLowerCase() === normalizedTitle;
      const otherVersion = r.versionLabel?.trim().toLowerCase() || "";

      // Interdit : même titre et (pas de version des deux côtés OU même version des deux côtés)
      const isDuplicate =
        isSameTitle && currentVersion === otherVersion && r.$id !== recipe!.$id;

      return isDuplicate;
    });

    if (duplicate) {
      validationErrors.value.title = recipe.versionLabel
        ? "Une recette avec ce nom et cette version existe déjà"
        : "Une recette porte déjà ce nom (sans version)";
      hasError = true;
    }
  }

  // Validation de la versionLabel
  if (recipe.versionLabel) {
    if (!/^[a-zA-Z0-9\s\-]+$/.test(recipe.versionLabel.trim())) {
      validationErrors.value.versionLabel =
        "La version ne peut contenir que des caractères alphanumériques, des espaces et des tirets";
      hasError = true;
    }
  }

  // Validation du type
  if (!recipe.typeR) {
    validationErrors.value.typeR = "Le type de recette est obligatoire";
    hasError = true;
  }

  // Validation de la cuisson
  if (recipe.cuisson === null || recipe.cuisson === undefined) {
    validationErrors.value.cuisson =
      "Veuillez spécifier si une cuisson est nécessaire";
    hasError = true;
  }

  // Validation du service (chaud/froid)
  if (recipe.serveHot === null || recipe.serveHot === undefined) {
    validationErrors.value.serveHot =
      "Veuillez spécifier la température de service";
    hasError = true;
  }

  // Validation du nombre de couverts (plate)
  if (!recipe.plate || recipe.plate < 1) {
    validationErrors.value.plate =
      "Le nombre de couverts doit être d'au moins 1";
    hasError = true;
  } else if (recipe.plate > 10000) {
    validationErrors.value.plate =
      "Le nombre de couverts ne peut pas dépasser 10 000";
    hasError = true;
  }

  // Validation de la description des quantités
  if (recipe.quantite_desc && recipe.quantite_desc.length > 100) {
    validationErrors.value.quantite_desc =
      "La description des quantités ne peut pas dépasser 100 caractères";
    hasError = true;
  }

  // Validation de la description
  if (recipe.description && recipe.description.length > 200) {
    validationErrors.value.description =
      "La description ne peut pas dépasser 200 caractères";
    hasError = true;
  }

  // Validation de la spécialité (region)
  if (recipe.region && recipe.region.length > 50) {
    validationErrors.value.region =
      "La spécialité ne peut pas dépasser 50 caractères";
    hasError = true;
  }

  // Validation des ingrédients
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    validationErrors.value.ingredients = "Au moins un ingrédient est requis";
    hasError = true;
  }

  // Validation de la préparation
  if (!recipe.preparation?.trim()) {
    validationErrors.value.preparation = "La préparation est obligatoire";
    hasError = true;
  } else if (recipe.preparation.length > 15000) {
    validationErrors.value.preparation =
      "La préparation ne peut pas dépasser 15 000 caractères";
    hasError = true;
  }

  // Validation de la préparation 24h
  if (recipe.preparation24h && recipe.preparation24h.length > 15000) {
    validationErrors.value.preparation24h =
      "La préparation 24h ne peut pas dépasser 15 000 caractères";
    hasError = true;
  }

  // Validation du champ "check" (recette testée)
  if (recipe.check === null || recipe.check === undefined) {
    validationErrors.value.check =
      "Veuillez indiquer si la recette a été testée";
    hasError = true;
  }

  // Validation des astuces
  if (recipe.astuces && recipe.astuces.length > 0) {
    const astucesErrors: string[] = [];
    recipe.astuces.forEach((a, index) => {
      if (a.astuce.length > 250) {
        astucesErrors[index] = "Maximum 250 caractères";
        hasError = true;
      }
    });
    if (astucesErrors.length > 0) {
      validationErrors.value.astuces = astucesErrors;
    }
  }

  // Afficher un toast avec la liste des erreurs et scroller vers la première
  if (hasError) {
    toastService.error("Veuillez corriger les champs invalides", {
      autoCloseDelay: 5000,
    });

    // Scroll vers la première erreur
    setTimeout(() => {
      const firstErrorKey = Object.keys(validationErrors.value)[0];
      const errorIdMap: Record<string, string> = {
        title: "recipe-title",
        typeR: "recipe-type",
        cuisson: "recipe-cuisson",
        serveHot: "recipe-servehot",
        plate: "recipe-plate",
        quantite_desc: "recipe-quantite-desc",
        description: "description",
        region: "recipe-region",
        check: "recipe-check-fieldset",
        ingredients: "recipe-ingredients-editor",
        preparation: "recipe-preparation",
        preparation24h: "recipe-preparation24h",
      };

      const targetId = errorIdMap[firstErrorKey];
      if (targetId) {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          if (
            element.tagName === "INPUT" ||
            element.tagName === "SELECT" ||
            element.tagName === "TEXTAREA"
          ) {
            element.focus();
          }
        }
      }
    }, 100);
  }

  // Auto-formatage du titre
  recipe.title =
    recipe.title.trim().charAt(0).toUpperCase() +
    recipe.title.trim().slice(1).toLowerCase();

  // Normaliser les ingrédients avant la sauvegarde
  recipe.ingredients = normalizeAllIngredients(recipe.ingredients);

  // Déterminer les allergènes et régimes automatiquement
  const { regimes } = determineAllergensAndRegimes(recipe.ingredients);
  recipe.regime = regimes;

  return !hasError;
}

// ============================================================================
// SUPPRESSION
// ============================================================================

/**
 * Supprime une recette (soft delete avec status = "deleted")
 * @param recipeId - L'ID de la recette à supprimer
 * @param releaseLockFn - Fonction optionnelle pour libérer le verrou si détenu
 * @returns Promise<void>
 */
export async function deleteRecipe(
  recipeId: string,
  releaseLockFn?: () => Promise<void>,
): Promise<void> {
  const toastId = toastService.loading("Suppression de la recette...");

  try {
    // Appel synchrone de la cloud function qui :
    // 1. Supprime le fichier markdown sur GitHub
    // 2. Met à jour le statut Appwrite à "deleted"
    await deleteRecipeAppwriteWithGithub(recipeId, globalState.userId || "");

    // Libérer le verrou si fourni
    if (releaseLockFn) {
      await releaseLockFn();
    }

    toastService.update(toastId, {
      state: "success",
      message: "Recette supprimée avec succès",
    });
  } catch (error) {
    console.error("Erreur suppression:", error);
    toastService.update(toastId, {
      state: "error",
      message: "Erreur lors de la suppression",
    });
    throw error;
  } finally {
    setTimeout(() => toastService.dismiss(toastId), 3000);
  }
}
