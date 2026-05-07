/**
 * Utilitaires pour l'enrichissement des produits
 * Logique de transformation Products → EnrichedProduct
 */

import type { Products, Purchases, Main } from "$lib/types/pb";
import type { PbDoc } from "$lib/db-sync/aw-types";
import type {
  EnrichedProduct,
  NumericQuantity,
  StoreInfo,
  TotalNeededOverrideData,
  ManualSpecs,
  RecipeOccurrence,
  ByDateEntry,
} from "../types/store.types";
import type { EnrichedEvent, EventMeal } from "../types/events.d";
import type {
  RecipeForDisplay,
  RecipeIngredient,
  RecipeData,
} from "../types/recipes.types";
import {
  calculateTotalQuantityArray,
  transformPurchasesToNumericQuantity,
  calculateAndFormatMissing,
  safeJsonParse,
  slugify,
} from "./productsUtils";
import {
  formatTotalQuantity,
  aggregateByUnit,
  subtractQuantities,
} from "./QuantityFormatter";
import { UnitConverter } from "./UnitConverter";
import { calculateAllDateDisplayInfo } from "./dateRange";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import type { ParsedNeed } from "./product-need-serializer";

/**
 * Produit avec ses achats associés (résolu côté client).
 */
type ProductWithPurchases = Products & {
  purchases: Purchases[];
};

/**
 * Type interne pour les produits avec purchases optionnel.
 * Permet d'accepter à la fois Products brut (sans purchases), ProductWithPurchases,
 * et EnrichedProduct (qui a des champs optionnels).
 */
type ProductWithOptionalPurchases = Partial<PbDoc> & {
  id: string;
  purchases?: Purchases[];
  productName: string;
  ingredientRef: string | null;
  status: string;
  who: string[] | null;
  store: string;
  stockReel: string | null;
  previousNames: string[] | null;
  isMerged: boolean;
  mergedFrom: string[] | null;
  mergeDate: string | null;
  mergeReason: string | null;
  mergedInto: string | null;
  totalNeededOverride: string | null;
  updatedBy: string | null;
  isSynced: boolean;
  mainId: string | Main;
  productType: string | null;
  specs: string | null;
};

/**
 * Construit un EnrichedProduct de base depuis un produit Appwrite brut.
 * Ne contient que les données Appwrite parsées + purchases agrégées.
 * Les champs Hugo (byDate, nbRecipes, etc.) sont à leurs valeurs par défaut.
 */
export function buildRawProductBase(
  product: ProductWithOptionalPurchases,
): EnrichedProduct {
  const specsParsed = safeJsonParse<ManualSpecs>(product.specs) ?? null;

  const activePurchases = (product.purchases ?? []).filter(
    (p) => p.status !== "deleted",
  );
  const totalPurchasesArray = calculateTotalQuantityArray(
    transformPurchasesToNumericQuantity(activePurchases),
  );

  const totalNeededArray: NumericQuantity[] = specsParsed?.quantity
    ? [specsParsed.quantity]
    : [];

  const totalNeededOverrideParsed = safeJsonParse<TotalNeededOverrideData>(
    product.totalNeededOverride,
  );

  const effectiveNeededArray = totalNeededOverrideParsed
    ? [totalNeededOverrideParsed.totalOverride]
    : totalNeededArray;

  const { numeric: missingQuantityArray, display: displayMissingQuantity } =
    calculateAndFormatMissing(effectiveNeededArray, totalPurchasesArray);

  let stockParsed = safeJsonParse<any>(product.stockReel) ?? null;
  if (stockParsed && stockParsed.quantity && stockParsed.unit) {
    const normalized = UnitConverter.normalize(
      parseFloat(stockParsed.quantity),
      stockParsed.unit,
    );
    stockParsed = {
      ...stockParsed,
      quantity: normalized.quantity,
      unit: normalized.unit,
    };
  }

  const storeInfo = product.store
    ? safeJsonParse<StoreInfo>(product.store)
    : null;

  return {
    id: product.id,
    created: product.created,
    updated: product.updated,

    ingredientRef: product.ingredientRef || "",
    productName: product.productName,
    productType: product.productType || "none",
    pF: specsParsed?.pF ?? false,
    pS: specsParsed?.pS ?? false,
    nbRecipes: 0,
    totalAssiettes: 0,
    isSynced: product.isSynced,
    mainId: product.mainId,

    status: product.status,
    who: product.who,
    store: product.store,
    stockReel: product.stockReel,
    previousNames: product.previousNames,
    isMerged: product.isMerged,
    mergedFrom: product.mergedFrom,
    mergeDate: product.mergeDate,
    mergeReason: product.mergeReason,
    mergedInto: product.mergedInto,
    totalNeededOverride: product.totalNeededOverride,
    updatedBy: product.updatedBy ?? null,
    purchases: product.purchases ?? [],
    specs: product.specs,

    byDate: {},
    storeInfo,
    stockParsed,
    totalNeededArray,
    totalPurchasesArray,
    missingQuantityArray,
    displayTotalNeeded: formatTotalQuantity(totalNeededArray),
    displayMissingQuantity,
    totalNeededOverrideParsed,
    displayTotalOverride: totalNeededOverrideParsed
      ? formatTotalQuantity([totalNeededOverrideParsed.totalOverride])
      : "",
    dateDisplayInfo: {},
  };
}

/**
 * Applique les données Hugo (need) sur un EnrichedProduct de base.
 * Surcharge les champs need et RECALCULE le missing avec le bon totalNeededArray.
 */
export function applyNeedToBase(
  base: EnrichedProduct,
  need: ParsedNeed,
): EnrichedProduct {
  base.productType = need.productType ?? base.productType;
  base.pF = need.pF ?? base.pF;
  base.pS = need.pS ?? base.pS;
  base.byDate = need.byDate;
  base.totalNeededArray = need.totalNeededArray;
  base.nbRecipes = need.nbRecipes;
  base.totalAssiettes = need.totalAssiettes;
  base.dateDisplayInfo = need.dateDisplayInfo;

  const effectiveNeededArray = base.totalNeededOverrideParsed
    ? [base.totalNeededOverrideParsed.totalOverride]
    : base.totalNeededArray;
  const { numeric: missingQuantityArray, display: displayMissingQuantity } =
    calculateAndFormatMissing(effectiveNeededArray, base.totalPurchasesArray);

  base.missingQuantityArray = missingQuantityArray;
  base.displayMissingQuantity = displayMissingQuantity;
  base.displayTotalNeeded = formatTotalQuantity(base.totalNeededArray);

  return base;
}

// =============================================================================
// NOYAU DE CALCUL PRODUIT (Remplace products-from-events.ts)
// =============================================================================

/**
 * Structure intermédiaire pour agréger les ingrédients par produit et par date
 */
interface ProductAggregation {
  ingredientRef: string;
  productName: string;
  productType: string;
  pF?: boolean;
  pS?: boolean;
  byDate: Record<
    string,
    {
      quantities: NumericQuantity[];
      recipes: RecipeOccurrence[];
      totalAssiettes: number;
    }
  >;
  allergens: Set<string>;
}

/**
 * Calcule tous les produits nécessaires pour un événement
 * Utilise une structure intermédiaire pour agréger les données avant de créer les EnrichedProduct
 *
 * ⚡ OPTIMISATION : Pré-charge toutes les recettes en BULK au lieu d'appels individuels
 */
export async function createEnrichedProductsFromEvent(
  event: EnrichedEvent,
  getRecipeDetails: (uuid: string) => Promise<RecipeData | null>,
  mainId: string,
): Promise<EnrichedProduct[]> {
  console.log(
    `[productEnrichment] Calcul pour événement ${event.id} avec ${event.meals.length} repas`,
  );

  // ⚡ ÉTAPE 1 : Collecter tous les UUIDs de recettes uniques
  const allRecipeUuids = new Set<string>();
  for (const meal of event.meals) {
    for (const recipe of meal.recipes) {
      allRecipeUuids.add(recipe.recipeUuid);
    }
  }

  console.log(
    `[productEnrichment] ${allRecipeUuids.size} recettes uniques identifiées`,
  );

  // ⚡ ÉTAPE 2 : Pré-charger toutes les recettes en BULK (1 seule transaction IDB)
  const recipesMap = await recipesStore.getRecipesByUuidsBulk([
    ...allRecipeUuids,
  ]);

  console.log(
    `[productEnrichment] ${recipesMap.size}/${allRecipeUuids.size} recettes chargées`,
  );

  // ⚡ ÉTAPE 3 : Créer un callback synchronisé qui utilise le cache en mémoire
  const getRecipeDetailsFromCache = (
    uuid: string,
  ): Promise<RecipeData | null> => {
    return Promise.resolve(recipesMap.get(uuid) || null);
  };

  // ⚡ ÉTAPE 4 : Utiliser ce callback optimisé pour processMeal
  const aggregations = new Map<string, ProductAggregation>();

  for (const meal of event.meals) {
    await processMeal(meal, getRecipeDetailsFromCache, aggregations);
  }

  const products: EnrichedProduct[] = [];

  for (const [uuid, aggregation] of aggregations) {
    products.push(createEnrichedProductFromAggregation(aggregation, mainId));
  }

  console.log(`[productEnrichment] ${products.length} produits calculés`);
  return products;
}

/**
 * Traite un repas et ajoute ses ingrédients aux agrégations
 */
async function processMeal(
  meal: EventMeal,
  getRecipeDetails: (uuid: string) => Promise<RecipeData | null>,
  aggregations: Map<string, ProductAggregation>,
): Promise<void> {
  const mealDate = meal.date; // Conserver la date complète avec l'heure

  for (const mealRecipe of meal.recipes) {
    const recipeDetails = await getRecipeDetails(mealRecipe.recipeUuid);

    if (!recipeDetails) {
      console.warn(
        `[processMeal] Recette ${mealRecipe.recipeUuid} introuvable`,
      );
      continue;
    }

    const scaleFactor = mealRecipe.plates / recipeDetails.plate;

    for (const ingredient of recipeDetails.ingredients) {
      addIngredientToAggregation(
        ingredient,
        scaleFactor,
        mealDate,
        aggregations,
        recipeDetails.title,
        mealRecipe.plates,
        mealRecipe.recipeUuid,
      );
    }
  }
}

/**
 * Ajoute un ingrédient scalé aux agrégations avec détails recette
 */
function addIngredientToAggregation(
  ingredient: RecipeIngredient,
  scaleFactor: number,
  date: string,
  aggregations: Map<string, ProductAggregation>,
  recipeName: string,
  plates: number,
  recipeUuid?: string,
): void {
  const ref = ingredient.ref;

  if (!aggregations.has(ref)) {
    aggregations.set(ref, {
      ingredientRef: ref,
      productName: ingredient.name,
      productType: ingredient.type,
      pF: ingredient.pF ?? false,
      pS: ingredient.pS ?? false,
      byDate: {},
      allergens: new Set(ingredient.allergens || []),
    });
  }

  const aggregation = aggregations.get(ref)!;

  // Cas spécial : "au goût" - ne pas scaler
  const scaledQuantity =
    ingredient.normalizedUnit === "au goût"
      ? ingredient.normalizedQuantity
      : ingredient.normalizedQuantity * scaleFactor;

  // Scale également la quantité originale (pour affichage quand u différent de uEq)
  const scaledOriginalQuantity =
    ingredient.normalizedUnit === "au goût"
      ? ingredient.originalQuantity
      : ingredient.originalQuantity * scaleFactor;

  // Initialisation de l'entrée pour cette date
  if (!aggregation.byDate[date]) {
    aggregation.byDate[date] = {
      quantities: [],
      recipes: [],
      totalAssiettes: 0,
    };
  }

  const entry = aggregation.byDate[date];

  // 1. Ajouter la quantité brute pour le total consolidé
  entry.quantities.push({
    q: scaledQuantity,
    u: ingredient.normalizedUnit,
  });

  // 2. Ajouter l'occurrence de recette (Traçabilité)
  entry.recipes.push({
    r: recipeName,
    q: scaledOriginalQuantity,
    u: ingredient.originalUnit,
    qEq: scaledQuantity,
    uEq: ingredient.normalizedUnit,
    a: plates,
    ...(recipeUuid ? { id: recipeUuid } : {}),
  });

  // 3. Incrémenter les assiettes (Attention: une recette n'est ajoutée qu'une fois par ingrédient,
  // mais si plusieurs recettes utilisent le même ingrédient le même jour, on somme les assiettes)
  // Calcul approximatif : somme des assiettes des recettes utilisant cet ingrédient
  entry.totalAssiettes += plates;

  if (ingredient.allergens) {
    ingredient.allergens.forEach((a) => aggregation.allergens.add(a));
  }
}

/**
 * Crée un EnrichedProduct final conforme à l'interface
 *
 * 🎯 Génération de l'id unique par événement :
 * - Utilise une partie du productName slugifié
 * - Ajoute une portion de l'eventId (mainId) pour garantir l'unicité
 * - Limite à 36 caractères max (contrainte Appwrite)
 *
 * Format : {productNameSlug}_{eventIdShort}
 * Exemple : "beurre_confiture_x9k2m4n8" (25 caractères)
 */
function createEnrichedProductFromAggregation(
  aggregation: ProductAggregation,
  mainId: string,
): EnrichedProduct {
  // Slugifier le nom du produit et limiter à 20 caractères
  const nameSlug = slugify(aggregation.productName).substring(0, 20);

  // Extraire une portion unique de l'eventId (mainId)
  // Utiliser les 10 derniers caractères en base36, ou moins si l'ID est court
  const eventIdShort = mainId.slice(-10);

  // Construire l'id unique (max 36 caractères)
  const semanticId = `${nameSlug}_${eventIdShort}`;

  // Construction de la structure byDate finale (ByDateEntry)
  const byDate: Record<string, ByDateEntry> = {};

  for (const [date, data] of Object.entries(aggregation.byDate)) {
    byDate[date] = {
      totalConsolidated: aggregateByUnit(data.quantities),
      recipes: data.recipes,
      totalAssiettes: data.totalAssiettes,
      recipeCount: data.recipes.length,
      // totalRaw: optionnel (non géré ici pour l'instant)
    };
  }

  // Calcul du besoin total global (toutes dates)
  const allQuantities = Object.values(byDate).flatMap(
    (e) => e.totalConsolidated,
  );
  const totalNeededArray = aggregateByUnit(allQuantities);

  // Valeurs par défaut pour les achats (vide au départ)
  const totalPurchasesArray: NumericQuantity[] = [];
  const purchases: Purchases[] = [];

  // 🎯 Priorité : Override manuel > Calcul auto
  // Note: dans cette fonction, il n'y a pas encore d'override (nouveau produit)
  // Mais on garde la logique cohérente pour éviter des bugs futurs
  const effectiveNeededArray = totalNeededArray;

  // Calcul missing (Need - Purchase)
  const { numeric: missingQuantityArray, display: displayMissingQuantity } =
    calculateAndFormatMissing(effectiveNeededArray, totalPurchasesArray);

  // Petit fix pour nbRecipes et totalAssiettes global
  const nbRecipes = Object.values(byDate).reduce(
    (acc, e) => acc + e.recipeCount,
    0,
  );
  const totalAssiettes = Object.values(byDate).reduce(
    (acc, e) => acc + e.totalAssiettes,
    0,
  );

  // Calculate dateDisplayInfo from the byDate entries
  const dateDisplayInfo = calculateAllDateDisplayInfo(Object.keys(byDate));

  const product: EnrichedProduct = {
    id: semanticId,
    mainId,
    ingredientRef: aggregation.ingredientRef,
    productName: aggregation.productName,
    productType: aggregation.productType,

    // Champs statiques Hugo
    byDate,

    // Champs calculés initiaux
    totalNeededArray,
    totalPurchasesArray,
    missingQuantityArray,
    displayTotalNeeded: formatTotalQuantity(totalNeededArray),
    displayMissingQuantity,

    // Métadonnées
    isSynced: false,
    status: "active",

    // Champs optionnels vides
    who: [],
    store: "" as any,
    storeInfo: null,
    purchases,
    stockReel: "" as any,
    stockParsed: null,
    totalNeededOverride: null,
    updatedBy: null,
    totalNeededOverrideParsed: null,
    displayTotalOverride: "",
    previousNames: null,
    isMerged: false,
    mergedFrom: [],
    mergeDate: null,
    mergeReason: null,
    mergedInto: null,
    specs: null,
    pF: aggregation.pF ?? false,
    pS: aggregation.pS ?? false,
    nbRecipes,
    totalAssiettes,
    dateDisplayInfo,

    // Timestamps
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  return product;
}
