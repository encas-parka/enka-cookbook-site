/**
 * Utilitaires pour l'enrichissement des produits
 * Logique de transformation Products → EnrichedProduct
 */

import type { Products, Purchases } from "$lib/types/appwrite";
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

/**
 * Crée un EnrichedProduct depuis un Products Appwrite seul
 * ⚠️ Utilisé au sync si le produit n'existe pas localement (cas rare)
 */
export function createEnrichedProductFromAppwrite(
  product: Products,
): EnrichedProduct {
  // Parser les specs (métadonnées manuelles)
  const specsParsed = safeJsonParse<ManualSpecs>(product.specs) ?? null;

  // Calculer depuis purchases
  const totalPurchasesArray = calculateTotalQuantityArray(
    transformPurchasesToNumericQuantity(product.purchases ?? []),
  );

  // byDate manquant = pas de totalNeededArray par défaut
  let totalNeededArray: NumericQuantity[] = [];

  // Si produit manuel avec quantité définie dans specs, on l'utilise comme besoin
  if (specsParsed?.quantity) {
    totalNeededArray = [specsParsed.quantity];
  }

  // 🎯 Priorité : Override manuel > Calcul auto
  // Parser l'override s'il existe pour le calcul du missing
  const totalNeededOverrideParsed = safeJsonParse<TotalNeededOverrideData>(
    product.totalNeededOverride,
  );
  const effectiveNeededArray = totalNeededOverrideParsed
    ? [totalNeededOverrideParsed.totalOverride]
    : totalNeededArray;

  const { numeric: missingQuantityArray, display: displayMissingQuantity } =
    calculateAndFormatMissing(effectiveNeededArray, totalPurchasesArray);

  // Parser et normaliser le stock (kg→gr., l.→ml)
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

  const displayTotalPurchases = formatTotalQuantity(totalPurchasesArray);
  const storeInfo = product.store
    ? safeJsonParse<StoreInfo>(product.store)
    : null;

  const stockOrTotalPurchases = stockParsed
    ? `${stockParsed.quantity} ${stockParsed.unit}`
    : displayTotalPurchases;

  return {
    // Métadonnées Appwrite
    $id: product.$id,
    $createdAt: product.$createdAt,
    $updatedAt: product.$updatedAt,

    // Données métier
    productHugoUuid: product.productHugoUuid || "",
    productName: product.productName,
    productType: product.productType || "none",
    // Utiliser les specs pour pF/pS, sinon false
    pF: specsParsed?.pF ?? false,
    pS: specsParsed?.pS ?? false,
    nbRecipes: 0,
    totalAssiettes: 0,
    isSynced: product.isSynced,
    mainId: product.mainId,
    totalNeededRaw: [],

    // Données collaboratives (brutes Appwrite)
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
    purchases: product.purchases,
    specs: product.specs,

    // Hugo (⚠️ manquant, sera vide)
    byDate: {},

    // Calculées
    storeInfo,
    stockParsed,
    specsParsed, // utile ?
    totalNeededArray,
    totalPurchasesArray,
    missingQuantityArray,
    stockOrTotalPurchases,
    displayTotalNeeded: formatTotalQuantity(totalNeededArray), // Afficher le besoin manuel
    displayTotalPurchases,
    displayMissingQuantity,
    // Déjà parsé plus haut pour le calcul du missing
    totalNeededOverrideParsed,
    displayTotalOverride: totalNeededOverrideParsed
      ? formatTotalQuantity([totalNeededOverrideParsed.totalOverride])
      : "",
    dateDisplayInfo: {},
  };
}

/**
 * Met à jour un EnrichedProduct existant avec données Appwrite fraîches
 *
 * 🎯 Stratégie :
 * - Remplacer TOUS les champs bruts Appwrite
 * - Garder byDate (statique, de Hugo)
 * - Recalculer les dérivés
 */
export function updateExistingProduct(
  product: Products | EnrichedProduct,
  existing: EnrichedProduct,
): EnrichedProduct {
  // Utiliser les nouvelles valeurs si présentes, sinon garder les anciennes
  // Cela protège contre l'écrasement par les payloads partiels du realtime

  // Fusion intelligente des purchases
  const mergedPurchases = product.purchases ?? existing.purchases;

  // Fusion intelligente des specs
  const mergedSpecs = product.specs ?? existing.specs;
  const specsParsed = mergedSpecs
    ? safeJsonParse<ManualSpecs>(mergedSpecs)
    : existing.specsParsed;

  // Calculer totalPurchasesArray depuis les purchases fusionnées
  const totalPurchasesArray = calculateTotalQuantityArray(
    transformPurchasesToNumericQuantity(mergedPurchases ?? []),
  );
  const displayTotalPurchases = formatTotalQuantity(totalPurchasesArray);

  // Recalculer totalNeededArray (si manuel)
  let totalNeededArray = existing.totalNeededArray;
  // Si c'est un produit manuel (pas de lien Hugo) et qu'on a des specs, on met à jour le besoin
  if (!existing.productHugoUuid && specsParsed?.quantity) {
    totalNeededArray = [specsParsed.quantity];
  }

  // 🎯 Priorité : Override manuel > Calcul auto
  // Parser l'override s'il existe pour le calcul du missing
  const totalNeededOverrideParsed = safeJsonParse<TotalNeededOverrideData>(
    product.totalNeededOverride ?? existing.totalNeededOverride,
  );
  const effectiveNeededArray = totalNeededOverrideParsed
    ? [totalNeededOverrideParsed.totalOverride]
    : totalNeededArray;

  // Recalculer missing
  const { numeric: missingQuantityArray, display: displayMissingQuantity } =
    calculateAndFormatMissing(effectiveNeededArray, totalPurchasesArray);

  // Fusion intelligente du stock
  const mergedStockReel = product.stockReel ?? existing.stockReel;
  let stockParsed = mergedStockReel
    ? safeJsonParse<any>(mergedStockReel)
    : existing.stockParsed;

  // Normaliser le stock (kg→gr., l.→ml)
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

  // Fusion intelligente du store
  const mergedStore = product.store ?? existing.store;
  const storeInfo = mergedStore
    ? safeJsonParse<StoreInfo>(mergedStore)
    : existing.storeInfo;

  const stockOrTotalPurchases = stockParsed
    ? `${stockParsed.quantity} ${stockParsed.unit}`
    : displayTotalPurchases;

  // 📝 Log de debug pour tracer les fusions importantes
  if (product.purchases === undefined && existing.purchases?.length) {
    console.log(
      `[ProductsStore] Fusion intelligente : préservation de ${existing.purchases.length} purchases pour ${existing.productName}`,
    );
  }

  return {
    // ✅ GARDER : toujours garder les données statiques Hugo
    ...existing,

    // ✅ FUSION SÉLECTIVE : seulement si présent dans le payload
    $updatedAt: product.$updatedAt,

    // Champs métier - fusionner seulement si définis
    productName: product.productName ?? existing.productName,
    productType: product.productType ?? existing.productType,
    isSynced: product.isSynced ?? existing.isSynced,
    mainId: product.mainId ?? existing.mainId,

    // Mettre à jour pF/pS depuis les specs si disponibles
    pF: specsParsed?.pF ?? existing.pF,
    pS: specsParsed?.pS ?? existing.pS,

    // 🛡️ CHAMPS CRITIQUES : PROTECTION CONTRE L'ÉCRASEMENT
    status: product.status ?? existing.status,
    who: product.who ?? existing.who,
    store: mergedStore,
    stockReel: mergedStockReel,
    specs: mergedSpecs,

    // 🚨 PROTECTION SPÉCIALE pour purchases (le bug principal)
    purchases: mergedPurchases,

    // Autres champs avec protection contre les payloads partiels
    previousNames: product.previousNames ?? existing.previousNames,
    isMerged: product.isMerged ?? existing.isMerged,
    mergedFrom: product.mergedFrom ?? existing.mergedFrom,
    mergeDate: product.mergeDate ?? existing.mergeDate,
    mergeReason: product.mergeReason ?? existing.mergeReason,
    mergedInto: product.mergedInto ?? existing.mergedInto,
    // 🛡️ NOTE: totalNeededOverride utilise "" pour la suppression (pas null)
    // L'opérateur ?? fonctionne car "" est falsy mais différent de null/undefined
    totalNeededOverride:
      product.totalNeededOverride ?? existing.totalNeededOverride,

    // ✅ RECALCULER : les dérivés basés sur les données fusionnées
    storeInfo,
    stockParsed,
    specsParsed,
    totalNeededArray,
    totalPurchasesArray,
    missingQuantityArray,
    stockOrTotalPurchases,
    displayTotalPurchases,
    displayMissingQuantity,
    displayTotalNeeded: formatTotalQuantity(totalNeededArray),
    // Déjà parsé plus haut pour le calcul du missing
    totalNeededOverrideParsed,
    displayTotalOverride: totalNeededOverrideParsed
      ? formatTotalQuantity([totalNeededOverrideParsed.totalOverride])
      : "",
  };
}

/**
 * Recalcule les dépendances liées aux purchases pour un produit
 */
export function recalculatePurchaseDependents(product: EnrichedProduct): void {
  // Recalculer totalPurchasesArray
  product.totalPurchasesArray = calculateTotalQuantityArray(
    transformPurchasesToNumericQuantity(product.purchases ?? []),
  );

  // 🎯 Priorité : Override manuel > Calcul auto
  const effectiveNeededArray = product.totalNeededOverrideParsed
    ? [product.totalNeededOverrideParsed.totalOverride]
    : product.totalNeededArray;

  // Recalculer missingQuantity et display
  const { numeric: missingQuantityArray, display: displayMissingQuantity } =
    calculateAndFormatMissing(
      effectiveNeededArray,
      product.totalPurchasesArray,
    );

  product.missingQuantityArray = missingQuantityArray;
  product.displayMissingQuantity = displayMissingQuantity;
}

// =============================================================================
// NOYAU DE CALCUL PRODUIT (Remplace products-from-events.ts)
// =============================================================================

/**
 * Structure intermédiaire pour agréger les ingrédients par produit et par date
 */
interface ProductAggregation {
  productHugoUuid: string;
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
    `[productEnrichment] Calcul pour événement ${event.$id} avec ${event.meals.length} repas`,
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
): void {
  const uuid = ingredient.uuid;

  if (!aggregations.has(uuid)) {
    aggregations.set(uuid, {
      productHugoUuid: uuid,
      productName: ingredient.name,
      productType: ingredient.type,
      pF: ingredient.pF ?? false,
      pS: ingredient.pS ?? false,
      byDate: {},
      allergens: new Set(ingredient.allergens || []),
    });
  }

  const aggregation = aggregations.get(uuid)!;

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
 * 🎯 Génération de l'$id unique par événement :
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

  // Construire l'$id unique (max 36 caractères pour Appwrite)
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
    $id: semanticId,
    mainId,
    productHugoUuid: aggregation.productHugoUuid,
    productName: aggregation.productName,
    productType: aggregation.productType,

    // Champs statiques Hugo
    byDate,

    // Champs calculés initiaux
    totalNeededArray,
    totalPurchasesArray,
    missingQuantityArray,
    displayTotalNeeded: formatTotalQuantity(totalNeededArray),
    displayTotalPurchases: formatTotalQuantity(totalPurchasesArray),
    displayMissingQuantity,

    // Métadonnées
    isSynced: false,
    status: "active",
    // allergens removed (not in EnrichedProduct)

    // Champs optionnels vides
    who: [],
    store: "" as any,
    storeInfo: null,
    purchases,
    stockReel: "" as any,
    stockParsed: null,
    totalNeededOverride: null,
    totalNeededOverrideParsed: null,
    displayTotalOverride: "",
    stockOrTotalPurchases: "",
    previousNames: null,
    isMerged: false,
    mergedFrom: [],
    mergeDate: null,
    mergeReason: null,
    mergedInto: null,
    specs: null,
    specsParsed: null,
    pF: aggregation.pF ?? false,
    pS: aggregation.pS ?? false,
    nbRecipes,
    totalAssiettes,
    totalNeededRaw: totalNeededArray, // Initialisation cohérente
    dateDisplayInfo,

    // Timestamps
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    $permissions: [],
    $databaseId: "",
    $tableId: "",
  };

  return product;
}
