import { SvelteMap } from "svelte/reactivity";
import { untrack } from "svelte";
import { useDebounce } from "runed";
import { liveQuery } from "dexie";
import type { Subscription } from "dexie";
import type { Products, Purchases } from "../types/pb";
// searchParams importé depuis sv-router directement (même instance singleton
// que le ré-export de $lib/router) : évite un cycle store → router → routes
// → pages → store. Phase 2 : correspond à $page.url.searchParams.
import { searchParams } from "sv-router";

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
import { getEventDates } from "../utils/events.utils";
import {
  exportProductsToMarkdown,
  type MarkdownExportGroup,
} from "../utils/product-markdown-export";
import { exportProductsToCsv } from "../utils/product-csv-export";
import { UnitConverter } from "../utils/UnitConverter";
import type {
  EnrichedProduct,
  StoreInfo,
  BatchUpdateResult,
  ManualSpecs,
  GroupedInvoice,
  DeliveryStatus,
} from "../types/store.types";
import type { EnrichedEvent } from "../types/events";

import { globalState } from "./GlobalState.svelte";
import { toastService } from "../services/toast.service.svelte";
import { ProductModel } from "../models/ProductModel.svelte";
import { DateRangeStore } from "./DateRangeStore.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { recipesStore } from "./RecipesStore.svelte";
import {
  createSyncCollection,
  db,
  pb,
  RecordNotFoundError,
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
// ERREUR MÉTIER — unicité (event, nom)
// =============================================================================

/**
 * Message utilisateur du conflit d'unicité (eventId, productName) — l'index
 * unique PB rejette le create/update d'un second produit de même nom dans le
 * même événement (400, `validation_not_unique` en erreur de champ). Le
 * mapping du code PB vit ICI (createProduct et #ensureSyncedProduct, les
 * deux seuls sites qui lancent des creates produits) : les couches UI ne
 * voient jamais l'erreur brute, seulement cette erreur typée.
 */
export const DUPLICATE_PRODUCT_NAME_MESSAGE =
  "Un produit de ce nom existe déjà dans cet événement";

export class DuplicateProductNameError extends Error {
  constructor() {
    super(DUPLICATE_PRODUCT_NAME_MESSAGE);
    this.name = "DuplicateProductNameError";
  }
}

/**
 * Résout le message du toast d'erreur pour un échec d'écriture produit :
 * le message explicite sur conflit d'unicité, undefined sinon (le toast
 * garde alors son libellé statique par défaut).
 */
export function resolveProductWriteError(err: unknown): string | undefined {
  return err instanceof DuplicateProductNameError ? err.message : undefined;
}

/**
 * Détecte le rejet d'unicité PB : 400 avec une erreur de champ
 * `validation_not_unique` hors champ `id` (le seul autre rejet d'unicité
 * possible est la clé primaire — un create à id déjà pris n'est PAS un
 * conflit de nom). Robuste à la colonne rapportée par l'index composite.
 */
function isUniqueNameRejection(err: unknown): boolean {
  const e = err as {
    status?: number;
    response?: { code?: number; data?: Record<string, { code?: string }> };
  } | null;
  const data = e?.response?.data;
  if ((e?.status ?? e?.response?.code) !== 400 || !data) return false;
  return Object.entries(data).some(
    ([field, fieldError]) =>
      field !== "id" && fieldError?.code === "validation_not_unique",
  );
}

/** Traduit un rejet serveur en erreur métier typée, laisse passer le reste. */
function toProductWriteError(err: unknown): never {
  throw isUniqueNameRejection(err) ? new DuplicateProductNameError() : err;
}

/**
 * Discriminant des achats orphelins, dérivés à chaque passe du reconciler :
 * - "product-removed" : aucun record produit (cas garde-fou — aucun flux UI
 *   ne supprime de record produit).
 * - "need-removed" : produit réel (ingredientRef non null) dont les recettes
 *   ne déclarent plus le besoin — carte masquée par le filtre date-range
 *   (byDate vide), l'achat reste tracé dans la section orphelins.
 */
type OrphanedPurchaseKind = "product-removed" | "need-removed";

// =============================================================================
// STORE
// =============================================================================

class ProductsStore {
  // ===========================================================================
  // aw-sync COLLECTIONS (CRUD + sync Appwrite ↔ Dexie)
  // ===========================================================================

  #productsCollection = createSyncCollection<Products>(
    pb,
    db.products,
    "products",
  );
  #purchasesCollection = createSyncCollection<Purchases>(
    pb,
    db.purchases,
    "purchases",
  );

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

  // Garde revalidation : une seule delta sync en vol (les appels concurrents
  // skipent silencieusement). Réinitialisé par le finally.
  #revalidating = false;
  #cleanupSyncEffect: (() => void) | null = null;
  #cleanupDateEffect: (() => void) | null = null;
  #cleanupUrlEffect: (() => void) | null = null;

  // Filters
  #filters = $state<FiltersState>({
    searchQuery: "",
    searchInRecipes: false,
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
  #startDataSubscription(eventId: string) {
    this.#dataSubscription?.unsubscribe();

    this.#dataSubscription = liveQuery(() =>
      this.#readEventSnapshot(eventId),
    ).subscribe({
      next: ({ products, purchases, needs }) => {
        this.#onDataChange(products, purchases, needs);
      },
      error: (err) => {
        console.error("[ProductsStore] liveQuery error:", err);
      },
    });
  }

  /**
   * Snapshot des 3 tables Dexie pour une passe du reconciler — partagé par le
   * liveQuery et le rerun explicite.
   */
  async #readEventSnapshot(eventId: string) {
    const [products, purchases, needs] = await Promise.all([
      db.products.where("eventId").equals(eventId).toArray(),
      db.purchases.where("eventId").equals(eventId).toArray(),
      db.productNeeds.where("mainId").equals(eventId).toArray(),
    ]);
    return { products, purchases, needs };
  }

  /**
   * Force une passe du reconciler (relecture Dexie → #onDataChange). Le
   * liveQuery ne se réveille que sur écriture Dexie : les invalidations
   * purement en mémoire (rebuild forcé d'un modèle) doivent provoquer leur
   * propre passe, sans dépendre d'un event realtime ultérieur.
   */
  async #rerunReconciliation(): Promise<void> {
    if (!this.#currentEventId) return;
    const snapshot = await this.#readEventSnapshot(this.#currentEventId);
    this.#onDataChange(snapshot.products, snapshot.purchases, snapshot.needs);
  }

  /**
   * Point d'entrée unique quand les données Dexie changent.
   * Merge les 3 sources, compare les fingerprints, met à jour les ProductModels,
   * puis reconstruit les groupes.
   */
  #onDataChange(
    products: Products[],
    purchases: Purchases[],
    needs: ProductNeedRow[],
  ) {
    // ── 1. Indexer les sources ──────────────────────────────
    const productsById = new Map(products.map((p) => [p.id, p]));
    const needsById = new Map(needs.map((n) => [n.id, n]));

    const purchasesByProduct = new Map<string, Purchases[]>();
    // Achats au statut "expense" (finances) — hors liste de courses.
    // NB : sans rapport avec les achats orphelins (#orphanedPurchasesInfo).
    const expensePurchases = new SvelteMap<string, Purchases>();
    for (const purchase of purchases) {
      if (purchase.status === "expense") {
        expensePurchases.set(purchase.id, purchase);
        continue;
      }
      if (purchase.status === "deleted") continue;
      for (const productId of purchase.products ?? []) {
        const list = purchasesByProduct.get(productId) ?? [];
        list.push(purchase);
        purchasesByProduct.set(productId, list);
      }
    }
    this.#expensePurchases = expensePurchases;
    this.#purchasesByProductCache = purchasesByProduct;

    // ── 1b. Remappage virtuel des purchases des produits mergés ──
    // Le record PB ne porte que `mergedInto` sur la source ; tout le reste
    // (achats rattachés à la cible, masquage des sources) est dérivé ici,
    // à chaque passe du reconciler.
    const mergeTargetIds = new Set<string>();
    for (const [sourceId, rawProduct] of productsById) {
      if (!rawProduct.mergedInto) continue;
      const targetId = rawProduct.mergedInto;
      mergeTargetIds.add(targetId);
      if (!productsById.has(targetId) && !needsById.has(targetId)) {
        console.warn(
          `[ProductsStore] Merge target "${targetId}" introuvable pour "${sourceId}"`,
        );
        continue;
      }
      const sourcePurchases = purchasesByProduct.get(sourceId);
      if (!sourcePurchases?.length) continue;
      const targetPurchases = purchasesByProduct.get(targetId) ?? [];
      purchasesByProduct.set(targetId, [
        ...targetPurchases,
        ...sourcePurchases,
      ]);
      purchasesByProduct.delete(sourceId); // les purchases vivent maintenant sous la cible
    }

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
        raw?.updated ?? "",
        needRow?.updated ?? "",
        ...prods
          .map((p) => p.updated)
          .filter(Boolean)
          .sort(),
      ].join("|");

      const existing = this.#productModels.get(id);

      // Skip si inchangé — SAUF les cibles de merge, toujours reconstruites :
      // `mergedFrom` repart de [] à chaque rebuild (#buildEnriched), et la
      // passe 3b y repousse exactement une entrée par source. Sans ce contournement
      // du fingerprint, les passes multiples du liveQuery accumuleraient les
      // entrées (le target lui-même n'a pas changé).
      const isMergeTarget = mergeTargetIds.has(id);
      if (existing && existing._version === version && !isMergeTarget) continue;

      // Merge des 3 sources → EnrichedProduct
      const need = needRow ? parseNeedRow(needRow) : null;
      const enriched = this.#buildEnriched(raw, need, prods);

      this.#productNameCache.set(id, {
        name: enriched.productName,
        type: enriched.productType,
      });

      if (existing) {
        existing.update(enriched);
        existing._version = version;
      } else {
        const model = new ProductModel(enriched, this.dateStore);
        model._version = version;
        this.#productModels.set(id, model);
      }
    }

    // ── 3b. Agréger les sources mergées dans leurs cibles ─────
    const mergedSourceIds = new Set<string>();
    for (const [id, model] of this.#productModels) {
      if (!model.data.mergedInto) continue;
      const targetId = model.data.mergedInto;
      const targetModel = this.#productModels.get(targetId);
      if (!targetModel) {
        console.warn(
          `[ProductsStore] Merge target "${targetId}" non trouvé pour "${id}", la source reste visible`,
        );
        continue;
      }
      // Agréger les données de la source dans la cible
      mergeEnrichedProducts(targetModel.data, model.data);
      targetModel.data.mergedFrom.push({
        id: model.data.id,
        name: model.data.productName,
      });
      mergedSourceIds.add(id);
    }
    // Supprimer les modèles sources (leurs données vivent dans la cible)
    for (const id of mergedSourceIds) {
      this.#productModels.delete(id);
    }

    // ── 4. Supprimer les modèles obsolètes ──────────────────
    for (const id of staleIds) {
      this.#productModels.delete(id);
    }

    // ── 4b. Détecter les achats orphelins (sans produit affiché) ──
    // Calculé APRÈS le remappage merge (1b) et le masquage des sources (3b).
    // Deux cas, dérivés à chaque passe (aucun marquage persistant) :
    // - product-removed : aucun modèle produit (garde-fou).
    // - need-removed : produit réel dont aucune recette ne déclare plus le
    //   besoin — la carte est masquée par le filtre date-range (byDate vide)
    //   mais les achats restent tracés ici. Ré-ajouter la recette recrée la
    //   ligne need → l'orphelin s'efface naturellement.
    // L'override (totalNeededOverride) ne rescuent pas : c'est un ajustement
    // lié aux recettes — recettes parties = besoin parti. Les produits
    // manuels (ingredientRef null) ne dépendent pas des recettes : jamais
    // éligibles, leur carte reste affichée.
    const orphaned: Array<{
      productId: string;
      productName: string;
      productType: string;
      kind: OrphanedPurchaseKind;
      purchases: Purchases[];
    }> = [];
    for (const [productId, purchs] of purchasesByProduct) {
      if (purchs.length === 0) continue;
      // Guard mergedSourceIds — filet de sécurité pour les deux types :
      // les achats d'une source ont déjà été remappés vers la cible (1b).
      if (mergedSourceIds.has(productId)) continue;
      // Besoin actif → le produit a une carte affichée : pas orphelin.
      if (needsById.has(productId)) continue;

      const raw = productsById.get(productId);
      let kind: OrphanedPurchaseKind;
      if (!raw) {
        // Cas 1 : aucun modèle produit (achat sans record).
        kind = "product-removed";
      } else if (raw.mergedInto) {
        // Source mergée : jamais orpheline — ses achats vivent sous la
        // cible, ou elle reste visible si la cible est introuvable (3b).
        continue;
      } else if (raw.ingredientRef) {
        // Cas 2 : produit réel, besoin retiré des recettes.
        kind = "need-removed";
      } else {
        continue; // produit manuel : carte toujours affichée, hors orphelins
      }

      const cached = this.#productNameCache.get(productId);
      orphaned.push({
        productId,
        kind,
        productName: cached?.name ?? extractNameFromProductId(productId),
        productType: cached?.type ?? "",
        purchases: purchs,
      });
    }
    this.#orphanedPurchasesInfo = orphaned;

    // ── 4b. Cache searchable pour la recherche fuzzy ──────────
    // Reconstruit uniquement quand #productModels change (ici), PAS à
    // chaque frappe clavier.
    this.#rebuildFuzzyCache();

    // ── 5. Reconstruire les groupes ─────────────────────────
    this.#rebuildGroups();
  }

  /**
   * Reconstruit le cache searchable pour la recherche fuzzy.
   * recipeNames = titres des recettes utilisant le produit, joints.
   */
  #rebuildFuzzyCache() {
    this.#fuzzySearchable = Array.from(this.#productModels.values()).map(
      (m) => ({
        id: m.data.id,
        productName: m.data.productName,
        recipeNames: Object.values(m.data.byDate ?? {})
          .flatMap((entry) => entry.recipes.map((r) => r.r))
          .filter(Boolean)
          .join(" "),
      }),
    );
  }

  // Cache pour financialStats (mis à jour par #onDataChange)
  #expensePurchases = new SvelteMap<string, Purchases>();
  #purchasesByProductCache = new Map<string, Purchases[]>();

  // Dernier nom/type connus par id produit (alimenté à chaque rebuild de
  // modèle) — nomme les achats orphelins dont le produit n'existe plus.
  #productNameCache = new Map<string, { name: string; type: string }>();

  // Cache pour la recherche fuzzy — invalidé quand #productModels change
  #fuzzySearchable: {
    id: string;
    productName: string;
    recipeNames: string;
  }[] = [];

  // Achats orphelins (dérivés à chaque passe du reconciler, discriminés par
  // kind — cf. OrphanedPurchaseKind) — section « Achats sans produit actif ».
  #orphanedPurchasesInfo = $state<
    Array<{
      productId: string;
      productName: string;
      productType: string;
      kind: OrphanedPurchaseKind;
      purchases: Purchases[];
    }>
  >([]);

  /**
   * Fusionne 0–3 sources en un seul EnrichedProduct.
   */
  #buildEnriched(
    raw: Products | undefined,
    need: ParsedNeed | null,
    purchases: Purchases[],
  ): EnrichedProduct {
    if (raw && need) {
      const base = buildRawProductBase({
        ...raw,
        purchases,
        // Champs nullable côté PB → neutralisés pour le type enrichi
        productName: raw.productName ?? "",
        store: raw.store ?? "",
      });
      return applyNeedToBase(base, need);
    }

    if (raw) {
      return buildRawProductBase({
        ...raw,
        purchases,
        productName: raw.productName ?? "",
        store: raw.store ?? "",
      });
    }

    if (need) {
      return {
        id: need.id,
        created: need.created,
        updated: need.updated,
        ingredientRef: need.ingredientRef,
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
        mergedFrom: [],
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

    // Pre-compute fuzzy search matches once for all products, sur le
    // cache pré-construit (pas de O(P×R) à chaque frappe)
    const fuzzyMatchedIds = this.#filters.searchQuery.trim()
      ? computeFuzzySearchMatches(
          this.#fuzzySearchable,
          this.#filters.searchQuery,
          this.#filters.searchInRecipes,
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
        const col = this.#filters
          .sortColumn as keyof import("../types/store.types").EnrichedProduct;
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
        models.sort((a, b) => a.data.id.localeCompare(b.data.id));
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
    const isManualProduct = !product.ingredientRef;

    if (!product.byDate && !isManualProduct) return false;
    if (!matchesFilters(product, this.#filters, fuzzyMatchedIds)) return false;

    // Recherche active : on ignore completionStatus / deliveryDate (préservés,
    // réappliqués au reset de la recherche)
    if (!this.isSearchActive) {
      // Filtre completion (dépend de model.stats → dateRange)
      if (this.#filters.completionStatus !== "all") {
        const hasMissing = model.stats.hasMissing;
        if (this.#filters.completionStatus === "completed" && hasMissing)
          return false;
        if (this.#filters.completionStatus === "incomplete" && !hasMissing)
          return false;
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
    }

    // Filtre date range
    if (product.byDate) {
      const hasDataInRange = Object.keys(product.byDate).some(
        (dateStr) =>
          dateStr >= this.dateRange.start! && dateStr <= this.dateRange.end!,
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
    for (const purchase of this.#expensePurchases.values()) {
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
      const purchases = this.#purchasesByProductCache.get(product.id) || [];
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

    // Tri par date décroissante (chaînes PB comparables en ordre lexical)
    allPurchases.sort((a, b) => {
      const dateA = a.orderDate || a.created;
      const dateB = b.orderDate || b.created;
      return dateA === dateB ? 0 : dateA < dateB ? 1 : -1;
    });

    return { totalGlobal, byStore, byWho, allPurchases };
  });

  /**
   * Factures groupées (achats créés via GroupPurchaseModal → invoiceId FACTURE_*).
   * Agrège tous les purchases partageant un même invoiceId. Les purchases au
   * statut différent du groupe sont détachés (invoiceId → null), donc les
   * statuts sont homogènes au sein d'une facture.
   */
  groupedInvoices = $derived.by<GroupedInvoice[]>(() => {
    const byInvoiceId = new Map<string, Purchases[]>();

    const collectFacture = (purchases: Iterable<Purchases>) => {
      for (const purchase of purchases) {
        if (purchase.status === "deleted") continue;
        if (!purchase.invoiceId?.startsWith("FACTURE_")) continue;
        const list = byInvoiceId.get(purchase.invoiceId) ?? [];
        list.push(purchase);
        byInvoiceId.set(purchase.invoiceId, list);
      }
    };

    // 1. Achats au statut expense (portent le total de la facture)
    collectFacture(this.#expensePurchases.values());

    // 2. Achats rattachés aux produits — via #productModels (SvelteMap réactive,
    //    déclenche la réévaluation, même pattern que financialStats).
    for (const model of this.#productModels.values()) {
      collectFacture(model.data.purchases);
    }

    const invoices: GroupedInvoice[] = [];
    for (const [invoiceId, purchases] of byInvoiceId) {
      if (purchases.length === 0) continue;

      // Métadonnées communes (expense pour le prix, premier purchase pour le reste)
      const first = purchases[0];
      const expense = purchases.find((p) => p.status === "expense");
      const store = first.store || "";
      const who = first.who || "";
      const notes = first.notes || "";
      const invoiceTotal = expense?.invoiceTotal ?? first.invoiceTotal;
      const deliveryDate = first.deliveryDate;

      // Statut : homogène par construction (les purchases au statut différent
      // sont détachés du groupe au moment de l'édition individuelle)
      const statusPurchases = purchases.filter((p) => p.status !== "expense");
      const purchaseStatus =
        statusPurchases.length > 0
          ? (statusPurchases[0].status as DeliveryStatus) || "delivered"
          : "delivered";

      // Noms des produits (dédupliqués)
      const productNames: string[] = [];
      const seenNames = new Set<string>();
      for (const p of purchases) {
        if (p.status === "expense") continue;
        for (const productId of p.products ?? []) {
          const cached = this.#productNameCache.get(productId);
          if (cached && !seenNames.has(cached.name)) {
            seenNames.add(cached.name);
            productNames.push(cached.name);
          }
        }
      }

      // Date la plus ancienne — comparaison lexicale des chaînes PocketBase
      // (jamais `new Date()` sur une date PB : le parsing de
      // "YYYY-MM-DD HH:mm:ss.SSSZ" n'est pas standard et décale selon le fuseau)
      const createdAtStr =
        purchases
          .map((p) => p.orderDate || p.created)
          .reduce<string | null>(
            (min, v) => (min === null || v < min ? v : min),
            null,
          ) ?? first.created;

      invoices.push({
        invoiceId,
        invoiceTotal,
        store,
        who,
        notes,
        purchaseStatus,
        deliveryDate,
        purchaseCount: statusPurchases.length,
        productNames,
        purchases,
        createdAt: createdAtStr,
      });
    }

    // Tri par date décroissante (chaînes PB comparables en ordre lexical)
    invoices.sort((a, b) =>
      a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? 1 : -1,
    );

    return invoices;
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
      this.#currentEventId = event.id;
      this.#currentMainId = event.id;

      // 1. Delta sync PocketBase → Dexie (cursor scoped to this event)
      this.#syncing = true;
      await this.#productsCollection.initialFetch({
        filter: ["eventId = {:eventId}", { eventId: this.#currentEventId! }],
        scopeKey: this.#currentEventId!,
      });
      await this.#purchasesCollection.initialFetch({
        filter: ["eventId = {:eventId}", { eventId: this.#currentEventId! }],
        scopeKey: this.#currentEventId!,
      });
      this.#syncing = false;
      this.#lastSync = new Date().toISOString();

      // 2. Calculate needs if none in Dexie yet
      const existingNeedsCount = await db.productNeeds
        .where("mainId")
        .equals(this.#currentMainId!)
        .count();
      // syncReady attendu AVANT le calcul du hash : les timestamps de recettes
      // doivent être les vrais, sinon le premier run de l'effect verrait un
      // hash différent et déclencherait un recalcul parasite.
      await recipesStore.syncReady;
      if (existingNeedsCount === 0) {
        console.log(
          "[ProductsStore] Aucun besoin calculé en cache, calcul depuis event.meals...",
        );
        await this.#calculateAndPersistNeeds(event);
      }

      // Record meals+recipes hash to prevent redundant recalculation from
      // meals sync effect (même formule que #buildMealsHash)
      const recipeTimestamps = this.#collectRecipeTimestamps(event);
      this.#lastMealsHash =
        JSON.stringify(event.meals) + "|" + recipeTimestamps.join("|");

      // 3. Lancer le liveQuery unique (observe 3 tables → reconciler)
      this.#startDataSubscription(this.#currentEventId!);

      // 4. Abonnements realtime (PocketBase SSE → Dexie → liveQuery → reconciler)
      this.#productsCollection.subscribe();
      this.#purchasesCollection.subscribe();

      // 5. Setup reactive sync avec EventsStore (meals updates → Dexie → liveQuery)
      this.#setupMealsSyncEffect(eventId);

      // 6. Date range
      this.dateStore.setAvailableDates(getEventDates(event));
      this.dateStore.initializeSmartRange();

      // 7. Date range effect : rebuild groups quand les dates changent
      this.#setupDateRangeEffect();

      // 8. URL filters effect : hydrate #filters depuis l'URL (deep-links,
      // Back/forward) — même motif que les effets ci-dessus
      this.#setupUrlFiltersEffect();

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
  /**
   * Clé chaque besoin calculé sur l'id du produit synchronisé du même event
   * auquel il correspond (ingredientRef, sinon productName) — l'égalité d'id
   * est le joint de fusion needs↔produits de #onDataChange. Sans
   * correspondance, l'id sémantique (virtuel) est conservé.
   */
  async #resolveNeedRows(
    freshProducts: EnrichedProduct[],
    eventId: string,
  ): Promise<ProductNeedRow[]> {
    const synced = await db.products.where("eventId").equals(eventId).toArray();
    const byRef = new Map<string, Products>();
    const byName = new Map<string, Products>();
    for (const p of synced) {
      if (p.ingredientRef) byRef.set(p.ingredientRef, p);
      byName.set(p.productName ?? "", p);
    }
    return freshProducts.map((p) => {
      const match =
        (p.ingredientRef ? byRef.get(p.ingredientRef) : undefined) ??
        byName.get(p.productName);
      return toNeedRow(match ? { ...p, id: match.id } : p, eventId);
    });
  }

  async #calculateAndPersistNeeds(event: EnrichedEvent): Promise<void> {
    const getRecipeDetails = async (uuid: string) => {
      return await recipesStore.getRecipeByUuid(uuid);
    };

    const products = await createEnrichedProductsFromEvent(
      event,
      getRecipeDetails,
      event.id,
    );

    // Persist to Dexie as ProductNeedRows
    const rows = await this.#resolveNeedRows(products, event.id);
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
          // getRecipeUpdatedAt lit l'index réactif de RecipesStore : la
          // modification d'un ingrédient d'une recette liée à l'event fait
          // bouger le hash → recalcule les besoins (pas seulement meals).
          const recipeTimestamps = this.#collectRecipeTimestamps(reactiveEvent);
          this.#syncWithEventMeals(reactiveEvent, recipeTimestamps);
        }
      });
    });
  }

  /**
   * Timestamps des recettes liées à l'event, sous forme "uuid:updated" —
   * composant réactif du guard de recalcul. Lecture de l'index SvelteMap :
   * à appeler depuis un contexte de tracking (effect ou initialize).
   */
  #collectRecipeTimestamps(event: EnrichedEvent): string[] {
    return event.meals
      .flatMap((m) => m.recipes)
      .map(
        (r) =>
          `${r.recipeUuid}:${recipesStore.getRecipeUpdatedAt(r.recipeUuid) ?? ""}`,
      );
  }

  async #syncWithEventMeals(event: EnrichedEvent, recipeTimestamps: string[]) {
    if (!this.#isInitialized) return;

    const mealsHash =
      JSON.stringify(event.meals) + "|" + recipeTimestamps.join("|");
    if (this.#lastMealsHash === mealsHash) return;

    console.log(
      `[ProductsStore] Changement repas ou recettes detecte pour ${event.id}, recalcul...`,
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
      event.id,
    );

    // Persist to Dexie as ProductNeedRows (clées sur les produits synchronisés
    // correspondants — voir #resolveNeedRows)
    const rows = await this.#resolveNeedRows(freshProducts, event.id);
    await db.productNeeds.bulkPut(rows);
    console.log(
      `[ProductsStore] ${freshProducts.length} besoins calculés et persistés depuis ${event.meals.length} repas`,
    );

    // Delete stale needs from Dexie
    const freshIds = new Set(rows.map((r) => r.id));
    const existingNeeds = await db.productNeeds
      .where("mainId")
      .equals(event.id)
      .toArray();
    const staleIds = existingNeeds
      .filter((n) => !freshIds.has(n.id))
      .map((n) => n.id);
    if (staleIds.length > 0) {
      await db.productNeeds.bulkDelete(staleIds);
    }

    this.dateStore.setAvailableDates(getEventDates(event));
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
          mergedProductNames: m.data.mergedFrom.map((f) => f.name),
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
        mergedProductNames: m.data.mergedFrom.map((f) => f.name).join(", "),
        displayTotalOverride: m.data.displayTotalOverride || undefined,
        formattedCalculatedQuantities: m.data.displayTotalOverride
          ? m.stats.formattedQuantities
          : undefined,
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
      // Flag de présence dans l'URL (contenu hors URL) : permet au Back de
      // sortir de la recherche. 1 entrée d'historique par session (debouncé).
      this.#applyUrlChanges({ search: query.trim() ? "true" : null });
      this.#rebuildGroups();
    },
    () => 500,
  );

  /** Active/désactive l'inclusion des titres de recettes dans la recherche. */
  setSearchInRecipes(value: boolean) {
    this.#filters.searchInRecipes = value;
    this.#rebuildGroups();
  }

  // ===========================================================================
  // URL <-> FILTRES "VUE"
  //
  // Architecture : l'URL est la source de vérité pour les filtres de vue.
  //   UI → setter → #applyUrlChanges (écrit searchParams)
  //   $effect.root (#setupUrlFiltersEffect) → #applyUrlFilters (lit searchParams → #filters + #rebuildGroups)
  // Le read-side est le SEUL écrivain des champs "vue" de #filters → pas de boucle.
  // searchQuery / searchInRecipes / sort restent en mémoire (hors URL).
  // ===========================================================================

  /** Crée l'effet réactif qui hydrate #filters depuis l'URL. À détruire dans reset(). */
  #setupUrlFiltersEffect() {
    this.#cleanupUrlEffect?.();
    this.#cleanupUrlEffect = $effect.root(() => {
      $effect(() => {
        // ⬇ SEULES lectures trackées : chaque get() est une dépendance sur searchParams
        const snapshot = this.#readUrlSnapshot();
        // ⬇ écriture de #filters + rebuild, hors tracking : l'effet ne peut
        // jamais se rescheduler lui-même (robuste même si la sœur survit
        // sans ce garde-fou — ici on ne parie pas sur la tolérance du runtime)
        untrack(() => this.#applyUrlFilters(snapshot));
      });
    });
  }

  /** Snapshot des 10 clés "vue" — seul endroit où searchParams est lu (tracké). */
  #readUrlSnapshot(): Record<string, string | null> {
    const keys = [
      "status",
      "group",
      "temp",
      "types",
      "stores",
      "smode",
      "who",
      "wmode",
      "delivery",
      "search",
    ];
    const snapshot: Record<string, string | null> = {};
    for (const key of keys) {
      const v = searchParams.get(key);
      snapshot[key] = v === null ? null : String(v);
    }
    return snapshot;
  }

  /** Applique un snapshot URL à #filters + rebuild. À appeler dans untrack(). */
  #applyUrlFilters(snapshot: Record<string, string | null>) {
    // Back/navigation : le flag `search` a été retiré alors qu'une recherche
    // était active (en mémoire) → on reset la recherche.
    if (snapshot.search === null && this.#filters.searchQuery.trim()) {
      this.#filters.searchQuery = "";
    }

    const status = snapshot.status;
    const group = snapshot.group;
    const temp = snapshot.temp;
    const stores = this.#urlGetList(snapshot.stores);
    const types = this.#urlGetList(snapshot.types);
    const smode = snapshot.smode;
    const who = this.#urlGetList(snapshot.who);
    const wmode = snapshot.wmode;
    const delivery = snapshot.delivery;

    this.#setFilterField(
      "completionStatus",
      status === "incomplete" || status === "completed" ? status : "all",
    );
    this.#setFilterField(
      "groupBy",
      group === "store" || group === "productType" || group === "none"
        ? group
        : "productType",
    );
    this.#setFilterField(
      "temperatureFilter",
      (
        ["all", "frais", "not-frais", "surgele", "not-surgele"] as const
      ).includes(temp as TemperatureFilterMode)
        ? (temp as TemperatureFilterMode)
        : "all",
    );
    this.#setFilterField("selectedProductTypes", types);
    this.#setFilterField("selectedStores", stores);
    this.#setFilterField("storeFilterMode", smode === "none" ? "none" : "all");
    this.#setFilterField("selectedWho", who);
    this.#setFilterField("whoFilterMode", wmode === "none" ? "none" : "all");
    this.#setFilterField("deliveryDateFilter", delivery ?? null);

    this.#rebuildGroups();
  }

  /**
   * Assigne un champ "vue" seulement s'il diffère réellement (égalité
   * élément par élément pour les tableaux) — défense en profondeur anti-boucle.
   */
  #setFilterField<K extends keyof FiltersState>(
    key: K,
    value: FiltersState[K],
  ) {
    const current = this.#filters[key];
    if (Array.isArray(current) && Array.isArray(value)) {
      if (
        current.length === value.length &&
        current.every((v, i) => v === (value as unknown[])[i])
      ) {
        return;
      }
    } else if (current === value) {
      return;
    }
    (this.#filters[key] as unknown) = value;
  }

  /**
   * Applique des changements d'URL en lot. `null` = supprimer la clé.
   * Crée EXACTEMENT une entrée d'historique par action utilisateur si l'URL
   * change (premier changement = pushState, suivants = replaceState), zéro sinon.
   */
  #applyUrlChanges(changes: Record<string, string | null>) {
    let first = true;
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) {
        if (this.#urlGet(key) === null) continue;
        searchParams.delete(
          key,
          undefined,
          first ? undefined : { replace: true },
        );
        first = false;
      } else {
        if (this.#urlGet(key) === value) continue;
        searchParams.set(key, value, first ? undefined : { replace: true });
        first = false;
      }
    }
  }

  /** Lit un param URL comme string (blinde la coercion parseSearchValue). */
  #urlGet(key: string): string | null {
    const v = searchParams.get(key);
    return v === null ? null : String(v);
  }

  /** Lit un param URL comme liste (CSV encodé). */
  #urlGetList(csv: string | null): string[] {
    if (!csv) return [];
    return csv
      .split(",")
      .map((x) => {
        try {
          return decodeURIComponent(x);
        } catch {
          return x;
        }
      })
      .filter((x) => x !== "");
  }

  /** Encode un tableau en CSV URL-safe. */
  #csvEncode(values: string[]): string {
    return values.map(encodeURIComponent).join(",");
  }

  toggleProductType(type: string) {
    const current = this.#filters.selectedProductTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    this.#applyUrlChanges({
      types: next.length ? this.#csvEncode(next) : null,
    });
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
    this.#applyUrlChanges({ temp: mode === "all" ? null : mode });
  }

  clearTypeAndTemperatureFilters() {
    this.#applyUrlChanges({ types: null, temp: null });
  }

  setGroupBy(groupBy: "store" | "productType" | "none") {
    this.#applyUrlChanges({
      group: groupBy === "productType" ? null : groupBy,
    });
  }

  toggleStore(store: string) {
    const current = this.#filters.selectedStores;
    const next = current.includes(store)
      ? current.filter((s) => s !== store)
      : [...current, store];
    this.#applyUrlChanges({
      stores: next.length ? this.#csvEncode(next) : null,
      smode: null, // sélection explicite → mode "all"
    });
  }

  toggleWho(who: string) {
    const current = this.#filters.selectedWho;
    const next = current.includes(who)
      ? current.filter((w) => w !== who)
      : [...current, who];
    this.#applyUrlChanges({
      who: next.length ? this.#csvEncode(next) : null,
      wmode: null,
    });
  }

  clearStoreFilters() {
    this.#applyUrlChanges({ stores: null, smode: null });
  }

  clearWhoFilters() {
    this.#applyUrlChanges({ who: null, wmode: null });
  }

  setStoreFilterMode(mode: "all" | "none") {
    this.#applyUrlChanges({
      smode: mode === "all" ? null : mode,
      stores: null,
    });
  }

  setWhoFilterMode(mode: "all" | "none") {
    this.#applyUrlChanges({
      wmode: mode === "all" ? null : mode,
      who: null,
    });
  }

  setCompletionStatus(status: "all" | "completed" | "incomplete") {
    const changes: Record<string, string | null> = {
      status: status === "all" ? null : status,
    };
    if (status !== "all") changes.delivery = null;
    this.#applyUrlChanges(changes);
  }

  setDeliveryDateFilter(date: string | null) {
    const changes: Record<string, string | null> = {};
    if (date) {
      changes.delivery = date;
      changes.status = null;
    } else {
      changes.delivery = null;
    }
    this.#applyUrlChanges(changes);
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
    // Filtres "vue" : vidés via l'URL (1 entrée d'historique, ou zéro si déjà vides)
    this.#applyUrlChanges({
      status: null,
      group: null,
      temp: null,
      types: null,
      stores: null,
      smode: null,
      who: null,
      wmode: null,
      delivery: null,
      search: null,
    });
    // Filtres in-memory (search + tri) — hors URL
    this.#filters.searchQuery = "";
    this.#filters.searchInRecipes = false;
    this.#filters.sortColumn = "";
    this.#filters.sortDirection = "asc";
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
    // Purge local rows (and, via clearLocal, the scoped cursors) so that
    // initialize() re-fetches from scratch instead of trusting stale Dexie data.
    await this.#productsCollection.clearLocal();
    await this.#purchasesCollection.clearLocal();
    await this.initialize(eventId);
  }

  async clearCache() {
    this.#lastSync = null;
    await this.#productsCollection.clearLocal();
    await this.#purchasesCollection.clearLocal();
    // Calculated needs are event-scoped (the `mainId` index holds the eventId):
    // purge only the current event's rows, keep other events' caches intact.
    if (this.#currentEventId) {
      await db.productNeeds
        .where("mainId")
        .equals(this.#currentEventId)
        .delete();
    } else {
      await db.productNeeds.clear();
    }
    console.log("[ProductsStore] Cache vidé");
  }

  /**
   * Revalidation silencieuse (delta sync des produits et achats, sans toggle
   * loading — pas de flash UI skeleton). Utilisée par les resync en
   * arrière-plan (post-visibility/reconnect). Skip silencieux si déjà en
   * cours.
   *
   * Politique d'échec héritée du durcissement T13 : `Promise.allSettled` —
   * les rejets sont loggés, `#lastSync` n'avance que si TOUT réussit. Pas de
   * rethrow : un échec partiel reste observable via `lastSync` non rafraîchi
   * (l'orchestrateur peut s'en servir comme signal de fraîcheur).
   * Un changement d'utilisateur en vol (logout) discard le résultat.
   */
  async syncRevalidate(): Promise<void> {
    if (this.#revalidating) return;
    this.#revalidating = true;

    try {
      if (!this.#currentEventId) {
        console.warn(
          "[ProductsStore] syncRevalidate() appelé sans currentEventId",
        );
        return;
      }

      const uid = globalState.userId;
      const results = await Promise.allSettled([
        this.#productsCollection.initialFetch({
          filter: ["eventId = {:eventId}", { eventId: this.#currentEventId }],
          scopeKey: this.#currentEventId,
        }),
        this.#purchasesCollection.initialFetch({
          filter: ["eventId = {:eventId}", { eventId: this.#currentEventId }],
          scopeKey: this.#currentEventId,
        }),
      ]);

      // Logout en vol : ne pas livrer les données de l'utilisateur précédent
      // à la cache du suivant — surtout, ne pas marquer la cache fraîche.
      if (globalState.userId !== uid) return;

      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (rejected.length > 0) {
        // #lastSync only advances on a fully successful pass — a partial sync
        // must not look fresh.
        for (const r of rejected) {
          console.error("[ProductsStore] syncRevalidate partiel:", r.reason);
        }
        return;
      }

      this.#lastSync = new Date().toISOString();
      console.log("[ProductsStore] syncRevalidate() terminé");
    } finally {
      this.#revalidating = false;
    }
  }

  /**
   * Delta sync avec loading UI (premier chargement). Toggle `this.#loading`
   * autour de la revalidation.
   */
  async syncInitial(): Promise<void> {
    return this.#runWithLoading(() => this.syncRevalidate());
  }

  async #runWithLoading(work: () => Promise<void>): Promise<void> {
    this.#loading = true;
    try {
      return await work();
    } finally {
      this.#loading = false;
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

  /**
   * Charge utile PB complète d'un produit virtuel matérialisé. L'id n'y figure
   * pas : chaque appelant porte le sien (upsert à id stable — voir
   * #ensureSyncedProduct).
   */
  #virtualProductPayload(
    enriched: EnrichedProduct,
  ): Omit<Products, "id" | "created" | "updated"> {
    return {
      ingredientRef: enriched.ingredientRef || null,
      productName: enriched.productName,
      productType: enriched.productType || "Autre",
      store: null,
      who: [],
      eventId: this.#currentEventId!,
      status: "active",
      stockReel: null,
      updatedBy: globalState.userId,
      isMerged: false,
      mergedFrom: null,
      mergeDate: null,
      mergeReason: null,
      mergedInto: null,
      totalNeededOverride: null,
      isSynced: true,
      specs: JSON.stringify({
        pF: enriched.pF || false,
        pS: enriched.pS || false,
      }),
    } as unknown as Omit<Products, "id" | "created" | "updated">;
  }

  /**
   * Pousse au serveur un produit virtuel (besoin calculé, jamais écrit) en
   * conservant SON id sémantique `${slug}_${mainId}` — admissible depuis
   * la relaxation products.id (min 11, `^[a-z0-9_-]+$`) : la primitive upsert
   * crée la ligne verbatim (update si le serveur la connaît déjà, create
   * sinon). Needs et produits portent donc le même id dès la première écriture
   * et la fusion (#onDataChange, égalité d'id) ne voit jamais d'entrée
   * disparaître — plus de re-key, plus de carte qui clignote. Un produit déjà
   * miroité (ou inconnu — peut-être un record pas encore synchronisé) passe
   * tel quel : dans le pire cas l'écriture de l'appelant échouera avec
   * l'erreur du serveur.
   */
  async #ensureSyncedProduct(productId: string): Promise<void> {
    if (await db.products.get(productId)) return;

    const enriched = this.getEnrichedProductById(productId);
    if (!enriched) return;

    // La matérialisation d'un virtuel peut heurter l'unicité (event, nom) :
    // un produit réel du même nom a pu être créé entre-temps (besoin calculé
    // avant la création manuelle). Même traduction typée que createProduct.
    await this.#productsCollection
      .upsert({
        id: productId,
        ...this.#virtualProductPayload(enriched),
      })
      .catch(toProductWriteError);
  }

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
  ): Promise<string> {
    const purchaseStatus = options.status || "delivered";
    let deliveryDate = options.deliveryDate || null;
    if (purchaseStatus === "delivered" && !deliveryDate) {
      deliveryDate = new Date().toISOString();
    }

    // La validation rapide peut référencer un produit virtuel (besoin calculé,
    // jamais poussé au serveur) : matérialiser d'abord à l'id sémantique —
    // l'achat référence cet id, la relation purchases.products est valide dès
    // la création.
    await this.#ensureSyncedProduct(productId);

    for (const qty of quantities) {
      await this.#purchasesCollection.create({
        products: [productId],
        eventId: this.#currentEventId!,
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
      } as unknown as Omit<Purchases, "id" | "created" | "updated">);
    }

    return productId;
  }

  async updatePurchase(
    purchaseId: string,
    updates: Partial<Purchases>,
  ): Promise<void> {
    await this.#purchasesCollection.update(purchaseId, updates);
  }

  async deletePurchase(purchaseId: string): Promise<void> {
    await this.#purchasesCollection.update(purchaseId, {
      status: "deleted",
    } as Partial<Purchases>);
  }

  /**
   * Nom du produit associé à un purchase (via le cache interne de noms).
   */
  getProductNameForPurchase(purchase: Purchases): string {
    for (const productId of purchase.products ?? []) {
      const cached = this.#productNameCache.get(productId);
      if (cached) return cached.name;
    }
    return "?";
  }

  // ===========================================================================
  // FACTURES GROUPÉES : actions
  // ===========================================================================

  /**
   * Met à jour les champs globaux de tous les purchases d'une facture groupée
   * (statut, date de livraison, who, store) + l'expense (total), via
   * `bulkUpdate` (lots batchés pb-sync : miroir Dexie immédiat, rollback par
   * lot). PB n'offre pas de transaction client multi-record — le batch en est
   * la primitive la plus proche.
   */
  async updateInvoiceGroup(
    invoiceId: string,
    updates: {
      status?: DeliveryStatus;
      deliveryDate?: string | null;
      who?: string | null;
      store?: string | null;
      expense?: { purchaseId: string; price: number; invoiceTotal: number };
    },
  ): Promise<void> {
    const invoice = this.groupedInvoices.find(
      (inv) => inv.invoiceId === invoiceId,
    );
    if (!invoice) throw new Error(`Facture ${invoiceId} introuvable`);

    const purchasesToUpdate = invoice.purchases.filter(
      (p) => p.status !== "expense" && p.status !== "deleted",
    );
    // Une facture peut n'avoir que l'expense à mettre à jour (achats déjà
    // supprimés/expense) : ne pas sortir tôt dans ce cas.
    if (purchasesToUpdate.length === 0 && !updates.expense) return;

    const data: Partial<Purchases> = {};
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.deliveryDate !== undefined)
      data.deliveryDate = updates.deliveryDate;
    if (updates.who !== undefined) data.who = updates.who;
    if (updates.store !== undefined) data.store = updates.store;

    const items: { id: string; data: Partial<Purchases> }[] =
      purchasesToUpdate.map((p) => ({ id: p.id, data }));

    // Inclure la mise à jour de l'expense (total) dans le même lot
    if (updates.expense) {
      items.push({
        id: updates.expense.purchaseId,
        data: {
          price: updates.expense.price,
          invoiceTotal: updates.expense.invoiceTotal,
        },
      });
    }

    await this.#purchasesCollection.bulkUpdate(items);
  }

  /**
   * Met à jour un purchase individuel.
   * Si detachFromGroup=true, le purchase quitte la facture (invoiceId → null).
   */
  async updateInvoicePurchase(
    purchaseId: string,
    updates: Partial<Purchases>,
    detachFromGroup = false,
  ): Promise<void> {
    const payload = detachFromGroup ? { ...updates, invoiceId: null } : updates;
    await this.updatePurchase(purchaseId, payload);
  }

  /**
   * Soft-delete tous les purchases d'une facture (status → "deleted"), via
   * `bulkUpdate` (lots batchés pb-sync : miroir Dexie immédiat, rollback par
   * lot).
   */
  async deleteInvoiceGroup(invoiceId: string): Promise<void> {
    const invoice = this.groupedInvoices.find(
      (inv) => inv.invoiceId === invoiceId,
    );
    if (!invoice) throw new Error(`Facture ${invoiceId} introuvable`);

    const purchasesToDelete = invoice.purchases.filter(
      (p) => p.status !== "deleted",
    );
    if (purchasesToDelete.length === 0) return;

    await this.#purchasesCollection.bulkUpdate(
      purchasesToDelete.map((p) => ({ id: p.id, data: { status: "deleted" } })),
    );
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
    /** Besoin déclaré hors recettes : normalisé en unité de base puis stocké dans specs.quantity — ne crée pas d'achat. */
    quantity?: number;
    unit?: string;
  }): Promise<string> {
    // Une quantité fournie déclare un besoin (specs.quantity, lu par
    // buildRawProductBase), pas un achat — parité createManualProduct sœur.
    let spec: ManualSpecs = {
      pF: productData.pF || false,
      pS: productData.pS || false,
    };
    if (productData.quantity != null && productData.quantity > 0) {
      const normalized = UnitConverter.normalize(
        productData.quantity,
        productData.unit?.trim() || "unité",
      );
      spec = {
        quantity: { q: normalized.quantity, u: normalized.unit },
        ...spec,
      };
    }

    const newProduct = await this.#productsCollection
      .create({
        ingredientRef: null,
        productName: productData.productName,
        productType: productData.productType || "Autre",
        store: productData.store || null,
        who: productData.who || [],
        eventId: this.#currentEventId!,
        status: productData.status || "active",
        stockReel: productData.stockReel || null,
        updatedBy: globalState.userId,
        isSynced: true,
        isMerged: false,
        mergedFrom: null,
        mergeDate: null,
        mergeReason: null,
        mergedInto: null,
        totalNeededOverride: null,
        specs: JSON.stringify(spec),
      } as unknown as Omit<Products, "id" | "created" | "updated">)
      .catch(toProductWriteError);

    return newProduct.id;
  }

  async createExpense(data: {
    invoiceTotal: number;
    store?: string;
    notes?: string;
    who?: string;
    /** Rattachée à une facture groupée (FACTURE_*) — laisse null sinon. */
    invoiceId?: string;
  }): Promise<void> {
    const eventId = this.#currentEventId;
    if (!eventId) throw new Error("Aucun événement principal actif");

    await this.#purchasesCollection.create({
      products: [],
      eventId,
      quantity: 1,
      unit: "global",
      status: "expense",
      notes: data.notes || "",
      store: data.store || null,
      who: data.who || globalState.userName,
      price: data.invoiceTotal,
      invoiceId: data.invoiceId ?? null,
      invoiceTotal: data.invoiceTotal,
      orderDate: null,
      deliveryDate: new Date().toISOString(),
      createdBy: globalState.userId,
    } as unknown as Omit<Purchases, "id" | "created" | "updated">);
  }

  /**
   * Traduit un patch de niveau enrichi en champs schéma PB : `storeInfo`
   * (objet StoreInfo) part dans le champ json natif `store`. Parité
   * ère-Appwrite (`upsertProductBatch` stringifiait — PB re-parse en json) ;
   * `safeJsonParse` du rendu accepte les deux formes.
   */
  #toSchemaUpdates(updates: Partial<EnrichedProduct>): Partial<Products> {
    const { storeInfo, ...schemaUpdates } = updates;
    const result = { ...schemaUpdates } as Partial<Products>;
    if (storeInfo !== undefined) {
      result.store = storeInfo as unknown as Partial<Products>["store"];
    }
    return result;
  }

  /**
   * Update au contrat offline-first (attach-or-create) : la sync collection
   * rattache seule un record présent côté serveur mais absent du cache ; un
   * produit virtuel pur (besoin calculé, jamais poussé au serveur) est
   * upserté à son id sémantique stable — la primitive crée si le serveur
   * l'ignore, met à jour s'il le connaît. Un id inconnu (ni cache, ni
   * serveur, ni besoin) reste une erreur légitime, aucune création
   * silencieuse.
   *
   * @returns L'id du record écrit (stable : le même que l'entrée).
   */
  async #updateWithUpsert(
    productId: string,
    updates: Partial<EnrichedProduct>,
  ): Promise<string> {
    const schemaUpdates = this.#toSchemaUpdates(updates);
    try {
      await this.#productsCollection.update(productId, schemaUpdates);
      return productId;
    } catch (err) {
      if (!(err instanceof RecordNotFoundError)) throw err;
      const enriched = this.getEnrichedProductById(productId);
      if (!enriched) throw err;
      // Un seul write : matérialisation + patch dans la même charge utile
      await this.#productsCollection.upsert({
        id: productId,
        ...this.#virtualProductPayload(enriched),
        ...schemaUpdates,
      } as Omit<Products, "id" | "created" | "updated"> & { id: string });
      return productId;
    }
  }

  async updateProduct(
    productId: string,
    updates: Partial<EnrichedProduct>,
  ): Promise<string> {
    return this.#updateWithUpsert(productId, updates);
  }

  async updateProductBatch(
    productId: string,
    updates: Partial<EnrichedProduct>,
    _callback?: (id: string) => EnrichedProduct | undefined,
  ): Promise<string> {
    return this.#updateWithUpsert(productId, updates);
  }

  async batchUpdateProducts(
    productIds: string[],
    _products: EnrichedProduct[],
    updateType: "who" | "store",
    updateData: { names?: string[] } | StoreInfo,
  ): Promise<BatchUpdateResult> {
    let confirmedCount = 0;
    try {
      const patch: Partial<Products> =
        updateType === "who"
          ? { who: (updateData as { names?: string[] }).names || null }
          : { store: JSON.stringify(updateData as StoreInfo) };

      // Tri par item : patch pur pour un record déjà miroité, matérialisation
      // upsert pour un virtuel, patch brut pour un id sans empreinte locale —
      // le serveur tranche (404 explicite si réellement absent, succès si le
      // cache local était simplement en retard).
      const updates: { id: string; data: Partial<Products> }[] = [];
      const upserts: (Omit<Products, "id" | "created" | "updated"> & {
        id: string;
      })[] = [];
      for (const productId of productIds) {
        if (await db.products.get(productId)) {
          updates.push({ id: productId, data: patch });
          continue;
        }
        const enriched = this.getEnrichedProductById(productId);
        if (!enriched) {
          updates.push({ id: productId, data: patch });
        } else {
          upserts.push({
            id: productId,
            ...this.#virtualProductPayload(enriched),
            ...patch,
          } as Omit<Products, "id" | "created" | "updated"> & { id: string });
        }
      }

      // bulkUpdate d'abord : un id réellement absent fait échouer ce lot
      // (échec explicite) avant toute matérialisation virtuelle. Les bulk*
      // découpent seuls aux limites batch PB ; le rollback reste par lot.
      const updated = await this.#productsCollection.bulkUpdate(updates);
      confirmedCount += updated.length;
      const upserted = await this.#productsCollection.bulkUpsert(upserts);
      confirmedCount += upserted.length;

      return {
        success: true,
        updatedCount: confirmedCount,
        updateType,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        // Confirmations acquises avant l'échec (lots déjà committés)
        updatedCount: confirmedCount,
        updateType,
        error: err instanceof Error ? err.message : "Erreur inconnue",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ===========================================================================
  // MERGE / UNMERGE
  // ===========================================================================

  /**
   * Fusionne un produit source dans un produit cible. Un seul write de
   * fusion : `mergedInto` + `mergeDate` sur la SOURCE — la cible n'est pas
   * modifiée par la fusion (une cible virtuelle est matérialisée avant à
   * son état de besoin, voir ci-dessous), tout le reste (agrégation,
   * masquage) est dérivé par le reconciler.
   * Validations : pas d'auto-fusion, pas de chaînage (une source ne peut pas
   * devenir la cible d'un nouveau merge).
   */
  async mergeProducts(sourceId: string, targetId: string): Promise<void> {
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
      toastService.error(
        "Impossible de fusionner vers un produit déjà fusionné",
      );
      return;
    }

    await toastService.track(
      (async () => {
        // `mergedInto` est une relation PB : la cible doit exister côté
        // serveur AVANT l'écriture de la source, sinon rejet 400 (relation
        // invalide). Une cible virtuelle (besoin calculé, jamais écrit) est
        // matérialisée à son id sémantique ; une cible déjà connue du cache
        // passe sans écriture (garde db.products). La source, elle, est
        // matérialisée par l'écriture de fusion elle-même (#updateWithUpsert,
        // jambe create de l'upsert avec mergedInto dans la charge).
        await this.#ensureSyncedProduct(targetId);
        return this.#updateWithUpsert(sourceId, {
          mergedInto: targetId,
          mergeDate: new Date().toISOString(),
        });
      })(),
      {
        loading: "Fusion en cours…",
        success: `"${sourceModel.data.productName}" fusionné vers "${targetModel.data.productName}"`,
        // La matérialisation de la cible peut heurter l'unicité (event, nom) :
        // message métier explicite à la place du libellé statique.
        error: (err) =>
          resolveProductWriteError(err) ?? "Erreur lors de la fusion",
      },
    );
  }

  /**
   * Annule un merge : la source redevient visible. Écriture serveur
   * `{ mergedInto: null, mergeDate: null }` sur la source, puis invalidation
   * du modèle de la cible et passe de reconciliation forcée : ses données
   * (fingerprint) n'ont pas bougé et le liveQuery ne se réveille que sur
   * écriture Dexie — sans ce rerun, la cible resterait figée avec un
   * `mergedFrom` périmé (voire absente du map) jusqu'à la prochaine écriture.
   */
  async unmergeProduct(sourceId: string, targetId: string): Promise<void> {
    // La source n'est plus dans #productModels (retirée par le reconciler
    // car mergedInto !== null) — on lance directement l'écriture.
    await toastService.track(
      this.#updateWithUpsert(sourceId, {
        mergedInto: null,
        mergeDate: null,
      }),
      {
        loading: "Annulation de la fusion…",
        success: "Fusion annulée — le produit redevient visible",
        error: "Erreur lors de l'annulation de la fusion",
      },
    );
    const targetModel = this.#productModels.get(targetId);
    if (targetModel) targetModel._version = "";
    await this.#rerunReconciliation();
  }

  /**
   * Recherche de cibles de fusion (MergeManager). Exclut le produit courant,
   * tout produit déjà source d'un merge, et tout produit déjà fusionné vers
   * le courant. Fuzzy simple (includes) sur nom + type.
   */
  searchProducts(query: string, currentProductId: string): EnrichedProduct[] {
    if (!query.trim()) return [];

    const current = this.#productModels.get(currentProductId)?.data;
    const excludeIds = new Set<string>([currentProductId]);
    // Exclure les produits déjà mergés (sources d'un merge)
    for (const [, model] of this.#productModels) {
      if (model.data.mergedInto) excludeIds.add(model.data.id);
    }
    // Exclure les produits déjà fusionnés VERS le courant
    if (current?.mergedFrom) {
      for (const m of current.mergedFrom) excludeIds.add(m.id);
    }

    const candidates = [...this.#productModels.values()]
      .filter((m) => !excludeIds.has(m.data.id))
      .map((m) => m.data);

    const q = query.toLowerCase().trim();
    return candidates.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.productType.toLowerCase().includes(q),
    );
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
      return {
        success: false,
        totalProductsCreated: 0,
        totalPurchasesCreated: 0,
        totalExpensesCreated: 0,
        error: "Aucun produit à traiter",
      };
    }

    const purchaseStatus = invoiceData.purchaseStatus || "delivered";
    let deliveryDate = invoiceData.purchaseDeliveryDate || null;
    if (purchaseStatus === "delivered" && !deliveryDate) {
      deliveryDate = new Date().toISOString();
    }

    const eventId = this.#currentEventId!;
    let totalPurchasesCreated = 0;
    let totalExpensesCreated = 0;

    try {
      const allOperations: Array<{
        productId: string;
        qty: { q: number; u: string };
      }> = [];

      for (const p of productsData) {
        if (!p.isSynced) {
          // Même matérialisation que le chemin achat (#ensureSyncedProduct) :
          // upsert à l'id sémantique, les achats créés ci-dessous référencent
          // cet id → relation products valide dès la création.
          await this.#ensureSyncedProduct(p.productId);
        }
        for (const qty of p.missingQuantities) {
          allOperations.push({ productId: p.productId, qty });
        }
      }

      // bulkCreate découpe lui-même aux limites batch PB (rollback par lot).
      // Le compteur est posé après le succès : il reflète ce qui est committé.
      const payloads = allOperations.map((op) => ({
        products: [op.productId],
        eventId,
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
        deleted: false,
        price: null,
        invoiceTotal: null,
      }));
      await this.#purchasesCollection.bulkCreate(payloads);
      totalPurchasesCreated = payloads.length;

      // Expense optionnelle
      if (invoiceData.invoiceTotal) {
        await this.#purchasesCollection.create({
          products: [],
          eventId,
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
        } as unknown as Omit<Purchases, "id" | "created" | "updated">);
        totalExpensesCreated = 1;
      }

      return {
        success: true,
        totalProductsCreated: productsData.length,
        totalPurchasesCreated,
        totalExpensesCreated,
      };
    } catch (err) {
      // Le conflit d'unicité doit garder sa forme typée : le modal le passe
      // au résolveur de toast (message explicite), pas au libellé statique.
      if (err instanceof DuplicateProductNameError) throw err;
      return {
        success: false,
        totalProductsCreated: productsData.length,
        totalPurchasesCreated,
        totalExpensesCreated,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      };
    }
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
    this.#cleanupUrlEffect?.();
    this.#cleanupUrlEffect = null;

    // Cleanup liveQuery
    this.#dataSubscription?.unsubscribe();
    this.#dataSubscription = null;

    // Cleanup pb-sync subscriptions
    this.#productsCollection.unsubscribeAll();
    this.#purchasesCollection.unsubscribeAll();

    // Vider les structures de données
    this.#productModels.clear();
    this.#groups = {};
    this.#expensePurchases = new SvelteMap();
    this.#purchasesByProductCache = new Map();
    this.#productNameCache.clear();
    this.#fuzzySearchable = [];
    this.#orphanedPurchasesInfo = [];

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
      searchInRecipes: false,
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

  /**
   * Soft reset : reset() complet + vidage des tables Dexie locales
   * (products, purchases, productNeeds).
   * La souscription liveQuery reste active — les données se repeuplent
   * naturellement quand Dexie est re-rempli (delta sync ou seed de test).
   * Contrairement à reset(), les collections restent utilisables
   * immédiatement après ; contrairement à destroy(), rien d'irréversible.
   */
  async softReset(): Promise<void> {
    this.reset();
    await this.#productsCollection.clearLocal();
    await this.#purchasesCollection.clearLocal();
    await db.productNeeds.clear();
  }

  async destroy() {
    await this.softReset();
    console.log("[ProductsStore] Ressources nettoyees");
  }
}

// =============================================================================
// SINGLETON & EXPORTS
// =============================================================================

export const productsStore = new ProductsStore();
