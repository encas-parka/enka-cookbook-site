import { SvelteMap } from "svelte/reactivity";
import { useDebounce } from "runed";
import { Query } from "appwrite";
import type { Products, Purchases } from "../types/appwrite.d";

import {
  matchesFilters,
  type FiltersState,
  type TemperatureFilterMode,
  hasConversions,
} from "../utils/productsUtils";
import {
  createEnrichedProductFromAppwrite,
  updateExistingProduct,
  createEnrichedProductsFromEvent,
} from "../utils/productEnrichment";
import { toastService } from "../services/toast.service.svelte";
import type {
  EnrichedProduct,
  StoreInfo,
  TotalNeededOverrideData,
  BatchUpdateResult,
  NumericQuantity,
  ByDateEntry,
  DateDisplayInfo,
} from "../types/store.types";
import type { EnrichedEvent } from "../types/events";
import {
  createQuickValidationPurchases,
  updatePurchase,
  upsertProduct,
  updateProduct as updateProductAppwrite,
  updateProductBatch,
  batchUpdateProductsOptimized,
} from "../services/appwrite-products";
import type { GroupPurchaseBatchResult } from "../services/appwrite-transaction";

import { globalState } from "./GlobalState.svelte";
import { ProductModel } from "../models/ProductModel.svelte";
import { DateRangeStore } from "./DateRangeStore.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { recipesStore } from "./RecipesStore.svelte";
import {
  createSyncCollection,
  bridgeToMapFiltered,
  db,
  type BridgeResult,
  type ProductNeedRow,
} from "$lib/db-sync/aw-sync";

/**
 * ProductsStore - Store principal de gestion des produits avec Svelte 5 + aw-sync
 *
 * Architecture (v2 — $derived merge, no $effect for data flow):
 * - aw-sync: Dexie (db.products + db.purchases + db.productNeeds) + delta sync + realtime
 * - bridgeToMapFiltered: liveQuery → SvelteMap (raw data scoped by mainId)
 * - $derived: purchasesByProduct index, orphanPurchases, enrichedProducts (3-way merge)
 * - $effect: meals sync only (writes calculated needs to Dexie, bridge propagates)
 *
 * Flux de données:
 * Lecture :  Dexie → liveQuery → SvelteMap (products/purchases/needs) → $derived merge → ProductModel → UI
 * Écriture : UI → Store → Appwrite CRUD → aw-sync realtime → Dexie → liveQuery → ... → UI
 * Needs :    event.meals → createEnrichedProductsFromEvent → db.productNeeds.bulkPut → bridge → $derived merge
 *
 * @usage
 * await productsStore.initialize('eventId');
 * productsStore.setSearchQuery('pâtes');
 * const product = productsStore.getEnrichedProductById('abc');
 */

// =============================================================================
// HELPERS
// =============================================================================

/** Deserialize a ProductNeedRow's JSON fields into their runtime types */
function parseNeedRow(row: ProductNeedRow): ParsedNeed {
  return {
    $id: row.$id,
    mainId: row.mainId,
    productHugoUuid: row.productHugoUuid,
    productName: row.productName,
    productType: row.productType,
    pF: row.pF,
    pS: row.pS,
    byDate: JSON.parse(row.byDate),
    totalNeededArray: JSON.parse(row.totalNeededArray),
    totalNeededRaw: JSON.parse(row.totalNeededRaw),
    nbRecipes: row.nbRecipes,
    totalAssiettes: row.totalAssiettes,
    dateDisplayInfo: JSON.parse(row.dateDisplayInfo),
    $createdAt: row.$createdAt,
    $updatedAt: row.$updatedAt,
  };
}

interface ParsedNeed {
  $id: string;
  mainId: string;
  productHugoUuid: string;
  productName: string;
  productType: string;
  pF: boolean;
  pS: boolean;
  byDate: Record<string, ByDateEntry>;
  totalNeededArray: NumericQuantity[];
  totalNeededRaw: NumericQuantity[];
  nbRecipes: number;
  totalAssiettes: number;
  dateDisplayInfo: Record<string, DateDisplayInfo>;
  $createdAt: string;
  $updatedAt: string;
}

/** Serialize an EnrichedProduct's need fields into a ProductNeedRow for Dexie storage */
function toNeedRow(enriched: EnrichedProduct, mainId: string): ProductNeedRow {
  const now = new Date().toISOString();
  return {
    $id: enriched.$id,
    mainId,
    productHugoUuid: enriched.productHugoUuid || "",
    productName: enriched.productName,
    productType: enriched.productType,
    pF: enriched.pF,
    pS: enriched.pS,
    byDate: JSON.stringify(enriched.byDate),
    totalNeededArray: JSON.stringify(enriched.totalNeededArray),
    totalNeededRaw: JSON.stringify(enriched.totalNeededRaw),
    nbRecipes: enriched.nbRecipes,
    totalAssiettes: enriched.totalAssiettes,
    dateDisplayInfo: JSON.stringify(enriched.dateDisplayInfo),
    $createdAt: enriched.$createdAt || now,
    $updatedAt: now,
  };
}

// =============================================================================
// STORE
// =============================================================================

class ProductsStore {
  // ===========================================================================
  // aw-sync COLLECTIONS
  // ===========================================================================

  #productsCollection = createSyncCollection<Products>({
    table: db.products,
    collectionName: "products",
  });
  #purchasesCollection = createSyncCollection<Purchases>({
    table: db.purchases,
    collectionName: "purchases",
  });

  // Bridges: liveQuery → SvelteMap (raw data, scoped by mainId)
  #productsBridge = $state.raw<BridgeResult<Products> | null>(null);
  #purchasesBridge = $state.raw<BridgeResult<Purchases> | null>(null);
  #needsBridge = $state.raw<BridgeResult<ProductNeedRow> | null>(null);

  // Metadata
  #currentMainId = $state<string | null>(null);
  #currentEventId = $state<string | null>(null);
  #isInitialized = $state(false);
  #loading = $state(false);
  #error = $state<string | null>(null);
  #syncing = $state(false);
  #realtimeConnected = $state(false);
  #lastSync = $state<string | null>(null);
  #lastMealsHash = "";
  #cleanupSyncEffect: (() => void) | null = null;

  // Filters
  #filters = $state<FiltersState>({
    searchQuery: "",
    selectedStores: [],
    selectedWho: [],
    selectedProductTypes: [],
    selectedTemperatures: [],
    temperatureFilter: "all",
    completionStatus: "all",
    groupBy: "productType",
    sortColumn: "",
    sortDirection: "asc",
  });

  // Date range
  dateStore = new DateRangeStore();

  // ===========================================================================
  // DERIVED: Purchases index (productId → Purchases[])
  // ===========================================================================

  /** Direct access to purchases bridge map for derived computations */
  #getPurchasesMap(): SvelteMap<string, Purchases> {
    return this.#purchasesBridge?.map ?? new SvelteMap<string, Purchases>();
  }

  #purchasesByProduct = $derived.by(() => {
    const purchasesMap = this.#getPurchasesMap();
    const index = new Map<string, Purchases[]>();
    for (const purchase of purchasesMap.values()) {
      if (purchase.status === "deleted" || purchase.status === "expense")
        continue;
      for (const productId of purchase.products ?? []) {
        const list = index.get(productId) ?? [];
        list.push(purchase);
        index.set(productId, list);
      }
    }
    return index;
  });

  // Orphan purchases (expenses)
  #derivedOrphanPurchases = $derived.by(() => {
    const purchasesMap = this.#getPurchasesMap();
    const orphans = new SvelteMap<string, Purchases>();
    for (const [id, purchase] of purchasesMap) {
      if (purchase.status === "expense") {
        orphans.set(id, purchase);
      }
    }
    return orphans;
  });

  // ===========================================================================
  // DERIVED: 3-way merge (products + purchases + needs) → EnrichedProducts
  // ===========================================================================

  /**
   * Core merge: combines products (Appwrite), purchases (Appwrite),
   * and calculated needs (from event.meals) into enriched ProductModel instances.
   *
   * Pure $derived — no side effects, no $effect.
   * Reads from the 3 bridges + purchasesByProduct index.
   */
  #enrichedProducts = $derived.by(() => {
    const productsMap = this.#productsBridge?.map;
    const needsMap = this.#needsBridge?.map;

    // Touch purchases index to create reactive dependency
    this.#purchasesByProduct.size;

    if (!productsMap && !needsMap) return new SvelteMap<string, ProductModel>();

    const result = new SvelteMap<string, ProductModel>();

    const allIds = new Set<string>();
    if (productsMap) for (const id of productsMap.keys()) allIds.add(id);
    if (needsMap) for (const id of needsMap.keys()) allIds.add(id);

    for (const id of allIds) {
      const raw = productsMap?.get(id);
      const needRow = needsMap?.get(id);
      const need = needRow ? parseNeedRow(needRow) : null;
      const purchases = this.#purchasesByProduct.get(id) || [];

      const enriched = this.#mergeData(raw, need, purchases);
      result.set(id, new ProductModel(enriched, this.dateStore));
    }

    return result;
  });

  // ===========================================================================
  // MERGE FUNCTION (unified)
  // ===========================================================================

  /**
   * Merges data from 0–3 sources into a single EnrichedProduct.
   * - raw: Appwrite product data (may be null if product only exists as a need)
   * - need: Calculated needs from event.meals (may be null if manual product)
   * - purchases: Related purchases
   */
  #mergeData(
    raw: Products | undefined,
    need: ParsedNeed | null,
    purchases: Purchases[],
  ): EnrichedProduct {
    if (raw && need) {
      // Product exists in both Appwrite and calculated needs → merge
      const productWithPurchases = { ...raw, purchases };
      const enriched = createEnrichedProductFromAppwrite(productWithPurchases);
      // Overwrite need-derived fields
      enriched.byDate = need.byDate;
      enriched.totalNeededArray = need.totalNeededArray;
      enriched.totalNeededRaw = need.totalNeededRaw;
      enriched.nbRecipes = need.nbRecipes;
      enriched.totalAssiettes = need.totalAssiettes;
      enriched.dateDisplayInfo = need.dateDisplayInfo;
      return enriched;
    }

    if (raw) {
      // Product only in Appwrite (manual product, or needs not yet calculated)
      const productWithPurchases = { ...raw, purchases };
      return createEnrichedProductFromAppwrite(productWithPurchases);
    }

    if (need) {
      // Product only in calculated needs (not yet synced to Appwrite)
      return {
        $id: need.$id,
        $createdAt: need.$createdAt,
        $updatedAt: need.$updatedAt,
        productHugoUuid: need.productHugoUuid,
        productName: need.productName,
        productType: need.productType,
        pF: need.pF,
        pS: need.pS,
        nbRecipes: need.nbRecipes,
        totalAssiettes: need.totalAssiettes,
        isSynced: false,
        mainId: need.mainId,
        totalNeededRaw: need.totalNeededRaw,
        status: "active",
        who: [],
        store: "" as any,
        stockReel: null,
        previousNames: null,
        isMerged: false,
        mergedFrom: null,
        mergeDate: null,
        mergeReason: null,
        mergedInto: null,
        totalNeededOverride: null,
        updatedBy: null,
        purchases,
        byDate: need.byDate,
        storeInfo: null,
        stockParsed: null,
        totalNeededArray: need.totalNeededArray,
        totalPurchasesArray: [],
        missingQuantityArray: [],
        stockOrTotalPurchases: "",
        displayTotalNeeded: "",
        displayTotalPurchases: "",
        displayMissingQuantity: "",
        displayTotalOverride: "",
        totalNeededOverrideParsed: null,
        dateDisplayInfo: need.dateDisplayInfo,
        specs: null,
        specsParsed: null,
      };
    }

    // Should never happen (allIds ensures at least one source)
    throw new Error("[ProductsStore] mergeData called with no data sources");
  }

  // ===========================================================================
  // PUBLIC GETTERS
  // ===========================================================================

  get currentMainId() {
    return this.#currentMainId;
  }
  get loading() {
    return this.#loading;
  }
  get error() {
    return this.#error;
  }
  get lastSync() {
    return this.#lastSync;
  }
  get syncing() {
    return this.#syncing;
  }
  get realtimeConnected() {
    return this.#realtimeConnected;
  }

  get filters() {
    return this.#filters;
  }

  // Date range delegation
  get dateRange() {
    return this.dateStore.current;
  }
  get availableDates() {
    return this.dateStore.dates;
  }
  get isEventPassed() {
    return this.dateStore.isEventPassed;
  }
  get hasSingleDateEvent() {
    return this.dateStore.hasSingleDateEvent;
  }
  get hasSingleDateInRange() {
    return this.dateStore.hasSingleDateInRange;
  }
  get hasPastDatesInRange() {
    return this.dateStore.hasPastDatesInRange;
  }
  get firstAvailableDate() {
    return this.dateStore.firstAvailableDate;
  }
  get lastAvailableDate() {
    return this.dateStore.lastAvailableDate;
  }

  // Filter state
  get hasFilters() {
    return (
      this.filters.searchQuery !== "" ||
      this.filters.selectedStores.length > 0 ||
      this.filters.selectedWho.length > 0 ||
      this.filters.selectedProductTypes.length > 0 ||
      this.filters.selectedTemperatures.length > 0 ||
      this.filters.temperatureFilter !== "all" ||
      this.filters.completionStatus !== "all"
    );
  }

  get isSearchActive() {
    return this.filters.searchQuery.trim().length > 0;
  }

  get activeFiltersDescription(): string[] {
    const descriptions: string[] = [];

    if (this.filters.completionStatus === "incomplete") {
      descriptions.push("Manquants");
    } else if (this.filters.completionStatus === "completed") {
      descriptions.push("Complets");
    }

    if (this.filters.temperatureFilter !== "all") {
      const tempLabels: Record<string, string> = {
        frais: "Frais",
        "not-frais": "Sans frais",
        surgele: "Surgelés",
        "not-surgele": "Sans surgelés",
      };
      descriptions.push(tempLabels[this.filters.temperatureFilter] || "");
    }

    if (this.filters.selectedProductTypes.length > 0) {
      descriptions.push(`Types: ${this.filters.selectedProductTypes.length}`);
    }

    if (this.filters.selectedStores.length > 0) {
      descriptions.push(`Magasins: ${this.filters.selectedStores.length}`);
    }

    if (this.filters.selectedWho.length > 0) {
      descriptions.push(`Qui: ${this.filters.selectedWho.length}`);
    }

    return descriptions;
  }

  get groupedFilteredProducts() {
    return this.#groupedFilteredProducts;
  }

  // ===========================================================================
  // DERIVED: Enriched products → UI
  // ===========================================================================

  enrichedProducts = $derived.by(() => {
    return Array.from(this.#enrichedProducts.values()).map((m) => m.data);
  });

  filteredProductsMap = $derived.by(() => {
    if (!this.dateRange.start || !this.dateRange.end) {
      return new Map<string, ProductModel>();
    }

    const startDateISO = this.dateRange.start;
    const endDateISO = this.dateRange.end;
    const filteredMap = new Map<string, ProductModel>();

    for (const [id, model] of this.#enrichedProducts) {
      const product = model.data;
      const isManualProduct = !product.productHugoUuid;
      if (!product.byDate && !isManualProduct) continue;

      if (!matchesFilters(product, this.#filters)) continue;

      if (this.#filters.completionStatus !== "all") {
        const hasMissing = model.stats.hasMissing;
        if (this.#filters.completionStatus === "completed" && hasMissing)
          continue;
        if (this.#filters.completionStatus === "incomplete" && !hasMissing)
          continue;
      }

      let hasDataInRange = false;
      if (product.byDate) {
        hasDataInRange = Object.keys(product.byDate).some((dateStr) => {
          return dateStr >= startDateISO && dateStr <= endDateISO;
        });
      }

      if (hasDataInRange || isManualProduct) {
        filteredMap.set(id, model);
      }
    }

    return filteredMap;
  });

  stats = $derived.by(() => ({
    total: this.#enrichedProducts.size,
    frais: Array.from(this.#enrichedProducts.values()).filter((p) => p.pF)
      .length,
    surgel: Array.from(this.#enrichedProducts.values()).filter((p) => p.pS)
      .length,
    merged: Array.from(this.#enrichedProducts.values()).filter(
      (p) => p.data.isMerged,
    ).length,
  }));

  uniqueStores = $derived.by(() => {
    const storeNames = Array.from(this.#enrichedProducts.values())
      .map((p) => p.storeInfo?.storeName)
      .filter(Boolean);
    return [...new Set(storeNames)] as string[];
  });

  eventContributors = $derived.by(() => {
    if (!this.#currentEventId) return [];
    const event = eventsStore.getEventById(this.#currentEventId);
    if (!event?.contributors) return [];
    return event.contributors
      .filter((c) => c.status === "accepted" && c.name?.trim())
      .map((c) => c.name!.trim())
      .sort();
  });

  #usedWho = $derived.by(() => {
    const whos = Array.from(this.#enrichedProducts.values()).flatMap(
      (p) => p.who || [],
    );
    return [...new Set(whos)].sort();
  });

  uniqueWho = $derived.by(() => {
    const allWho = new Set([...this.eventContributors, ...this.#usedWho]);
    return Array.from(allWho).sort();
  });

  uniqueProductTypes = $derived.by(() => {
    const types = Array.from(this.#enrichedProducts.values())
      .map((p) => p.productType)
      .filter(Boolean);
    return [...new Set(types)] as string[];
  });

  #groupedFilteredProducts = $derived.by(() => {
    const relevantProducts = Array.from(this.filteredProductsMap.values());
    const sortedProducts = relevantProducts.sort((a, b) =>
      a.$id.localeCompare(b.$id),
    );

    if (this.#filters.groupBy === "none") {
      return { "": sortedProducts };
    }

    const groups = Object.groupBy(sortedProducts, (model) => {
      if (this.#filters.groupBy === "store") {
        return model.storeInfo?.storeName || "Non défini";
      } else {
        return model.productType || "Non défini";
      }
    });

    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    });

    const sortedGroups: Record<string, ProductModel[]> = {};
    sortedGroupKeys.forEach((key) => {
      sortedGroups[key] = groups[key]!;
    });

    return sortedGroups;
  });

  completionStats = $derived.by(() => {
    let completed = 0;
    let missing = 0;
    for (const model of this.#enrichedProducts.values()) {
      if (model.stats.hasMissing) {
        missing++;
      } else {
        completed++;
      }
    }
    return { completed, missing, total: completed + missing };
  });

  financialStats = $derived.by(() => {
    let totalGlobal = 0;
    const byStore: Record<string, number> = {};
    const byWho: Record<string, number> = {};
    const allPurchases: (Purchases & { _productName?: string })[] = [];

    for (const purchase of this.#derivedOrphanPurchases.values()) {
      if (purchase.status === "deleted") continue;
      const amount = purchase.invoiceTotal || purchase.price || 0;
      totalGlobal += amount;
      const store = purchase.store || "Non défini";
      byStore[store] = (byStore[store] || 0) + amount;
      const who = purchase.who || "Non défini";
      byWho[who] = (byWho[who] || 0) + amount;
      allPurchases.push(purchase);
    }

    for (const model of this.#enrichedProducts.values()) {
      const product = model.data;
      const purchases = this.#purchasesByProduct.get(product.$id) || [];
      for (const purchase of purchases) {
        if (purchase.price) {
          totalGlobal += purchase.price;
          const store = purchase.store || "Non défini";
          byStore[store] = (byStore[store] || 0) + purchase.price;
          const who = purchase.who || "Non défini";
          byWho[who] = (byWho[who] || 0) + purchase.price;
          allPurchases.push({
            ...purchase,
            _productName: product.productName,
          });
        }
      }
    }

    allPurchases.sort((a, b) => {
      const dateA = new Date(a.orderDate || a.$createdAt).getTime();
      const dateB = new Date(b.orderDate || b.$createdAt).getTime();
      return dateB - dateA;
    });

    return { totalGlobal, byStore, byWho, allPurchases };
  });

  // ===========================================================================
  // INITIALISATION
  // ===========================================================================

  async initialize(eventId: string) {
    if (!eventId?.trim()) {
      throw new Error("eventId invalide fourni");
    }

    if (this.#isInitialized && this.#currentEventId === eventId) {
      console.log(`[ProductsStore] Deja initialise pour eventId: ${eventId}`);
      return;
    }

    if (this.#isInitialized && this.#currentEventId !== eventId) {
      console.log(
        `[ProductsStore] Changement d'evenement: ${this.#currentEventId} → ${eventId}, reset...`,
      );
      this.reset();
    }

    console.log(`[ProductsStore] Initialisation avec eventId: ${eventId}`);

    const event = eventsStore.getEventById(eventId);
    if (!event) {
      throw new Error(`Evenement ${eventId} introuvable dans EventsStore`);
    }

    try {
      this.#loading = true;
      this.#currentEventId = event.$id;
      this.#currentMainId = event.$id;

      // 1. Initialiser les bridges liveQuery (scopes par mainId)
      this.#productsBridge = bridgeToMapFiltered(db.products, (t) =>
        t.where("mainId").equals(this.#currentMainId!).toArray(),
      );
      this.#purchasesBridge = bridgeToMapFiltered(db.purchases, (t) =>
        t.where("mainId").equals(this.#currentMainId!).toArray(),
      );
      this.#needsBridge = bridgeToMapFiltered(db.productNeeds, (t) =>
        t.where("mainId").equals(this.#currentMainId!).toArray(),
      );

      // 2. Delta sync depuis Appwrite
      this.#syncing = true;
      await this.#productsCollection.initialFetch({
        queries: [Query.equal("mainId", this.#currentMainId!)],
      });
      await this.#purchasesCollection.initialFetch({
        queries: [Query.equal("mainId", this.#currentMainId!)],
      });
      this.#syncing = false;
      this.#lastSync = new Date().toISOString();

      // 3. Calculate needs if none in Dexie yet
      // Query Dexie directly — the bridge liveQuery may not have fired yet
      const existingNeedsCount = await db.productNeeds
        .where("mainId")
        .equals(this.#currentMainId!)
        .count();
      if (existingNeedsCount === 0) {
        console.log(
          "[ProductsStore] Aucun besoin calculé en cache, calcul depuis event.meals...",
        );
        await recipesStore.syncReady;
        await this.#calculateAndPersistNeeds(event);
      }

      // Record meals hash to prevent redundant recalculation from meals sync effect
      this.#lastMealsHash = JSON.stringify(event.meals);

      // 4. Abonnements realtime (aw-sync → Dexie → liveQuery → bridges)
      this.#productsCollection.subscribe();
      this.#purchasesCollection.subscribe();

      // 5. Setup reactive sync avec EventsStore (meals updates → Dexie)
      this.#setupMealsSyncEffect(eventId);

      // 6. Date range
      this.dateStore.setAvailableDates([...(event.allDates || [])]);
      this.dateStore.initializeSmartRange();

      this.#isInitialized = true;
      this.#loading = false;

      console.log(
        `[ProductsStore] Initialisation terminee: ${this.#enrichedProducts.size} produits, ${this.#getPurchasesMap().size} achats`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'initialisation";
      this.#error = message;
      this.#loading = false;
      console.error("[ProductsStore]", message, err);
      throw err;
    }
  }

  // ===========================================================================
  // CALCULATED NEEDS MANAGEMENT
  // ===========================================================================

  /**
   * Calculate product needs from event.meals and persist to Dexie.
   * The bridge liveQuery will detect the change → $derived merge fires automatically.
   */
  async #calculateAndPersistNeeds(event: EnrichedEvent): Promise<void> {
    const getRecipeDetails = async (uuid: string) => {
      return await recipesStore.getRecipeByUuid(uuid);
    };

    const products = await createEnrichedProductsFromEvent(
      event,
      getRecipeDetails,
      event.$id,
    );

    // Persist to Dexie as ProductNeedRows
    const rows = products.map((p) => toNeedRow(p, event.$id));
    await db.productNeeds.bulkPut(rows);

    console.log(
      `[ProductsStore] ${products.length} besoins calculés et persistés depuis ${event.meals.length} repas`,
    );
  }

  // ===========================================================================
  // SYNC WITH EVENT MEALS (the only remaining $effect)
  // ===========================================================================

  #setupMealsSyncEffect(eventId: string) {
    if (this.#cleanupSyncEffect) this.#cleanupSyncEffect();

    this.#cleanupSyncEffect = $effect.root(() => {
      $effect(() => {
        const reactiveEvent = eventsStore.getEventById(eventId);
        if (reactiveEvent) {
          this.#syncWithEventMeals(reactiveEvent);
        }
      });
    });
  }

  async #syncWithEventMeals(event: EnrichedEvent) {
    if (!this.#isInitialized) return;

    const mealsHash = JSON.stringify(event.meals);
    if (this.#lastMealsHash === mealsHash) return;

    console.log(
      `[ProductsStore] Changement repas detecte pour ${event.$id}, recalcul...`,
    );
    this.#lastMealsHash = mealsHash;

    // Recalculate needs and persist to Dexie
    // The bridge will detect changes → $derived merge fires automatically
    // Capture fresh IDs for stale cleanup (avoids duplicate calculation)
    const getRecipeDetails = async (uuid: string) => {
      return await recipesStore.getRecipeByUuid(uuid);
    };
    const freshProducts = await createEnrichedProductsFromEvent(
      event,
      getRecipeDetails,
      event.$id,
    );

    // Persist to Dexie as ProductNeedRows
    const rows = freshProducts.map((p) => toNeedRow(p, event.$id));
    await db.productNeeds.bulkPut(rows);
    console.log(
      `[ProductsStore] ${freshProducts.length} besoins calculés et persistés depuis ${event.meals.length} repas`,
    );

    // Delete stale needs from Dexie
    const freshIds = new Set(freshProducts.map((p) => p.$id));
    const existingNeeds = await db.productNeeds
      .where("mainId")
      .equals(event.$id)
      .toArray();
    const staleIds = existingNeeds
      .filter((n) => !freshIds.has(n.$id))
      .map((n) => n.$id);
    if (staleIds.length > 0) {
      await db.productNeeds.bulkDelete(staleIds);
    }

    this.dateStore.setAvailableDates([...(event.allDates || [])]);
  }

  // ===========================================================================
  // EXPORT MARKDOWN
  // ===========================================================================

  exportToMarkdown(eventName: string): string {
    const lines: string[] = [];
    lines.push("---");
    lines.push(`# ${eventName}`);

    const { start, end } = this.dateStore.current;
    if (start && end) {
      const startStr = new Date(start).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      });
      const endStr = new Date(end).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      });
      lines.push(`- ${startStr} au ${endStr}`);
    } else if (start) {
      const dateStr = new Date(start).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      lines.push(`- ${dateStr}`);
    }

    lines.push("");

    const groups = this.#groupedFilteredProducts;
    const groupKeys = Object.keys(groups);

    if (groupKeys.length === 0) {
      lines.push("_Aucun produit ne correspond aux filtres actuels._");
    } else {
      for (const groupLabel of groupKeys) {
        const models = groups[groupLabel]!;
        if (groupLabel) {
          lines.push(`## ${groupLabel}`);
          lines.push("");
        }
        for (const model of models) {
          const name = model.productName;
          const total = model.stats.formattedQuantities || "-";
          const hasAcquired = model.stats.acquiredQuantities.length > 0;
          const hasMissing = model.stats.missingQuantities.length > 0;
          let line = `- ${name}: ${total}`;
          if (hasAcquired) {
            const acquired = model.stats.formattedAcquiredQuantities || "-";
            line += ` | acquis ${acquired}`;
            if (hasMissing) {
              const missing = model.stats.formattedMissingQuantities || "-";
              line += ` | manque ${missing}`;
            }
          }
          lines.push(line);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  // ===========================================================================
  // DATE RANGE METHODS
  // ===========================================================================

  setDateRange(date1: string | null, date2: string | null) {
    this.dateStore.setRange(date1, date2);
  }

  isFullRange() {
    return this.dateStore.isFullRange;
  }

  selectUpcomingDates() {
    this.dateStore.selectUpcoming();
  }

  isUpcomingRange() {
    return this.dateStore.isUpcomingRange;
  }

  selectFutureDatesOnly() {
    this.dateStore.selectFutureDatesOnly();
  }

  // ===========================================================================
  // FILTER SETTERS
  // ===========================================================================

  setSearchQuery = useDebounce(
    (query: string) => {
      this.#filters.searchQuery = query;
      if (query.trim().length > 0) {
        this.#filters.selectedStores = [];
        this.#filters.selectedWho = [];
        this.#filters.selectedProductTypes = [];
        this.#filters.selectedTemperatures = [];
        this.#filters.temperatureFilter = "all";
        this.#filters.completionStatus = "all";
      }
    },
    () => 500,
  );

  toggleProductType(type: string) {
    const idx = this.#filters.selectedProductTypes.indexOf(type);
    if (idx > -1) {
      this.#filters.selectedProductTypes.splice(idx, 1);
    } else {
      this.#filters.selectedProductTypes.push(type);
    }
  }

  toggleTemperature(temperature: "frais" | "surgele") {
    const idx = this.#filters.selectedTemperatures.indexOf(temperature);
    if (idx > -1) {
      this.#filters.selectedTemperatures.splice(idx, 1);
    } else {
      this.#filters.selectedTemperatures.push(temperature);
    }
  }

  setTemperatureFilter(mode: TemperatureFilterMode) {
    this.#filters.temperatureFilter = mode;
  }

  clearTypeAndTemperatureFilters() {
    this.#filters.selectedProductTypes = [];
    this.#filters.selectedTemperatures = [];
    this.#filters.temperatureFilter = "all";
  }

  setGroupBy(groupBy: "store" | "productType" | "none") {
    this.#filters.groupBy = groupBy;
  }

  toggleStore(store: string) {
    const idx = this.#filters.selectedStores.indexOf(store);
    if (idx > -1) {
      this.#filters.selectedStores.splice(idx, 1);
    } else {
      this.#filters.selectedStores.push(store);
    }
  }

  toggleWho(who: string) {
    const idx = this.#filters.selectedWho.indexOf(who);
    if (idx > -1) {
      this.#filters.selectedWho.splice(idx, 1);
    } else {
      this.#filters.selectedWho.push(who);
    }
  }

  clearStoreFilters() {
    this.#filters.selectedStores = [];
  }

  clearWhoFilters() {
    this.#filters.selectedWho = [];
  }

  setCompletionStatus(status: "all" | "completed" | "incomplete") {
    this.#filters.completionStatus = status;
  }

  handleSort(column: string) {
    if (this.#filters.sortColumn === column) {
      this.#filters.sortDirection =
        this.#filters.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.#filters.sortColumn = column;
      this.#filters.sortDirection = "asc";
    }
  }

  clearFilters() {
    this.#filters = {
      searchQuery: "",
      selectedStores: [],
      selectedWho: [],
      selectedProductTypes: [],
      selectedTemperatures: [],
      temperatureFilter: "all",
      completionStatus: "all",
      groupBy: "productType",
      sortColumn: "",
      sortDirection: "asc",
    };
  }

  // ===========================================================================
  // UTILITAIRES PUBLICS
  // ===========================================================================

  getEnrichedProductById(productId: string): EnrichedProduct | null {
    return this.#enrichedProducts.get(productId)?.data ?? null;
  }

  getProductModelById(productId: string): ProductModel | null {
    return this.#enrichedProducts.get(productId) ?? null;
  }

  hasConversions(productId: string): boolean {
    const product = this.#enrichedProducts.get(productId)?.data;
    if (!product?.byDate) return false;
    return hasConversions(product.byDate);
  }

  async forceReload(eventId: string) {
    this.reset();
    await this.initialize(eventId);
  }

  async clearCache() {
    this.#lastSync = null;
    await this.#productsCollection.clearLocal();
    await this.#purchasesCollection.clearLocal();
    // Also clear calculated needs
    await db.productNeeds.clear();
    console.log("[ProductsStore] Cache vidé");
  }

  // ===========================================================================
  // SYNC STATUS
  // ===========================================================================

  setSyncStatus(productIds: string[], syncing: boolean) {
    // Note: with $derived merge, sync status is set transiently.
    // The ProductModel instances are recreated on next derivation.
    // This is a best-effort approach for UI feedback during async operations.
    const status = syncing ? "isSyncing" : "active";
    console.log(
      `[ProductsStore] Statut sync: ${productIds.length} produits → ${status}`,
    );
  }

  clearSyncStatus() {
    // No-op with $derived merge — status is managed through data flow
  }

  // ===========================================================================
  // CRUD API PUBLIQUE
  // ===========================================================================

  async createPurchase(
    productId: string,
    quantities: Array<{ q: number; u: string }>,
    options: {
      invoiceId?: string;
      notes?: string;
      store?: string;
      price?: number | null;
      who?: string;
      status?: string | null;
      orderDate?: string | null;
      deliveryDate?: string | null;
    },
  ): Promise<void> {
    await createQuickValidationPurchases(
      this.#currentMainId!,
      productId,
      quantities,
      options,
    );
  }

  async updatePurchase(
    purchaseId: string,
    updates: Partial<Purchases>,
  ): Promise<void> {
    await updatePurchase(purchaseId, updates as Parameters<typeof updatePurchase>[1]);
  }

  async deletePurchase(purchaseId: string): Promise<void> {
    await updatePurchase(purchaseId, { status: "deleted" });
  }

  async createProduct(productData: {
    productName: string;
    productType?: string;
    pF?: boolean;
    pS?: boolean;
    status?: string;
    who?: string[];
    store?: string;
    stockReel?: string;
  }): Promise<string> {
    const newProduct = await upsertProduct(
      crypto.randomUUID(),
      productData,
      (id) => this.getEnrichedProductById(id),
    );

    // Persist to Dexie for immediate availability
    await db.products.put(newProduct as Products);

    return newProduct.$id;
  }

  async updateProduct(
    productId: string,
    updates: Partial<EnrichedProduct>,
  ): Promise<void> {
    const enrichedProduct = this.getEnrichedProductById(productId);
    if (enrichedProduct && !enrichedProduct.isSynced) {
      await upsertProduct(productId, updates, (id: string) =>
        this.getEnrichedProductById(id),
      );
    } else {
      await updateProductAppwrite(productId, updates);
    }
  }

  async updateProductBatch(
    productId: string,
    updates: Partial<EnrichedProduct>,
    callback?: (id: string) => EnrichedProduct | undefined,
  ): Promise<void> {
    await updateProductBatch(
      productId,
      updates,
      callback || ((id) => this.getEnrichedProductById(id)),
    );
  }

  async batchUpdateProducts(
    productIds: string[],
    products: EnrichedProduct[],
    updateType: "who" | "store",
    updateData: { names?: string[] } | StoreInfo,
  ): Promise<BatchUpdateResult> {
    return await batchUpdateProductsOptimized(
      productIds,
      products,
      updateType,
      updateData,
    );
  }

  async createGroupPurchase(
    productsData: Array<{
      productId: string;
      isSynced: boolean;
      missingQuantities: Array<{ q: number; u: string }>;
    }>,
    invoiceData: {
      invoiceId: string;
      invoiceTotal?: number;
      store?: string;
      notes?: string;
      who?: string;
      purchaseStatus?: string | null;
      purchaseDeliveryDate?: string | null;
    },
  ): Promise<GroupPurchaseBatchResult> {
    const { createGroupPurchaseWithSync } =
      await import("../services/appwrite-transaction");
    return await createGroupPurchaseWithSync(
      this.#currentMainId!,
      productsData,
      invoiceData,
    );
  }

  addProductOptimistic(product: Products) {
    // Write to Dexie directly - liveQuery will pick it up
    db.products.put(product).catch((err) =>
      console.error("[ProductsStore] Optimistic write failed:", err),
    );
  }

  // ===========================================================================
  // RESET / DESTROY
  // ===========================================================================

  reset() {
    console.log(`[ProductsStore] Reset pour eventId: ${this.#currentEventId}`);

    // Cleanup effects
    this.#cleanupSyncEffect?.();
    this.#cleanupSyncEffect = null;

    // Cleanup bridges
    this.#productsBridge?.subscription.unsubscribe();
    this.#productsBridge = null;
    this.#purchasesBridge?.subscription.unsubscribe();
    this.#purchasesBridge = null;
    this.#needsBridge?.subscription.unsubscribe();
    this.#needsBridge = null;

    // Cleanup aw-sync subscriptions
    this.#productsCollection.unsubscribeAll();
    this.#purchasesCollection.unsubscribeAll();

    // Reset metadata
    this.#currentMainId = null;
    this.#currentEventId = null;
    this.#isInitialized = false;
    this.#loading = false;
    this.#error = null;
    this.#syncing = false;
    this.#realtimeConnected = false;
    this.#lastSync = null;
    this.#lastMealsHash = "";

    this.dateStore.reset();

    this.#filters = {
      searchQuery: "",
      selectedStores: [],
      selectedWho: [],
      selectedProductTypes: [],
      selectedTemperatures: [],
      temperatureFilter: "all",
      completionStatus: "all",
      groupBy: "productType",
      sortColumn: "",
      sortDirection: "asc",
    };

    console.log("[ProductsStore] Reset termine");
  }

  destroy() {
    this.reset();
    console.log("[ProductsStore] Ressources nettoyees");
  }
}

// =============================================================================
// SINGLETON & EXPORTS
// =============================================================================

export const productsStore = new ProductsStore();
