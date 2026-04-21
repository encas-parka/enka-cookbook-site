import type { EnrichedProduct, ProductRangeStats } from "../types/store.types";
import { calculateProductStatsForDateRange } from "../utils/dateRange";
import type { DateRangeStore } from "../stores/DateRangeStore.svelte";

/**
 * Modèle réactif pour un produit.
 *
 * Deux responsabilités uniquement :
 * 1. `data` ($state) — Point de mutation unique du reconciler.
 *    Seule cette instance change quand le produit est mis à jour.
 * 2. `stats` ($derived) — Stats mémorisées, recalculées ssi data OU dateRange change.
 *
 * `_version` est un fingerprint non-réactif utilisé par le reconciler
 * pour éviter les mises à jour inutiles.
 */
export class ProductModel {
  /** Données enrichies réactives — seul point de mutation du reconciler */
  data = $state<EnrichedProduct>({} as EnrichedProduct);

  /** Version fingerprint (non-réactif) — pour le reconciler */
  _version = "";

  #dateStore: DateRangeStore;

  constructor(initialData: EnrichedProduct, dateStore: DateRangeStore) {
    this.data = initialData;
    this.#dateStore = dateStore;
  }

  /** Met à jour les données. Appelé uniquement par le reconciler. */
  update(newData: EnrichedProduct) {
    this.data = newData;
  }

  /**
   * Stats mémorisées — recalculées ssi data OU dateRange change.
   * Ne se recalcule PAS quand un autre produit change.
   */
  stats = $derived.by<ProductRangeStats>(() => {
    const dateRange = this.#dateStore.current;

    if (!dateRange.start || !dateRange.end) {
      return {
        quantities: [],
        formattedQuantities: "",
        nbRecipes: 0,
        totalAssiettes: 0,
        acquiredQuantities: [],
        formattedAcquiredQuantities: "",
        stockResult: [],
        availableQuantities: [],
        missingQuantities: [],
        formattedMissingQuantities: "",
        formattedAvailableQuantities: "En attente",
        hasAvailable: false,
        hasMissing: false,
        concernedDates: [],
        recipesByDate: new Map(),
      };
    }

    const productStats = calculateProductStatsForDateRange(
      this.data,
      dateRange.start,
      dateRange.end,
    );

    return {
      quantities: productStats.requiredQuantities,
      formattedQuantities: productStats.requiredQuantitiesFormatted,
      nbRecipes: productStats.totalRecipesInRange,
      totalAssiettes: productStats.totalPortionsInRange,
      acquiredQuantities: productStats.acquiredQuantities,
      formattedAcquiredQuantities: productStats.acquiredFormatted,
      stockResult: productStats.stockBalance,
      availableQuantities: productStats.availableStockQuantities,
      missingQuantities: productStats.missingStockQuantities,
      formattedMissingQuantities: productStats.missingStockFormatted,
      formattedAvailableQuantities: productStats.availableStockFormatted,
      hasAvailable: productStats.hasAvailableStock,
      hasMissing: productStats.hasMissingStock,
      concernedDates: productStats.datesInSelectedRange,
      recipesByDate: productStats.recipesByDate,
    };
  });
}
