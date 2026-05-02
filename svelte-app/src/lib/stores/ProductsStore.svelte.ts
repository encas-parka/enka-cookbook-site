import { SvelteMap } from "svelte/reactivity";
import { useDebounce } from "runed";
import { liveQuery } from "dexie";
import type { Subscription } from "dexie";
import type { Products, Purchases } from "../types/appwrite.d";

import {
  matchesFilters,
  computeFuzzySearchMatches,
  type FiltersState,
  type TemperatureFilterMode,
  hasConversions,
} from "../utils/productsUtils";
import {
  buildRawProductBase,
  applyNeedToBase,
  createEnrichedProductsFromEvent,
} from "../utils/productEnrichment";
import {
  parseNeedRow,
  toNeedRow,
  type ParsedNeed,
} from "../utils/product-need-serializer";
import {
  exportProductsToMarkdown,
  type MarkdownExportGroup,
} from "../utils/product-markdown-export";
import { exportProductsToCsv } from "../utils/product-csv-export";
import type {
  EnrichedProduct,
  StoreInfo,
  BatchUpdateResult,
} from "../types/store.types";
import type { EnrichedEvent } from "../types/events";

import { globalState } from "./GlobalState.svelte";
import { ProductModel } from "../models/ProductModel.svelte";
import { DateRangeStore } from "./DateRangeStore.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { recipesStore } from "./RecipesStore.svelte";
import {
  createSyncCollection,
  db,
  pb,
  type ProductNeedRow,
} from "$lib/db-sync/pb-sync";

/**
 * ProductsStore - Store principal de gestion des produits avec Svelte 5 + pb-sync
 *
 * Architecture simplifiée :
 * - 1 liveQuery Dexie observe les 3 tables (products, purchases, productNeeds)
 * - #onDataChange : merge des 3 sources + fingerprint → MAJ in-place des ProductModel
 * - #productModels (SvelteMap) : source de vérité unique, références stables
 * - #groups ($state) : vue groupée/filtrée, reconstruite explicitement
 *
 * Flux :
 *   liveQuery → #onDataChange → #productModels + #rebuildGroups
 *   filtres   → setter → #rebuildGroups
 *   date      → $effect → #rebuildGroups
 *   CRUD      → PocketBase → realtime → Dexie → liveQuery → #onDataChange
 *
 * @usage
 * await productsStore.initialize('eventId');
 * productsStore.setSearchQuery('pâtes');
 * const product = productsStore.getEnrichedProductById('abc');
 */

// =============================================================================
// STORE
// =============================================================================

class ProductsStore {
  // ===========================================================================
  // aw-sync COLLECTIONS (CRUD + sync Appwrite ↔ Dexie)
  // ===========================================================================

  #productsCollection = createSyncCollection<Products>(pb, db.products, "products");
  #purchasesCollection = createSyncCollection<Purchases>(pb, db.purchases, "purchases");

  // Map stable de ProductModel — UNIQUE source de vérité pour l'UI
  #productModels = new SvelteMap<string, ProductModel>();

  // Vue groupée/filtrée — $state plat, reconstruit par #rebuildGroups()
  #groups = $state<Record<string, ProductModel[]>>({});

  // Souscription liveQuery Dexie (1 pour les 3 tables)
  #dataSubscription: Subscription | null = null;

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
  #cleanupDateEffect: (() => void) | null = null;

  // Filters
  #filters = $state<FiltersState>({
    searchQuery: "",
    selectedStores: [],
    selectedWho: [],
    selectedProductTypes: [],
    selectedTemperatures: [],
    temperatureFilter: "all",
    storeFilterMode: "all",
    whoFilterMode: "all",
    deliveryDateFilter: null,
    completionStatus: "all",
    groupBy: "productType",
    sortColumn: "",
    sortDirection: "asc",
  });

  // Date range
  dateStore = new DateRangeStore();

  // ===========================================================================
  // DATA CHANGE : liveQuery → merge + fingerprint → ProductModels + groups
  // ===========================================================================

  /**
   * Lance la souscription liveQuery sur les 3 tables Dexie.
   */
  #startDataSubscription(mainId: string) {
    this.#dataSubscription?.unsubscribe();

    this.#dataSubscription = liveQuery(async () => {
      const [products, purchases, needs] = await Promise.all([
        db.products.where("mainId").equals(mainId).toArray(),
        db.purchases.where("mainId").equals(mainId).toArray(),
        db.productNeeds.where("mainId").equals(mainId).toArray(),
      ]);
      return { products, purchases, needs };
    }).subscribe({
      next: ({ products, purchases, needs }) => {
        this.#onDataChange(products, purchases, needs);
      },
      error: (err) => {
        console.error("[ProductsStore] liveQuery error:", err);
      },
    });
  }

  /**
   * Point d'entrée unique quand les données Dexie changent.
   * Merge les 3 sources, compare les fingerprints, met à jour les ProductModels,
   * puis reconstruit les groupes.
   */
  #onDataChange(products: Products[], purchases: Purchases[], needs: ProductNeedRow[]) {
    // ── 1. Indexer les sources ──────────────────────────────
    const productsById = new Map(products.map((p) => [p.$id, p]));
    const needsById = new Map(needs.map((n) => [n.$id, n]));

    const purchasesByProduct = new Map<string, Purchases[]>();
    const orphanPurchases = new SvelteMap<string, Purchases>();
    for (const purchase of purchases) {
      if (purchase.status === "expense") {
        orphanPurchases.set(purchase.$id, purchase);
        continue;
      }
      if (purchase.status === "deleted") continue;
      for (const productId of purchase.products ?? []) {
        const list = purchasesByProduct.get(productId) ?? [];
        list.push(purchase);
        purchasesByProduct.set(productId, list);
      }
    }
    this.#orphanPurchases = orphanPurchases;
    this.#purchasesByProductCache = purchasesByProduct;

    // ── 2. Identifier tous les IDs connus ───────────────────
    const allIds = new Set<string>();
    for (const id of productsById.keys()) allIds.add(id);
    for (const id of needsById.keys()) allIds.add(id);

    const staleIds = new Set(this.#productModels.keys());

    // ── 3. Merge + fingerprint + mise à jour ────────────────
    for (const id of allIds) {
      staleIds.delete(id);

      const raw = productsById.get(id);
      const needRow = needsById.get(id);
      const prods = purchasesByProduct.get(id) ?? [];

      // Fingerprint (tri des purchases pour stabilité)
      const version = [
        raw?.$updatedAt ?? "",
        needRow?.$updatedAt ?? "",
        ...prods.map((p) => p.$updatedAt).filter(Boolean).sort(),
      ].join("|");

      const existing = this.#productModels.get(id);

      // Skip si inchangé
      if (existing && existing._version === version) continue;

      // Merge des 3 sources → EnrichedProduct
      const need = needRow ? parseNeedRow(needRow) : null;
      const enriched = this.#buildEnriched(raw, need, prods);

      if (existing) {
        existing.update(enriched);
        existing._version = version;
      } else {
        const model = new ProductModel(enriched, this.dateStore);
        model._version = version;
        this.#productModels.set(id, model);
      }
    }

    // ── 4. Supprimer les modèles obsolètes ──────────────────
    for (const id of staleIds) {
      this.#productModels.delete(id);
    }

    // ── 5. Reconstruire les groupes ─────────────────────────
    this.#rebuildGroups();
  }

  // Cache pour financialStats (mis à jour par #onDataChange)
  #orphanPurchases = new SvelteMap<string, Purchases>();
  #purchasesByProductCache = new Map<string, Purchases[]>();

  /**
   * Fusionne 0–3 sources en un seul EnrichedProduct.
   */
  #buildEnriched(
    raw: Products | undefined,
    need: ParsedNeed | null,
    purchases: Purchases[],
  ): EnrichedProduct {
    if (raw && need) {
      const base = buildRawProductBase({ ...raw, purchases });
      return applyNeedToBase(base, need);
    }

    if (raw) {
      return buildRawProductBase({ ...raw, purchases });
    }

    if (need) {
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
        displayTotalNeeded: "",
        displayMissingQuantity: "",
        displayTotalOverride: "",
        totalNeededOverrideParsed: null,
        dateDisplayInfo: need.dateDisplayInfo,
        specs: null,
      };
    }

    throw new Error("[ProductsStore] buildEnriched appelé sans données");
  }

  // ===========================================================================
  // GROUPING : filtrage + groupement (explicite, pas $derived)
  // ===========================================================================

  /**
   * Reconstruit #groups à partir de #productModels + #filters + dateRange.
   * Appelé par #onDataChange, les setters de filtres, et le date effect.
   */
  #rebuildGroups() {
    if (!this.dateRange.start || !this.dateRange.end) {
      this.#groups = {};
      return;
    }

    const groups: Record<string, ProductModel[]> = {};

    // Pre-compute fuzzy search matches once for all products
    const fuzzyMatchedIds = this.#filters.searchQuery.trim()
      ? computeFuzzySearchMatches(
          Array.from(this.#productModels.values()).map(m => m.data),
          this.#filters.searchQuery,
        )
      : undefined;

    for (const [id, model] of this.#productModels) {
      if (!this.#passesFilters(model, fuzzyMatchedIds)) continue;
      const key = this.#groupKey(model);
      (groups[key] ??= []).push(model);
    }

    for (const key of Object.keys(groups)) {
      const models = groups[key]!;
      if (this.#filters.sortColumn) {
        const col = this.#filters.sortColumn as keyof import("../types/store.types").EnrichedProduct;
        const dir = this.#filters.sortDirection === "asc" ? 1 : -1;
        models.sort((a, b) => {
          const aVal = a.data[col];
          const bVal = b.data[col];
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return dir;
          if (bVal == null) return -dir;
          if (typeof aVal === "string" && typeof bVal === "string")
            return dir * aVal.localeCompare(bVal);
          if (aVal < bVal) return -dir;
          if (aVal > bVal) return dir;
          return 0;
        });
      } else {
        models.sort((a, b) => a.data.$id.localeCompare(b.data.$id));
      }
    }

    // Tri des clés de groupe (vide en dernier)
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    });

    const sortedGroups: Record<string, ProductModel[]> = {};
    for (const key of sortedKeys) {
      sortedGroups[key] = groups[key]!;
    }

    this.#groups = sortedGroups;
  }

  /** Un ProductModel passe-t-il les filtres courants ? */
  #passesFilters(model: ProductModel, fuzzyMatchedIds?: Set<string>): boolean {
    const product = model.data;
    const isManualProduct = !product.productHugoUuid;

    if (!product.byDate && !isManualProduct) return false;
    if (!matchesFilters(product, this.#filters, fuzzyMatchedIds)) return false;

    // Filtre completion (dépend de model.stats → dateRange)
    if (this.#filters.completionStatus !== "all") {
      const hasMissing = model.stats.hasMissing;
      if (this.#filters.completionStatus === "completed" && hasMissing) return false;
      if (this.#filters.completionStatus === "incomplete" && !hasMissing) return false;
    }

    // Filtre date de livraison (produits avec purchase "ordered" à cette date)
    if (this.#filters.deliveryDateFilter) {
      const hasOrderedDelivery = product.purchases?.some(
        (p) =>
          p.status === "ordered" &&
          p.deliveryDate === this.#filters.deliveryDateFilter,
      );
      if (!hasOrderedDelivery) return false;
    }

    // Filtre date range
    if (product.byDate) {
      const hasDataInRange = Object.keys(product.byDate).some(
        (dateStr) => dateStr >= this.dateRange.start! && dateStr <= this.dateRange.end!,
      );
      if (!hasDataInRange && !isManualProduct) return false;
    }

    return true;
  }

  /** Calcule la clé de groupe pour un modèle. */
  #groupKey(model: ProductModel): string {
    if (this.#filters.groupBy === "none") return "";
    if (this.#filters.groupBy === "store") {
      return model.data.storeInfo?.storeName || "Non défini";
    }
    return model.data.productType || "Non défini";
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
      this.filters.storeFilterMode !== "all" ||
      this.filters.whoFilterMode !== "all" ||
      this.filters.deliveryDateFilter !== null ||
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
    } else if (this.filters.storeFilterMode === "none") {
      descriptions.push("Sans magasin");
    }

    if (this.filters.selectedWho.length > 0) {
      descriptions.push(`Qui: ${this.filters.selectedWho.length}`);
    } else if (this.filters.whoFilterMode === "none") {
      descriptions.push("Sans personne");
    }

    if (this.filters.deliveryDateFilter) {
      descriptions.push(`Livraison: ${this.filters.deliveryDateFilter}`);
    }

    return descriptions;
  }

  get groupedProducts() {
    return this.#groups;
  }

  // ===========================================================================
  // DERIVED: Stats globales (lisent directement #productModels)
  // ===========================================================================

  stats = $derived.by(() => ({
    total: this.#productModels.size,
    frais: Array.from(this.#productModels.values()).filter((p) => p.data.pF)
      .length,
    surgel: Array.from(this.#productModels.values()).filter((p) => p.data.pS)
      .length,
    merged: Array.from(this.#productModels.values()).filter(
      (p) => p.data.isMerged,
    ).length,
  }));

  uniqueStores = $derived.by(() => {
    const storeNames = Array.from(this.#productModels.values())
      .map((p) => p.data.storeInfo?.storeName)
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
    const whos = Array.from(this.#productModels.values()).flatMap(
      (p) => p.data.who || [],
    );
    return [...new Set(whos)].sort();
  });

  uniqueWho = $derived.by(() => {
    const allWho = new Set([...this.eventContributors, ...this.#usedWho]);
    return Array.from(allWho).sort();
  });

  uniqueProductTypes = $derived.by(() => {
    const types = Array.from(this.#productModels.values())
      .map((p) => p.data.productType)
      .filter(Boolean);
    return [...new Set(types)] as string[];
  });

  uniqueDeliveryDates = $derived.by(() => {
    const dates = new Set<string>();
    for (const model of this.#productModels.values()) {
      for (const purchase of model.data.purchases ?? []) {
        if (purchase.status === "ordered" && purchase.deliveryDate) {
          dates.add(purchase.deliveryDate);
        }
      }
    }
    return Array.from(dates).sort();
  });

  completionStats = $derived.by(() => {
    let completed = 0;
    let missing = 0;
    for (const model of this.#productModels.values()) {
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

    // Utilise les caches mis à jour par le reconciler
    for (const purchase of this.#orphanPurchases.values()) {
      if (purchase.status === "deleted") continue;
      const amount = purchase.invoiceTotal || purchase.price || 0;
      totalGlobal += amount;
      const store = purchase.store || "Non défini";
      byStore[store] = (byStore[store] || 0) + amount;
      const who = purchase.who || "Non défini";
      byWho[who] = (byWho[who] || 0) + amount;
      allPurchases.push(purchase);
    }

    for (const model of this.#productModels.values()) {
      const product = model.data;
      const purchases = this.#purchasesByProductCache.get(product.$id) || [];
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

      // 1. Delta sync PocketBase → Dexie
      this.#syncing = true;
      await this.#productsCollection.initialFetch({
        filter: ["mainId = {:mainId}", { mainId: this.#currentMainId! }],
      });
      await this.#purchasesCollection.initialFetch({
        filter: ["mainId = {:mainId}", { mainId: this.#currentMainId! }],
      });
      this.#syncing = false;
      this.#lastSync = new Date().toISOString();

      // 2. Calculate needs if none in Dexie yet
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

      // 3. Lancer le liveQuery unique (observe 3 tables → reconciler)
      this.#startDataSubscription(this.#currentMainId!);

      // 4. Abonnements realtime (PocketBase SSE → Dexie → liveQuery → reconciler)
      this.#productsCollection.subscribe();
      this.#purchasesCollection.subscribe();

      // 5. Setup reactive sync avec EventsStore (meals updates → Dexie → liveQuery)
      this.#setupMealsSyncEffect(eventId);

      // 6. Date range
      this.dateStore.setAvailableDates([...(event.allDates || [])]);
      this.dateStore.initializeSmartRange();

      // 7. Date range effect : rebuild groups quand les dates changent
      this.#setupDateRangeEffect();

      this.#isInitialized = true;
      this.#loading = false;

      console.log(
        `[ProductsStore] Initialisation terminee: ${this.#productModels.size} produits`,
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
  // DATE RANGE EFFECT : rebuild groups quand la plage de dates change
  // ===========================================================================

  #setupDateRangeEffect() {
    this.#cleanupDateEffect?.();
    this.#cleanupDateEffect = $effect.root(() => {
      $effect(() => {
        const { start, end } = this.dateStore.current;
        if (start && end && this.#isInitialized) {
          this.#rebuildGroups();
        }
      });
    });
  }

  // ===========================================================================
  // SYNC WITH EVENT MEALS
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
    const groups: MarkdownExportGroup[] = Object.entries(this.#groups).map(
      ([label, models]) => ({
        label,
        products: models.map((m) => ({
          productName: m.data.productName,
          formattedQuantities: m.stats.formattedQuantities,
          acquiredQuantities: m.stats.acquiredQuantities,
          formattedAcquiredQuantities: m.stats.formattedAcquiredQuantities,
          missingQuantities: m.stats.missingQuantities,
          formattedMissingQuantities: m.stats.formattedMissingQuantities,
        })),
      }),
    );

    return exportProductsToMarkdown({
      eventName,
      dateRange: this.dateStore.current,
      groups,
    });
  }

  // ===========================================================================
  // EXPORT CSV
  // ===========================================================================

  exportToCsv(): string {
    const allProducts = Object.values(this.#groups).flat();

    return exportProductsToCsv({
      products: allProducts.map((m) => ({
        productName: m.data.productName,
        productType: m.data.productType || "Non défini",
        storeName: m.data.storeInfo?.storeName || "Non défini",
        who: (m.data.who || []).join(", "),
        formattedQuantities: m.stats.formattedQuantities,
        formattedAcquiredQuantities: m.stats.formattedAcquiredQuantities,
        formattedMissingQuantities: m.stats.formattedMissingQuantities,
      })),
    });
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
      this.#rebuildGroups();
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
    this.#rebuildGroups();
  }

  toggleTemperature(temperature: "frais" | "surgele") {
    const idx = this.#filters.selectedTemperatures.indexOf(temperature);
    if (idx > -1) {
      this.#filters.selectedTemperatures.splice(idx, 1);
    } else {
      this.#filters.selectedTemperatures.push(temperature);
    }
    this.#rebuildGroups();
  }

  setTemperatureFilter(mode: TemperatureFilterMode) {
    this.#filters.temperatureFilter = mode;
    this.#rebuildGroups();
  }

  clearTypeAndTemperatureFilters() {
    this.#filters.selectedProductTypes = [];
    this.#filters.selectedTemperatures = [];
    this.#filters.temperatureFilter = "all";
    this.#rebuildGroups();
  }

  setGroupBy(groupBy: "store" | "productType" | "none") {
    this.#filters.groupBy = groupBy;
    this.#rebuildGroups();
  }

  toggleStore(store: string) {
    this.#filters.storeFilterMode = "all";
    const idx = this.#filters.selectedStores.indexOf(store);
    if (idx > -1) {
      this.#filters.selectedStores.splice(idx, 1);
    } else {
      this.#filters.selectedStores.push(store);
    }
    this.#rebuildGroups();
  }

  toggleWho(who: string) {
    this.#filters.whoFilterMode = "all";
    const idx = this.#filters.selectedWho.indexOf(who);
    if (idx > -1) {
      this.#filters.selectedWho.splice(idx, 1);
    } else {
      this.#filters.selectedWho.push(who);
    }
    this.#rebuildGroups();
  }

  clearStoreFilters() {
    this.#filters.selectedStores = [];
    this.#filters.storeFilterMode = "all";
    this.#rebuildGroups();
  }

  clearWhoFilters() {
    this.#filters.selectedWho = [];
    this.#filters.whoFilterMode = "all";
    this.#rebuildGroups();
  }

  setStoreFilterMode(mode: "all" | "none") {
    this.#filters.storeFilterMode = mode;
    this.#filters.selectedStores = [];
    this.#rebuildGroups();
  }

  setWhoFilterMode(mode: "all" | "none") {
    this.#filters.whoFilterMode = mode;
    this.#filters.selectedWho = [];
    this.#rebuildGroups();
  }

  setCompletionStatus(status: "all" | "completed" | "incomplete") {
    this.#filters.completionStatus = status;
    if (status !== "all") {
      this.#filters.deliveryDateFilter = null;
    }
    this.#rebuildGroups();
  }

  setDeliveryDateFilter(date: string | null) {
    this.#filters.deliveryDateFilter = date;
    if (date) {
      this.#filters.completionStatus = "all";
    }
    this.#rebuildGroups();
  }

  handleSort(column: string) {
    if (this.#filters.sortColumn === column) {
      this.#filters.sortDirection =
        this.#filters.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.#filters.sortColumn = column;
      this.#filters.sortDirection = "asc";
    }
    this.#rebuildGroups();
  }

  clearFilters() {
    this.#filters = {
      searchQuery: "",
      selectedStores: [],
      selectedWho: [],
      selectedProductTypes: [],
      selectedTemperatures: [],
      temperatureFilter: "all",
      storeFilterMode: "all",
      whoFilterMode: "all",
      deliveryDateFilter: null,
      completionStatus: "all",
      groupBy: "productType",
      sortColumn: "",
      sortDirection: "asc",
    };
    this.#rebuildGroups();
  }

  // ===========================================================================
  // UTILITAIRES PUBLICS
  // ===========================================================================

  getEnrichedProductById(productId: string): EnrichedProduct | null {
    return this.#productModels.get(productId)?.data ?? null;
  }

  getProductModelById(productId: string): ProductModel | null {
    return this.#productModels.get(productId) ?? null;
  }

  hasConversions(productId: string): boolean {
    const product = this.#productModels.get(productId)?.data;
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

  /**
   * Force un delta sync PocketBase → Dexie pour les produits et achats.
   *
   * Appelé par NotificationStore après une notification batch_products_update.
   * Avec PocketBase, le SSE relaie les modifications en temps réel,
   * ce delta sync garantit que Dexie (et donc le liveQuery → #onDataChange) est à jour.
   */
  async syncFromAppwrite(): Promise<void> {
    if (!this.#currentMainId) {
      console.warn("[ProductsStore] syncFromAppwrite() appelé sans currentMainId");
      return;
    }

    try {
      await Promise.all([
        this.#productsCollection.initialFetch({
          filter: ["mainId = {:mainId}", { mainId: this.#currentMainId }],
        }),
        this.#purchasesCollection.initialFetch({
          filter: ["mainId = {:mainId}", { mainId: this.#currentMainId }],
        }),
      ]);
      this.#lastSync = new Date().toISOString();
      console.log("[ProductsStore] syncFromAppwrite() terminé");
    } catch (err) {
      console.error("[ProductsStore] syncFromAppwrite() échoué:", err);
    }
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
    const purchaseStatus = options.status || "delivered";
    let deliveryDate = options.deliveryDate || null;
    if (purchaseStatus === "delivered" && !deliveryDate) {
      deliveryDate = new Date().toISOString();
    }

    for (const qty of quantities) {
      await this.#purchasesCollection.create({
        products: [productId],
        mainId: this.#currentMainId!,
        quantity: qty.q,
        unit: qty.u,
        status: purchaseStatus,
        notes: options.notes || "",
        store: options.store ?? null,
        who: options.who || globalState.userName,
        price: options.price || null,
        orderDate: options.orderDate || null,
        deliveryDate,
        createdBy: globalState.userId,
        invoiceId: options.invoiceId,
        invoiceTotal: null,
      } as unknown as Omit<Purchases, "$id" | "$createdAt" | "$updatedAt">);
    }
  }

  async updatePurchase(
    purchaseId: string,
    updates: Partial<Purchases>,
  ): Promise<void> {
    await this.#purchasesCollection.update(purchaseId, updates);
  }

  async deletePurchase(purchaseId: string): Promise<void> {
    await this.#purchasesCollection.update(purchaseId, { status: "deleted" } as Partial<Purchases>);
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
    const productId = crypto.randomUUID();

    const spec = { pF: productData.pF || false, pS: productData.pS || false };

    const newProduct = await this.#productsCollection.create({
      productHugoUuid: null,
      productName: productData.productName,
      productType: productData.productType || "Autre",
      store: productData.store || null,
      who: productData.who || [],
      mainId: this.#currentMainId!,
      status: productData.status || "active",
      stockReel: productData.stockReel || null,
      updatedBy: globalState.userName,
      isMerged: false,
      mergedFrom: null,
      mergeDate: null,
      mergeReason: null,
      mergedInto: null,
      totalNeededOverride: null,
      specs: JSON.stringify(spec),
    } as unknown as Omit<Products, "$id" | "$createdAt" | "$updatedAt">);

    return newProduct.$id;
  }

  async updateProduct(
    productId: string,
    updates: Partial<EnrichedProduct>,
  ): Promise<void> {
    await this.#productsCollection.update(productId, updates as Partial<Products>);
  }

  async updateProductBatch(
    productId: string,
    updates: Partial<EnrichedProduct>,
    _callback?: (id: string) => EnrichedProduct | undefined,
  ): Promise<void> {
    await this.#productsCollection.update(productId, updates as Partial<Products>);
  }

  async batchUpdateProducts(
    productIds: string[],
    _products: EnrichedProduct[],
    updateType: "who" | "store",
    updateData: { names?: string[] } | StoreInfo,
  ): Promise<BatchUpdateResult> {
    try {
      const batchSize = 50;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = pb.createBatch();
        const chunk = productIds.slice(i, i + batchSize);

        for (const productId of chunk) {
          if (updateType === "who") {
            const names = (updateData as { names?: string[] }).names || null;
            batch.collection("products").update(productId, { who: names });
          } else {
            const storeInfo = updateData as StoreInfo;
            batch.collection("products").update(productId, { store: JSON.stringify(storeInfo) });
          }
        }

        await batch.send();
      }

      return {
        success: true,
        updatedCount: productIds.length,
        updateType,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        updatedCount: productIds.length,
        updateType,
        error: err instanceof Error ? err.message : "Erreur inconnue",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Résultat d'un achat groupé (inline — remplace GroupPurchaseBatchResult d'Appwrite).
   */
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
  ): Promise<{
    success: boolean;
    totalProductsCreated: number;
    totalPurchasesCreated: number;
    totalExpensesCreated: number;
    error?: string;
  }> {
    if (!productsData.length) {
      return { success: false, totalProductsCreated: 0, totalPurchasesCreated: 0, totalExpensesCreated: 0, error: "Aucun produit à traiter" };
    }

    const purchaseStatus = invoiceData.purchaseStatus || "delivered";
    let deliveryDate = invoiceData.purchaseDeliveryDate || null;
    if (purchaseStatus === "delivered" && !deliveryDate) {
      deliveryDate = new Date().toISOString();
    }

    const mainId = this.#currentMainId!;
    let totalPurchasesCreated = 0;
    let totalExpensesCreated = 0;

    try {
      // Découpage en lots de 50 opérations max par createBatch()
      const BATCH_SIZE = 50;
      const allOperations: Array<{ productId: string; qty: { q: number; u: string } }> = [];

      for (const p of productsData) {
        if (!p.isSynced) {
          // Product not yet created in PB — create it first
          const enriched = this.getEnrichedProductById(p.productId);
          if (enriched) {
            await this.#productsCollection.create({
              productHugoUuid: enriched.productHugoUuid,
              productName: enriched.productName,
              productType: enriched.productType || "",
              store: enriched.store as string | null,
              who: enriched.who || [],
              mainId,
              status: "active",
              stockReel: enriched.stockReel,
              isMerged: enriched.isMerged || false,
              specs: enriched.specs || null,
            } as unknown as Omit<Products, "$id" | "$createdAt" | "$updatedAt">);
          }
        }
        for (const qty of p.missingQuantities) {
          allOperations.push({ productId: p.productId, qty });
        }
      }

      // Traiter par lots
      for (let i = 0; i < allOperations.length; i += BATCH_SIZE) {
        const batch = pb.createBatch();
        const chunk = allOperations.slice(i, i + BATCH_SIZE);

        for (const op of chunk) {
          batch.collection("purchases").create({
            products: [op.productId],
            mainId,
            quantity: op.qty.q,
            unit: op.qty.u,
            status: purchaseStatus,
            notes: invoiceData.notes || "",
            store: invoiceData.store || null,
            who: invoiceData.who || globalState.userName,
            orderDate: null,
            deliveryDate,
            createdBy: globalState.userId,
            invoiceId: invoiceData.invoiceId,
          });
          totalPurchasesCreated++;
        }

        await batch.send();
      }

      // Expense optionnelle
      if (invoiceData.invoiceTotal) {
        await this.#purchasesCollection.create({
          products: [],
          mainId,
          quantity: 1,
          unit: "global",
          status: "expense",
          notes: invoiceData.notes || "",
          store: invoiceData.store || null,
          who: invoiceData.who || globalState.userName,
          price: invoiceData.invoiceTotal,
          invoiceId: invoiceData.invoiceId,
          invoiceTotal: invoiceData.invoiceTotal,
          orderDate: null,
          deliveryDate: deliveryDate!,
          createdBy: globalState.userId,
        } as unknown as Omit<Purchases, "$id" | "$createdAt" | "$updatedAt">);
        totalExpensesCreated = 1;
      }

      return { success: true, totalProductsCreated: productsData.length, totalPurchasesCreated, totalExpensesCreated };
    } catch (err) {
      return {
        success: false,
        totalProductsCreated: productsData.length,
        totalPurchasesCreated,
        totalExpensesCreated,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      };
    }
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
    this.#cleanupDateEffect?.();
    this.#cleanupDateEffect = null;

    // Cleanup liveQuery
    this.#dataSubscription?.unsubscribe();
    this.#dataSubscription = null;

    // Cleanup pb-sync subscriptions
    this.#productsCollection.unsubscribeAll();
    this.#purchasesCollection.unsubscribeAll();

    // Vider les structures de données
    this.#productModels.clear();
    this.#groups = {};
    this.#orphanPurchases = new SvelteMap();
    this.#purchasesByProductCache = new Map();

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
      storeFilterMode: "all",
      whoFilterMode: "all",
      deliveryDateFilter: null,
      completionStatus: "all",
      groupBy: "productType",
      sortColumn: "",
      sortDirection: "asc",
    };

    console.log("[ProductsStore] Reset termine");
  }

  async destroy() {
    this.reset();
    // Nettoyer IndexedDB pour éviter les fuites de données entre utilisateurs
    await this.#productsCollection.clearLocal();
    await this.#purchasesCollection.clearLocal();
    await db.productNeeds.clear();
    console.log("[ProductsStore] Ressources nettoyees");
  }
}

// =============================================================================
// SINGLETON & EXPORTS
// =============================================================================

export const productsStore = new ProductsStore();
