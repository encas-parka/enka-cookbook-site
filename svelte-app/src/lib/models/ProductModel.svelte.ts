import type {
  EnrichedProduct,
  StoreInfo,
  ProductRangeStats,
  DateDisplayInfo,
} from "../types/store.types";
import type { DateRange, ProductStatsForDateRange } from "../utils/dateRange";
import { calculateProductStatsForDateRange } from "../utils/dateRange";
import type { DateRangeStore } from "../stores/DateRangeStore.svelte";

/**
 * Modèle réactif pour un produit
 * Encapsule les données et la logique de calcul des stats
 * Permet une réactivité fine : seul ce produit est recalculé si ses données changent
 */
export class ProductModel {
  // Données brutes réactives
  data = $state<EnrichedProduct>({} as EnrichedProduct);

  // Accès au contexte global (dateRange)
  dateStore: DateRangeStore;

  constructor(initialData: EnrichedProduct, dateStore: DateRangeStore) {
    this.data = initialData;
    this.dateStore = dateStore;
  }

  /**
   * Met à jour les données du produit.
   * Ne déclenche une notification réactive QUE si les données changent réellement.
   * Ceci évite les boucles infinies ($effect lit → update écrit → re-lit).
   */
  update(newData: EnrichedProduct) {
    if (this.data === newData) return;
    this.data = newData;
  }

  // Proxies pour faciliter l'accès aux propriétés de data
  get $id() {
    return this.data.$id;
  }
  get productName() {
    return this.data.productName;
  }
  get productType() {
    return this.data.productType;
  }
  get storeInfo() {
    return this.data.storeInfo;
  }
  get who() {
    return this.data.who;
  }
  get pF() {
    return this.data.pF;
  }
  get pS() {
    return this.data.pS;
  }
  get status() {
    return this.data.status;
  }
  get previousNames() {
    return this.data.previousNames;
  }
  get purchases() {
    return this.data.purchases;
  }
  get totalNeededOverrideParsed() {
    return this.data.totalNeededOverrideParsed;
  }
  get displayMissingQuantity() {
    return this.data.displayMissingQuantity;
  }
  get missingQuantityArray() {
    return this.data.missingQuantityArray;
  }
  get isSynced() {
    return this.data.isSynced;
  }
  get byDate() {
    return this.data.byDate;
  }

  /**
   * Stats calculées dynamiquement pour ce produit
   * Ne se recalcule que si this.data change OU dateRange change
   */
  stats = $derived.by<ProductRangeStats>(() => {
    const dateRange = this.dateStore.current;
    const availableDates = this.dateStore.dates;

    let productStats: ProductStatsForDateRange;

    // Cas principal : utilise calculateProductStatsForDateRange pour tous les cas
    if (dateRange.start && dateRange.end) {
      productStats = calculateProductStatsForDateRange(
        this.data,
        dateRange.start,
        dateRange.end,
      );
    }

    // Fallback (vide)
    else {
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

    // 🔄 MAPPING vers l'ancien format pour compatibilité UI existante
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
