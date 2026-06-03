import { SvelteMap } from "svelte/reactivity";
import { useDebounce } from "runed";
import { Query } from "appwrite";
import { liveQuery } from "dexie";
import type { Subscription } from "dexie";
import type { Products, Purchases } from "../types/appwrite.d";

import {
  matchesFilters,
  computeFuzzySearchMatches,
  extractNameFromProductId,
  type FiltersState,
  type TemperatureFilterMode,
  hasConversions,
} from "../utils/productsUtils";
import {
  buildRawProductBase,
  applyNeedToBase,
  createEnrichedProductsFromEvent,
  mergeEnrichedProducts,
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
import { toastService } from "../services/toast.service.svelte";
import type {
  EnrichedProduct,
  StoreInfo,
  BatchUpdateResult,
} from "../types/store.types";
import type { EnrichedEvent } from "../types/events";
import {
  createQuickValidationPurchases,
  updatePurchase,
  upsertProduct,
  updateProduct as updateProductAppwrite,
  updateProductBatch,
  batchUpdateProductsOptimized,
  mergeProductsAppwrite,
  unmergeProductAppwrite,
  isNotFoundError,
} from "../services/appwrite-products";
import type { GroupPurchaseBatchResult } from "../services/appwrite-transaction";

import { globalState } from "./GlobalState.svelte";
import { ProductModel } from "../models/ProductModel.svelte";
import { DateRangeStore } from "./DateRangeStore.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { recipesStore } from "./RecipesStore.svelte";
import {
  createSyncCollection,
  db,
  type ProductNeedRow,
} from "$lib/db-sync/aw-sync";

/**
 * ProductsStore - Store principal de gestion des produits avec Svelte 5 + aw-sync
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
 *   CRUD      → Appwrite → realtime → Dexie → liveQuery → #onDataChange
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

  #productsCollection = createSyncCollection<Products>({
    table: db.products,
    collectionName: "products",
  });
  #purchasesCollection = createSyncCollection<Purchases>({
    table: db.purchases,
    collectionName: "purchases",
  });

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

    // ── 1b. Remapping virtuel des purchases des produits mergés ──
    const mergeTargetIds = new Set<string>(); // IDs des targets de merge (pour forcer rebuild)
    for (const [sourceId, rawProduct] of productsById) {
      if (!rawProduct.mergedInto) continue;
      const targetId = rawProduct.mergedInto;
      mergeTargetIds.add(targetId);
      if (!productsById.has(targetId) && !needsById.has(targetId)) {
        console.warn(`[ProductsStore] Merge target "${targetId}" introuvable pour "${sourceId}"`);
        continue;
      }
      const sourcePurchases = purchasesByProduct.get(sourceId);
      if (!sourcePurchases?.length) continue;
      const targetPurchases = purchasesByProduct.get(targetId) ?? [];
      purchasesByProduct.set(targetId, [...targetPurchases, ...sourcePurchases]);
      purchasesByProduct.delete(sourceId); // les purchases sont maintenant sous le target
    }

    // ── 2. Identifier tous les IDs connus ───────────────────
    const allIds = new Set<string>();
    for (const id of productsById.keys()) allIds.add(id);
    for (const id of needsById.keys()) allIds.add(id);

    const staleIds = new Set(this.#productModels.keys());

    // ── 3. Merge + fingerprint + mise à jour ────────────────
    // Les targets de merge sont TOUJOURS reconstruits (jamais skippés)
    // pour garantir que mergedProductNames/Ids et byDate sont calculés à partir
    // de données fraîches, sans accumulation sur les passes multiples du reconciler.
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

      // Skip si inchangé, SAUF pour les targets de merge (toujours reconstruits)
      const isMergeTarget = mergeTargetIds.has(id);
      if (existing && existing._version === version && !isMergeTarget) continue;

      // Merge des 3 sources → EnrichedProduct
      const need = needRow ? parseNeedRow(needRow) : null;
      const enriched = this.#buildEnriched(raw, need, prods);

      this.#productNameCache.set(id, { name: enriched.productName, type: enriched.productType });

      if (existing) {
        existing.update(enriched);
        existing._version = version;
      } else {
        const model = new ProductModel(enriched, this.dateStore);
        model._version = version;
        this.#productModels.set(id, model);
      }
    }

    // ── 3b. Agréger les produits mergés dans leurs targets ─────
    const mergedSourceIds = new Set<string>();
    for (const [id, model] of this.#productModels) {
      if (!model.data.mergedInto) continue;
      const targetId = model.data.mergedInto;
      const targetModel = this.#productModels.get(targetId);
      if (!targetModel) {
        console.warn(`[ProductsStore] Merge target "${targetId}" non trouvé pour "${id}", le source reste visible`);
        continue;
      }
      // Agréger les données du source dans le target
      mergeEnrichedProducts(targetModel.data, model.data);
      targetModel.data.mergedFrom.push({ id: model.data.$id, name: model.data.productName });
      mergedSourceIds.add(id);
    }
    // Supprimer les modèles sources mergés
    for (const id of mergedSourceIds) {
      this.#productModels.delete(id);
    }

    // ── 4. Supprimer les modèles obsolètes ──────────────────
    for (const id of staleIds) {
      this.#productModels.delete(id);
    }

    // ── 4b. Détecter les achats orphelins (purchases sans produit actif) ──
    const orphaned: Array<{ productId: string; productName: string; productType: string; purchases: Purchases[] }> = [];
    for (const [productId, purchs] of purchasesByProduct) {
      if (this.#productModels.has(productId)) continue;
      if (purchs.length === 0) continue;
      // Guard anti-fuite : ne pas afficher les purchases des produits mergés
      // (leurs purchases ont été remappées vers le target à l'étape 1b,
      //  mais on garde ce guard comme filet de sécurité)
      if (mergedSourceIds.has(productId)) continue;
      const cached = this.#productNameCache.get(productId);
      orphaned.push({
        productId,
        productName: cached?.name ?? extractNameFromProductId(productId),
        productType: cached?.type ?? "",
        purchases: purchs,
      });
    }
    this.#orphanedPurchasesInfo = orphaned;

    // ── 5. Reconstruire le cache fuzzy + les groupes ──────────
    this.#rebuildFuzzyCache();
    this.#rebuildGroups();
  }

  // Cache pour financialStats (mis à jour par #onDataChange)
  #orphanPurchases = new SvelteMap<string, Purchases>();
  #purchasesByProductCache = new Map<string, Purchases[]>();
  #productNameCache = new Map<string, { name: string; type: string }>();
  #orphanedPurchasesInfo = $state<Array<{ productId: string; productName: string; productType: string; purchases: Purchases[] }>>([]);
  // Cache pour la recherche fuzzy — invalidé quand #productModels change
  #fuzzySearchable: { $id: string; productName: string; recipeNames: string }[] = [];

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
        mergeDate: null,
        mergedInto: null,
        mergedFrom: [],
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

  /**
   * Reconstruit le cache searchable pour la recherche fuzzy.
   * Appelé uniquement quand #productModels change (dans #onDataChange),
   * PAS à chaque frappe clavier.
   */
  #rebuildFuzzyCache() {
    this.#fuzzySearchable = Array.from(this.#productModels.values()).map((m) => ({
      $id: m.data.$id,
      productName: m.data.productName,
      recipeNames: Object.values(m.data.byDate ?? {})
        .flatMap((entry) => entry.recipes.map((r) => r.r))
        .filter(Boolean)
        .join(" "),
    }));
  }

  #rebuildGroups() {
    if (!this.dateRange.start || !this.dateRange.end) {
      this.#groups = {};
      return;
    }

    const groups: Record<string, ProductModel[]> = {};

    // Recherche fuzzy sur le cache pré-construit (pas de O(P×R) à chaque frappe)
    const fuzzyMatchedIds = this.#filters.searchQuery.trim()
      ? computeFuzzySearchMatches(this.#fuzzySearchable, this.#filters.searchQuery)
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

    if (this.#filters.completionStatus !== "all") {
      const hasMissing = model.stats.hasMissing;
      if (this.#filters.completionStatus === "completed" && hasMissing) return false;
      if (this.#filters.completionStatus === "incomplete" && !hasMissing) return false;
    }

    if (this.#filters.deliveryDateFilter) {
      const hasOrderedDelivery = product.purchases?.some(
        (p) =>
          p.status === "ordered" &&
          p.deliveryDate === this.#filters.deliveryDateFilter,
      );
      if (!hasOrderedDelivery) return false;
    }

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

  get orphanedPurchases() {
    return this.#orphanedPurchasesInfo;
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
      (p) => p.data.mergedInto !== null,
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

      // 1. Delta sync Appwrite → Dexie
      this.#syncing = true;
      await this.#productsCollection.initialFetch({
        queries: [Query.equal("mainId", this.#currentMainId!)],
        scopeKey: this.#currentMainId!,
      });
      await this.#purchasesCollection.initialFetch({
        queries: [Query.equal("mainId", this.#currentMainId!)],
        scopeKey: this.#currentMainId!,
      });
      this.#syncing = false;
      this.#lastSync = new Date().toISOString();

      // 2. Calculate needs if none in Dexie yet
      const existingNeedsCount = await db.productNeeds
        .where("mainId")
        .equals(this.#currentMainId!)
        .count();
      await recipesStore.syncReady;

      if (existingNeedsCount === 0) {
        console.log(
          "[ProductsStore] Aucun besoin calculé en cache, calcul depuis event.meals...",
        );
        await this.#calculateAndPersistNeeds(event);
      }

      const recipeTimestamps = event.meals
        .flatMap(m => m.recipes)
        .map(r => `${r.recipeUuid}:${recipesStore.getRecipeUpdatedAt(r.recipeUuid) ?? ''}`);
      this.#lastMealsHash = JSON.stringify(event.meals) + '|' + recipeTimestamps.join('|');

      // 3. Lancer le liveQuery unique (observe 3 tables → reconciler)
      this.#startDataSubscription(this.#currentMainId!);

      // 4. Abonnements realtime (Appwrite → Dexie → liveQuery → reconciler)
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
          const recipeTimestamps = reactiveEvent.meals
            .flatMap(m => m.recipes)
            .map(r => `${r.recipeUuid}:${recipesStore.getRecipeUpdatedAt(r.recipeUuid) ?? ''}`);
          this.#syncWithEventMeals(reactiveEvent, recipeTimestamps);
        }
      });
    });
  }

  async #syncWithEventMeals(event: EnrichedEvent, recipeTimestamps: string[]) {
    if (!this.#isInitialized) return;

    const mealsHash = JSON.stringify(event.meals) + '|' + recipeTimestamps.join('|');
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
          mergedProductNames: m.data.mergedFrom.length > 0 ? m.data.mergedFrom.map(f => f.name) : undefined,
          displayTotalOverride: m.data.displayTotalOverride || undefined,
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
        mergedProductNames: m.data.mergedFrom.length > 0 ? m.data.mergedFrom.map(f => f.name).join(", ") : undefined,
        displayTotalOverride: m.data.displayTotalOverride || undefined,
        formattedCalculatedQuantities: m.data.displayTotalOverride ? m.stats.formattedQuantities : undefined,
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

  // ===========================================================================
  // MERGE / UNMERGE
  // ===========================================================================

  /**
   * Fusionne un produit source vers un produit cible.
   * Le source disparaît de la liste, ses données sont agrégées dans le target.
   * Un seul appel Appwrite (source uniquement) → un seul événement realtime.
   */
  async mergeProducts(sourceId: string, targetId: string): Promise<void> {
    // Validations
    if (sourceId === targetId) {
      toastService.error("Impossible de fusionner un produit avec lui-même");
      return;
    }
    const sourceModel = this.#productModels.get(sourceId);
    const targetModel = this.#productModels.get(targetId);
    if (!sourceModel || !targetModel) {
      toastService.error("Produit source ou cible introuvable");
      return;
    }
    if (sourceModel.data.mergedInto) {
      toastService.error("Ce produit est déjà fusionné");
      return;
    }
    if (targetModel.data.mergedInto) {
      toastService.error("Impossible de fusionner vers un produit déjà fusionné");
      return;
    }

    await toastService.track(
      mergeProductsAppwrite(sourceId, targetId, sourceModel.data),
      {
        loading: "Fusion en cours…",
        success: `"${sourceModel.data.productName}" fusionné vers "${targetModel.data.productName}"`,
        error: "Erreur lors de la fusion",
      },
    );
  }

  /**
   * Annule un merge : le produit source redevient visible.
   * Un seul appel Appwrite (source uniquement), puis invalidation du target
   * pour forcer son rebuild au prochain passage du reconciler.
   */
  async unmergeProduct(sourceId: string, targetId: string): Promise<void> {
    // Le produit source n'est pas dans #productModels (retiré par le reconciler
    // car mergedInto !== null). On lance directement l'update Appwrite.
    await toastService.track(
      unmergeProductAppwrite(sourceId),
      {
        loading: "Annulation de la fusion…",
        success: `Fusion annulée — le produit redevient visible`,
        error: "Erreur lors de l'annulation de la fusion",
      },
    );
    // Le target n'est pas modifié dans Appwrite, son $updatedAt n'a pas changé.
    // On le supprime de #productModels pour forcer son rebuild (sans mergedProductNames/Ids).
    this.#productModels.delete(targetId);
  }

  /**
   * Recherche de produits (utilisé par le MergeManager UI).
   * Exclut le produit courant et les produits déjà mergés (mergedInto non null).
   */
  searchProducts(query: string, currentProductId: string): EnrichedProduct[] {
    if (!query.trim()) return [];

    const current = this.#productModels.get(currentProductId)?.data;
    const excludeIds = new Set<string>([currentProductId]);
    // Exclure les produits déjà mergés (source ou target)
    for (const [, model] of this.#productModels) {
      if (model.data.mergedInto) excludeIds.add(model.data.$id);
    }
    // Exclure les produits déjà mergés VERS le courant
    if (current?.mergedFrom) {
      for (const m of current.mergedFrom) excludeIds.add(m.id);
    }

    const candidates = [...this.#productModels.values()]
      .filter((m) => !excludeIds.has(m.data.$id))
      .map((m) => m.data);

    // Recherche fuzzy simple (indexOf + lowercase, suffisante pour ce cas)
    const q = query.toLowerCase().trim();
    return candidates.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.productType.toLowerCase().includes(q),
    );
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
   * Force un delta sync Appwrite → Dexie pour les produits et achats.
   *
   * Appelé par NotificationStore après une notification batch_products_update
   * (Cloud Functions : batchUpdate, groupPurchase).
   *
   * Le realtime Appwrite ne relaie pas toujours les événements de modification
   * issus des Cloud Functions vers les clients, donc ce delta sync explicite
   * garantit que Dexie (et donc le liveQuery → #onDataChange) est à jour.
   */
  async syncFromAppwrite(): Promise<void> {
    if (!this.#currentMainId) {
      console.warn("[ProductsStore] syncFromAppwrite() appelé sans currentMainId");
      return;
    }

    try {
      await Promise.all([
        this.#productsCollection.initialFetch({
          queries: [Query.equal("mainId", this.#currentMainId)],
          scopeKey: this.#currentMainId,
        }),
        this.#purchasesCollection.initialFetch({
          queries: [Query.equal("mainId", this.#currentMainId)],
          scopeKey: this.#currentMainId,
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

    try {
      if (enrichedProduct && !enrichedProduct.isSynced) {
        // upsertProduct() est défensif (Solution A : gère déjà "already exists")
        await upsertProduct(productId, updates, (id: string) =>
          this.getEnrichedProductById(id),
        );
      } else {
        await updateProductAppwrite(productId, updates);
      }
    } catch (error) {
      // ─── Solution B : desync détecté, retry avec le chemin opposé ───
      if (error instanceof Error && isNotFoundError(error) && enrichedProduct) {
        console.warn(
          `[ProductsStore] DESYNC: produit ${productId} introuvable dans Appwrite (isSynced=true), fallback vers création`,
        );
        await upsertProduct(productId, updates, (id: string) =>
          this.getEnrichedProductById(id),
        );
      } else {
        throw error;
      }
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
    this.#cleanupDateEffect?.();
    this.#cleanupDateEffect = null;

    // Cleanup liveQuery
    this.#dataSubscription?.unsubscribe();
    this.#dataSubscription = null;

    // Cleanup aw-sync subscriptions
    this.#productsCollection.unsubscribeAll();
    this.#purchasesCollection.unsubscribeAll();

    // Vider les structures de données
    this.#productModels.clear();
    this.#groups = {};
    this.#orphanPurchases = new SvelteMap();
    this.#purchasesByProductCache = new Map();
    this.#productNameCache.clear();
    this.#orphanedPurchasesInfo = [];
    this.#fuzzySearchable = [];

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
