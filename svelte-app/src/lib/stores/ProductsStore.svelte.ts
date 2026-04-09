import { SvelteMap } from "svelte/reactivity";
import { useDebounce } from "runed";
import type { Products, Purchases } from "../types/appwrite.d";
import type { ProductWithPurchases } from "../services/appwrite-products";

import {
  matchesFilters,
  type FiltersState,
  type TemperatureFilterMode,
  hasConversions,
} from "../utils/productsUtils";
import { sanitizePurchase } from "../utils/dataSanitization";
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
} from "../types/store.types";
import type { EnrichedEvent } from "../types/events";
import { isDemoEvent } from "$lib/data/demo-event-config";

import {
  loadPurchasesListByIds,
  syncProductsWithPurchases,
  loadUpdatedPurchases,
  loadOrphanPurchases,
} from "../services/appwrite-products";
import type { GroupPurchaseBatchResult } from "../services/appwrite-transaction";

import { createIDBCache, type IDBCache } from "../services/indexeddb-cache";
import { globalState } from "./GlobalState.svelte";
import { ProductModel } from "../models/ProductModel.svelte";
import { DateRangeStore } from "./DateRangeStore.svelte";
import { eventsStore } from "./EventsStore.svelte";
import { recipesStore } from "./RecipesStore.svelte";
import { recalculatePurchaseDependents } from "../utils/productEnrichment";
import { setupProductsRealtimeHandler } from "../services/products-realtime.service";

/**
 * ProductsStore - Store principal de gestion des produits avec Svelte 5
 *
 * Architecture du système :
 * ┌─────────────────────────────────────────────────────────────┐
 * │                  ProductsStore                              │
 * │  • SvelteMap<id, EnrichedProduct> (réactivité O(1))        │
 * │  • Cache localStorage (SuperJSON)                          │
 * │  • Filtrage et dérivés réactifs                            │
 * │  • Abonnement realtime Appwrite                            │
 * └─────────────────▲───────────────────────────────────────────┘
 *                   │ Fournit les données brutes
 *                   │
 * ┌─────────────────▼───────────────────────────────────────────┐
 * │              ProductModalState                              │
 * │  • Factory par produit: createProductModalState(productId) │
 * │  • États locaux des formulaires (purchase, stock, etc.)    │
 * │  • Données dérivées du ProductsStore                       │
 * │  • Orchestration des appels Appwrite                       │
 * └─────────────────▲───────────────────────────────────────────┘
 *                   │ Consommé par les composants
 *                   │
 * ┌─────────────────▼───────────────────────────────────────────┐
 * │                Composants Svelte                            │
 * │  • UI réactive via $state/$derived                         │
 * │  • Actions utilisateur → ProductModalState                │
 * │  • Mises à jour automatiques                               │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Flux de données :
 * 1. Initialize : Hugo → Cache → Appwrite → Realtime
 * 2. Filtres : $derived.by() pour performance
 * 3. Persistence : localStorage + debounce
 * 4. Sync : lastSync + delta updates
 *
 * @usage
 * await productsStore.initialize('mainId');
 * productsStore.setSearchQuery('pâtes');
 * const product = productsStore.getEnrichedProductById('abc');
 * const modalState = createProductModalState('abc');
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const BATCH_LIMIT = 1000;
const SYNC_DEBOUNCE_MS = 500;

// Version de migration actuelle - À incrémenter lors des changements de structure
// qui nécessitent d'invalider les caches existants
const CURRENT_MIGRATION_VERSION = 2;

// =============================================================================
// STORE SINGLETON
// =============================================================================

class ProductsStore {
  // État principal - SvelteMap réactive
  #enrichedProducts = new SvelteMap<string, ProductModel>();
  // Achats orphelins (dépenses globales sans produits)
  #orphanPurchases = new SvelteMap<string, Purchases>();

  // Métadonnées
  #currentMainId = $state<string | null>(null);
  #currentEventId = $state<string | null>(null); // ID de l'événement (remplace hugoMetadata)
  #isInitialized = $state(false);
  #loading = $state(false);
  #error = $state<string | null>(null);
  #syncing = $state(false);
  #realtimeConnected = $state(false);
  #lastSync = $state<string | null>(null);

  // Getters publics
  get currentMainId() {
    return this.#currentMainId;
  }

  // Gestion des dates
  dateStore = new DateRangeStore();

  // Delegation des propriétés pour compatibilité (ou usage direct via dateStore)
  get dateRange() {
    return this.dateStore.current;
  }

  get availableDates() {
    return this.dateStore.dates;
  }

  // État de l'événement (Delegation)
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

  // Cache keys
  // #cacheKey: string | null = null;
  // #metadataKey: string | null = null;
  #idbCache: IDBCache | null = null;

  // Gestion des mises à jour
  #unsubscribe: (() => void) | null = null;

  // État pour gérer les conflits d'override (conservé pour compatibilité)
  #pendingOverrideConflicts = $state<any[]>([]);

  get hasPendingConflicts() {
    return this.#pendingOverrideConflicts.length > 0;
  }

  get pendingConflicts() {
    return this.#pendingOverrideConflicts;
  }

  // =========================================================================
  // INITIALISATION
  // =========================================================================

  // Filtres
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

  // =========================================================================
  // GETTERS PUBLICS
  // =========================================================================

  get filters() {
    return this.#filters;
  }

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

  /**
   * Indique si une recherche par texte est active.
   * Quand true, les autres filtres sont désactivés (mode recherche exclusive).
   */
  get isSearchActive() {
    return this.filters.searchQuery.trim().length > 0;
  }

  /**
   * Retourne une description textuelle des filtres actifs (hors recherche).
   * Utilisé pour l'indicateur flottant sur mobile.
   */
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

  // =========================================================================
  // EXPORT MARKDOWN
  // =========================================================================

  /**
   * Exporte les produits filtrés et groupés au format Markdown
   * Le format respecte la structure :
   * ---
   * # EventTitle - période (dates filtrées)
   *
   * ## Group label
   * - productName: besoin | acquis | manque
   * ...
   *
   * @param eventName - Nom de l'événement
   * @returns Chaîne Markdown prête à être téléchargée
   */
  exportToMarkdown(eventName: string): string {
    const lines: string[] = [];

    // En-tête
    lines.push("---");
    lines.push(`# ${eventName}`);

    // Dates filtrées (depuis dateStore, pas les params de l'événement)
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

    // Produits groupés
    const groups = this.#groupedFilteredProducts;
    const groupKeys = Object.keys(groups);

    if (groupKeys.length === 0) {
      lines.push("_Aucun produit ne correspond aux filtres actuels._");
    } else {
      for (const groupLabel of groupKeys) {
        const models = groups[groupLabel]!;

        // Titre de groupe (sauf si groupBy === "none")
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

  // ====== Gestion des dates ======
  //
  // ====== Gestion des dates (Delegation) ======
  //

  /**
   * Définit la plage de dates avec validation intelligente
   */
  setDateRange(date1: string | null, date2: string | null) {
    this.dateStore.setRange(date1, date2);
  }

  /**
   * Vérifie si la plage de dates couvre toutes les dates disponibles
   */
  isFullRange() {
    return this.dateStore.isFullRange;
  }

  /**
   * Initialise automatiquement la plage de dates si elle est vide
   */
  private initializeDateRange() {
    this.dateStore.initializeSmartRange();
  }

  /**
   * Sélectionne toutes les dates à partir d'aujourd'hui
   */
  selectUpcomingDates() {
    this.dateStore.selectUpcoming();
  }

  /**
   * Vérifie si la plage de dates actuelle correspond aux dates à venir
   */
  isUpcomingRange() {
    return this.dateStore.isUpcomingRange;
  }

  // Bornes calculées (dérivées)
  get firstAvailableDate() {
    return this.dateStore.firstAvailableDate;
  }

  get lastAvailableDate() {
    return this.dateStore.lastAvailableDate;
  }

  /**
   * Sélectionne uniquement les dates futures à partir de demain
   */
  selectFutureDatesOnly() {
    this.dateStore.selectFutureDatesOnly();
  }
  get realtimeConnected() {
    return this.#realtimeConnected;
  }

  // =========================================================================
  // DÉRIVES RÉACTIFS - Consommés par les templates
  // =========================================================================

  /**
   * Conversion SvelteMap → Array pour les templates
   */
  enrichedProducts = $derived.by(() => {
    const result = Array.from(this.#enrichedProducts.values()).map(
      (m) => m.data,
    );
    console.log(
      `[ProductsStore] enrichedProducts recalculated: ${result.length} products`,
    );
    return result;
  });

  // === Cache des totaux par plage de dates ===
  // Ce cache se recalcule automatiquement quand dateRange.start/dateRange.end changent

  /**
   * Produits filtrés qui ont des données dans la plage de dates courante
   * Version Map pour les calculs optimisés (O(1) par ID)
   */
  filteredProductsMap = $derived.by(() => {
    console.log("[Store] Filtering products by date range (Map)");

    if (!this.dateRange.start || !this.dateRange.end) {
      return new Map<string, ProductModel>();
    }

    const startDate = new Date(this.dateRange.start);
    const endDate = new Date(this.dateRange.end);
    const filteredMap = new Map<string, ProductModel>();

    // ⚡ OPTIMISATION : Conserver les chaînes ISO pour comparaison directe
    const startDateISO = this.dateRange.start;
    const endDateISO = this.dateRange.end;

    // Itération directe sur la Map interne (plus performant)
    for (const [id, model] of this.#enrichedProducts) {
      const product = model.data;

      const isManualProduct = !product.productHugoUuid;
      // 2. On exclut si pas de byDate ET que ce n'est PAS un produit manuel
      if (!product.byDate && !isManualProduct) continue;

      // Application des filtres utilisateur
      const matchesFiltersResult = matchesFilters(product, this.#filters);
      if (!matchesFiltersResult) continue;

      // Filtre de statut de complétion (basé sur hasMissing du model)
      if (this.#filters.completionStatus !== "all") {
        const hasMissing = model.stats.hasMissing;
        if (this.#filters.completionStatus === "completed" && hasMissing)
          continue;
        if (this.#filters.completionStatus === "incomplete" && !hasMissing)
          continue;
      }

      // Vérifier si le produit a des données dans la plage de dates
      let hasDataInRange = false;
      if (product.byDate) {
        // ⚡ OPTIMISATION : Comparaison directe de chaînes ISO 8601
        // Les dates ISO sont lexicographiquement comparables, pas besoin de new Date()
        // Gain : ~30-50% plus rapide dans la boucle de filtrage
        hasDataInRange = Object.keys(product.byDate).some((dateStr) => {
          // ⚡ OPTIMISATION : Comparaison directe de chaînes ISO 8601
          // Plus rapide que new Date() + comparaison d'objets
          return dateStr >= startDateISO && dateStr <= endDateISO;
        });
      }

      if (hasDataInRange || isManualProduct) {
        filteredMap.set(id, model);
      }
    }

    return filteredMap;
  });

  /**
   * Statistiques des produits filtrés
   */
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

  /**
   * Valeurs uniques pour les filtres
   */
  uniqueStores = $derived.by(() => {
    const storeNames = Array.from(this.#enrichedProducts.values())
      .map((p) => p.storeInfo?.storeName)
      .filter(Boolean);
    return [...new Set(storeNames)] as string[];
  });

  /**
   * Liste des noms des contributeurs de l'événement (contributors[].name)
   * Filtre uniquement les contributeurs "accepted" avec un name défini
   * @public Utilisé par VolunteerManager pour la sélection des volontaires
   */
  eventContributors = $derived.by(() => {
    if (!this.#currentEventId) return [];

    const event = eventsStore.getEventById(this.#currentEventId);
    if (!event?.contributors) return [];

    return event.contributors
      .filter((c) => c.status === "accepted" && c.name?.trim())
      .map((c) => c.name!.trim())
      .sort();
  });

  /**
   * Liste des personnes déjà utilisées dans les produits/purchases
   * Conserve la flexibilité d'ajouter des personnes custom (ex: "Magasin X")
   * @private Utilisé uniquement pour calculer uniqueWho
   */
  #usedWho = $derived.by(() => {
    const whos = Array.from(this.#enrichedProducts.values()).flatMap(
      (p) => p.who || [],
    );
    return [...new Set(whos)].sort();
  });

  /**
   * Fusion intelligente : contributors officiels + personnes déjà utilisées
   * - Contributors de l'événement (eventContributors)
   * - Personnes custom déjà utilisées (#usedWho)
   * - Tri alphabétique pour l'affichage
   * @public Utilisé par tous les composants pour les suggestions de "qui"
   */
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

  // === ÉTAPE 2 : IDs des produits pertinents ===
  // Dérivé léger qui dépend de totalNeededByDateRange

  // Un seul dérivé qui fait tout : groupement basé sur les produits filtrés par date
  // Optimisé pour utiliser la Map directement avec tri alphabétique natif
  #groupedFilteredProducts = $derived.by(() => {
    // Utiliser les produits déjà filtrés (conversion unique Map → tableau)
    const relevantProducts = Array.from(this.filteredProductsMap.values());

    // 🎯 TRI ALPHABÉTIQUE NATIF - grâce aux clés sémantiques !
    // Les clés sémantiques sont de la forme "nom-produit_uuid" donc trier directement sur $id
    // TOCHECK [AI] : pourquoi sur $id ???
    const sortedProducts = relevantProducts.sort((a, b) =>
      a.$id.localeCompare(b.$id),
    );

    // Grouper les produits triés
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

    // 🎯 TRI DES GROUPES par ordre alphabétique
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      // Le groupe vide (sans groupe) doit être à la fin
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    });

    // Reconstruire l'objet dans l'ordre trié
    const sortedGroups: Record<string, ProductModel[]> = {};
    sortedGroupKeys.forEach((key) => {
      sortedGroups[key] = groups[key]!;
    });

    return sortedGroups;
  });

  // =========================================================================
  // INITIALISATION
  // =========================================================================

  /**
   * Initialise le store depuis un événement
   * 1. Charge depuis le cache IndexedDB
   * 2. Calcule les produits depuis event.meals
   * 3. Synchronise avec Appwrite (purchases)
   * 4. Configure l'abonnement realtime
   *
   * @param eventId - ID de l'événement depuis EventsStore
   */
  async initialize(eventId: string) {
    if (!eventId?.trim()) {
      throw new Error("eventId invalide fourni");
    }

    if (this.#isInitialized && this.#currentEventId === eventId) {
      console.log(`[ProductsStore] Déjà initialisé pour eventId: ${eventId}`);
      return;
    }

    // Si on change d'événement, nettoyer l'état précédent
    if (this.#isInitialized && this.#currentEventId !== eventId) {
      console.log(
        `[ProductsStore] Changement d'événement: ${this.#currentEventId} → ${eventId}, reset...`,
      );
      this.reset();
    }

    console.log(`[ProductsStore] Initialisation avec eventId: ${eventId}`);

    // Récupérer l'événement depuis EventsStore
    const event = eventsStore.getEventById(eventId);

    if (!event) {
      throw new Error(`Événement ${eventId} introuvable dans EventsStore`);
    }

    try {
      // Définir les IDs pour les méthodes de sync
      this.#currentEventId = event.$id;
      this.#currentMainId = event.$id; // mainId = eventId dans la nouvelle architecture

      // 0. Initialiser le cache IndexedDB
      console.log(
        `[ProductsStore] Initialisation du cache IDB pour mainId: ${this.#currentMainId}`,
      );
      this.#idbCache = await createIDBCache(this.#currentMainId);

      // 1. Charger depuis le cache si disponible
      await this.#loadFromCache();

      // 2. Si le cache est vide, calculer depuis event.meals
      if (this.#enrichedProducts.size === 0) {
        console.log("[ProductsStore] Cache vide, calcul depuis event.meals...");

        // ⚠️ IMPORTANT : Attendre que RecipesStore ait terminé sa synchronisation
        // distante avant de calculer les produits. Sans cela, en cas d'accès direct
        // à la page (sans passer par la homepage), les details IDB de recettes
        // obsolètes pourraient être utilisés avant que RecipesStore ait eu le temps
        // de les invalider (race condition entre loadCache+syncFromRemote et ProductsStore.initialize).
        console.log("[ProductsStore] Attente de recipesStore.syncReady...");
        await recipesStore.syncReady;
        console.log(
          "[ProductsStore] recipesStore.syncReady → calcul des produits",
        );

        await this.#calculateProductsFromEvent(event);

        // Persister le cache
        await this.#createCache();
      }

      // 3. Initialiser la plage de dates
      this.dateStore.setAvailableDates([...(event.allDates || [])]);
      this.initializeDateRange();

      // 4. Sync en arrière-plan (purchases uniquement)
      await this.syncFromAppwrite();

      // 5. Charger les dépenses globales (orphelines)
      await this.#loadOrphanPurchases();

      // Marquer comme initialisé
      this.#isInitialized = true;

      // 6. Setup realtime (Appwrite via service externalisé)
      this.#setupRealtimeSubscriptions();

      // 7. Setup Reactive Sync avec EventsStore (Meals updates)
      if (this.#cleanupSyncEffect) this.#cleanupSyncEffect();

      this.#cleanupSyncEffect = $effect.root(() => {
        $effect(() => {
          // Cette ligne réactive s'abonne aux mises à jour de l'événement dans le EventsStore
          const reactiveEvent = eventsStore.getEventById(eventId);

          if (reactiveEvent) {
            // On utilise untrack pour ne pas re-déclencher l'effet si syncWithEventMeals lit des états réactifs
            // Mais ici on veut juste réagir au changement de l'objet event (qui change à chaque update realtime)
            this.#syncWithEventMeals(reactiveEvent);
          }
        });
      });

      console.log(
        `[ProductsStore] Initialisation complétée: ${this.#enrichedProducts.size} produits`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'initialisation";
      this.#error = message;
      console.error("[ProductsStore]", message, err);
      throw err;
    }
  }

  /**
   * Synchronise réactivement les produits avec les repas de l'événement
   * Appelée automatiquement quand l'événément change dans EventsStore
   */
  async #syncWithEventMeals(event: EnrichedEvent) {
    // Trace de l'entrée dans la fonction
    // console.log(`[ProductsStore] 🔄 Sync check pour event ${event.$id}`);

    if (!this.#isInitialized) {
      console.warn("[ProductsStore] Sync ignoré car store non initialisé");
      return;
    }

    // Utiliser JSON.stringify pour détecter si les repas ont VRAIMENT changé
    const mealsHash = JSON.stringify(event.meals);

    if (this.#lastMealsHash === mealsHash) {
      // console.log("[ProductsStore] Pas de changement dans les repas, skip.");
      return;
    }

    console.log(
      `[ProductsStore] ⚡️ CHANGEMENT REPAS DÉTECTÉ pour ${event.$id} (Hash: ${mealsHash.substring(0, 10)}...), recalcul...`,
    );
    this.#lastMealsHash = mealsHash;

    // Fonction pour récupérer les détails d'une recette
    const getRecipeDetails = async (uuid: string) => {
      return await recipesStore.getRecipeByUuid(uuid);
    };

    // Recalculer les produits "frais" depuis les repas
    const freshProducts = await createEnrichedProductsFromEvent(
      event,
      getRecipeDetails,
      event.$id,
    );

    // Fusionner avec l'existant pour préserver les achats/overrides
    freshProducts.forEach((fresh) => {
      const existingModel = this.#enrichedProducts.get(fresh.$id);
      if (existingModel) {
        // On met à jour les données calculées depuis les repas
        // On doit préserver les données Appwrite (purchases, store, etc.) qui sont dans existingModel.data
        // updateExistingProduct fait l'inverse (merge Appwrite frais sur Existant)

        // Ici on veut merge FreshMealData sur ExistantAppwriteData
        // On peut le faire manuellement ici
        const existing = existingModel.data;

        const merged: EnrichedProduct = {
          ...existing,
          // Mise à jour des données dérivées des repas
          byDate: fresh.byDate,
          totalNeededArray: fresh.totalNeededArray,
          totalNeededRaw: fresh.totalNeededRaw,
          nbRecipes: fresh.nbRecipes,
          totalAssiettes: fresh.totalAssiettes,
          // On garde le reste (purchases, overrides, etc.)
        };

        // Recalculer les manquants
        recalculatePurchaseDependents(merged);

        // Mise à jour du modèle (déclenche la réactivité)
        existingModel.update(merged);
      } else {
        // Nouveau produit (ajouté via nouveau repas)
        this.#enrichedProducts.set(
          fresh.$id,
          new ProductModel(fresh, this.dateStore),
        );
      }
    });

    // On devrait aussi gérer les suppressions (produits qui ne sont plus dans freshProducts)
    // Mais seulement si !isSynced (non présents sur Appwrite)
    const freshIds = new Set(freshProducts.map((p) => p.$id));
    for (const [id, model] of this.#enrichedProducts) {
      if (!freshIds.has(id)) {
        if (!model.data.isSynced && !model.data.purchases?.length) {
          // Produit local qui n'est plus utile -> Suppression
          this.#enrichedProducts.delete(id);
        }
        // Si isSynced, on garde (peut-être un produit manuel ou orphelin temporaire)
      }
    }

    // Mettre à jour la dateStore si les dates dispos ont changé
    this.dateStore.setAvailableDates([...(event.allDates || [])]);

    // Persister les changements majeurs
    this.#createCache();
  }

  // Hash pour debounce logique
  #lastMealsHash = "";
  // Cleanup effect
  #cleanupSyncEffect: (() => void) | null = null;

  /**
   * Calcule les produits depuis les meals d'un événement
   */
  async #calculateProductsFromEvent(event: EnrichedEvent): Promise<void> {
    // Fonction pour récupérer les détails d'une recette
    const getRecipeDetails = async (uuid: string) => {
      return await recipesStore.getRecipeByUuid(uuid);
    };

    // Calculer les produits
    const products = await createEnrichedProductsFromEvent(
      event,
      getRecipeDetails,
      event.$id,
    );

    // Ajouter à la SvelteMap
    products.forEach((enriched) => {
      this.#enrichedProducts.set(
        enriched.$id,
        new ProductModel(enriched, this.dateStore),
      );
    });

    console.log(
      `[ProductsStore] ${products.length} produits calculés depuis ${event.meals.length} repas`,
    );
  }

  // =========================================================================
  // CHARGEMENT & CACHE
  // =========================================================================

  /**
   * Charge les produits depuis IndexedDB
   */
  async #loadFromCache() {
    if (!this.#idbCache) return;

    try {
      // 1. Charger les métadonnées D'ABORD pour vérifier la version
      const metadata = await this.#idbCache.loadMetadata();

      // 2. Vérifier la version de migration
      if (metadata.migrationVersion !== CURRENT_MIGRATION_VERSION) {
        console.log(
          `[ProductsStore] ⚠️ Cache invalide : version de migration obsolète (${metadata.migrationVersion} ≠ ${CURRENT_MIGRATION_VERSION})`,
        );
        console.log(
          `[ProductsStore] Le cache sera ignoré et les produits seront recalculés`,
        );
        return; // Ne pas charger le cache
      }

      // 3. Charger les produits
      const productsMap = await this.#idbCache.loadProducts();

      productsMap.forEach((product, id) => {
        // 🔧 SANITIZATION: Reset transient status
        if (product.status === "isSyncing") {
          product.status = "active";
        }
        this.#enrichedProducts.set(
          id,
          new ProductModel(product, this.dateStore),
        );
      });

      this.#lastSync = metadata.lastSync;
      this.dateStore.setAvailableDates([...metadata.allDates]);

      console.log(
        `[ProductsStore] ${productsMap.size} produits chargés du cache IDB (v${metadata.migrationVersion}), lastSync: ${metadata.lastSync}`,
      );
    } catch (err) {
      console.warn("[ProductsStore] Erreur lecture cache IDB, ignoré:", err);
    }
  }

  /**
   * Sync les données depuis Appwrite (public pour les notifications externes)
   * Utilisé par NotificationStore pour les mises à jour batch
   */
  async syncFromAppwrite() {
    // 🔥 MODE LOCAL: Skip Appwrite sync
    if (isDemoEvent(this.#currentEventId)) {
      console.log("[ProductsStore] Mode local: skip syncFromAppwrite");
      return;
    }

    // Mode normal (existing code)
    if (!this.#currentMainId) return;
    this.#syncing = true;
    console.log(
      `[ProductsStore] Début syncFromAppwrite pour mainId: ${this.#currentMainId}`,
    );

    try {
      // 1. Synchroniser les produits modifiés depuis Appwrite
      console.log(
        `[ProductsStore] Récupération des produits modifiés depuis lastSync: ${this.#lastSync}`,
      );
      const allProducts = await syncProductsWithPurchases(this.#currentMainId, {
        lastSync: this.#lastSync,
        limit: BATCH_LIMIT,
      });
      console.log(
        `[ProductsStore] ${allProducts.length} produits récupérés depuis Appwrite`,
      );

      // 2. Appliquer les produits venant d'Appwrite (isSynced: true)
      // IMPORTANT : Faire cela en premier pour établir la base de données
      allProducts.forEach((product) => {
        const existingModel = this.#enrichedProducts.get(product.$id);
        console.log(
          `[ProductsStore] Sync produit ${product.$id}: existing=${!!existingModel}, who=${product.who}, store=${product.store}`,
        );
        const enriched = this.#enrichProduct(product, existingModel?.data); // ← Préserve les données locales
        enriched.isSynced = true; // ✅ SYNC : Les produits venant d'Appwrite sont sync
        enriched.status = "active"; // 🔧 FIX : Réinitialiser le statut à "active" après sync réussi

        if (existingModel) {
          existingModel.update(enriched);
        } else {
          this.#enrichedProducts.set(
            product.$id,
            new ProductModel(enriched, this.dateStore),
          );
        }
      });

      // 3. Synchroniser les purchases modifiés (pour les produits non-modifiés ET les orphelins)
      // Appliquer PAR-DESSUS les produits fraîchement synchronisés
      if (this.#lastSync) {
        console.log(
          `[ProductsStore] Récupération des purchases modifiés depuis lastSync: ${this.#lastSync}`,
        );
        const updatedPurchases = await loadUpdatedPurchases(
          this.#currentMainId,
          this.#lastSync,
          BATCH_LIMIT,
        );
        console.log(
          `[ProductsStore] ${updatedPurchases.length} purchases modifiés récupérés`,
        );

        // Appliquer les purchases modifiés aux produits existants OU aux orphelins
        updatedPurchases.forEach((purchase) => {
          if (purchase.status === "expense") {
            // C'est une dépense globale
            this.#orphanPurchases.set(purchase.$id, purchase);
          } else if (purchase.products?.length) {
            const productIds = purchase.products.map((prod: any) =>
              typeof prod === "string" ? prod : prod.$id,
            );
            this.#updatePurchaseInProducts(productIds, purchase);
          }
        });
      }

      this.#updateLastSync();
      await this.#createCache(); // Sync complet = persistence complète
      console.log(`[ProductsStore] SyncFromAppwrite terminé avec succès`);
    } catch (error) {
      console.error("[ProductsStore] Erreur lors du sync:", error);
      throw error;
    } finally {
      this.#syncing = false;
    }
  }

  // === UTILS ===
  /**
   * Persiste les produits enrichis dans IndexedDB
   */
  async #createCache() {
    if (!this.#idbCache) return;

    try {
      // Sauvegarder les produits
      const productsToSave = new Map<string, EnrichedProduct>();

      this.#enrichedProducts.forEach((model, id) => {
        const snapshot = $state.snapshot(model.data);
        // 🔧 SANITIZATION: Ne jamais persister l'état transitoire
        if (snapshot.status === "isSyncing") {
          snapshot.status = "active";
        }
        productsToSave.set(id, snapshot);
      });
      await this.#idbCache.saveProducts(productsToSave);

      // Sauvegarder les métadonnées avec la version de migration actuelle
      await this.#idbCache.saveMetadata({
        lastSync: this.#lastSync,
        allDates: [...this.dateStore.dates],
        migrationVersion: CURRENT_MIGRATION_VERSION,
      });

      console.log(
        `[ProductsStore] Cache IDB persisté (v${CURRENT_MIGRATION_VERSION})`,
      );
    } catch (err) {
      console.error("[ProductsStore] Erreur persist cache IDB:", err);
    }
  }

  /**
   * Persiste uniquement les produits spécifiés dans IndexedDB
   * 🎯 Optimisé : pas de sauvegarde complète, uniquement les produits affectés
   */
  async #persistAffectedProducts(productIds: string[]): Promise<void> {
    if (!this.#idbCache || productIds.length === 0) return;

    try {
      // Persister chaque produit affecté
      const persistPromises = productIds
        .map((id) => this.#enrichedProducts.get(id)?.data)
        .filter((product) => product != null)
        .map((product) => {
          const snapshot = $state.snapshot(product!);
          // 🔧 SANITIZATION: Ne jamais persister l'état transitoire
          if (snapshot.status === "isSyncing") {
            snapshot.status = "active";
          }
          return this.#idbCache!.upsertProduct(snapshot);
        });

      if (persistPromises.length > 0) {
        await Promise.all(persistPromises);
        console.log(
          `[ProductsStore] ${persistPromises.length} produits affectés persistés`,
        );
      }
    } catch (err) {
      console.error(
        "[ProductsStore] Erreur persistence produits affectés:",
        err,
      );
    }
  }

  #updateLastSync() {
    this.#lastSync = new Date().toISOString();
  }

  // =========================================================================
  // ENRICHISSEMENT DE PRODUITS
  // =========================================================================

  /**
   * 🎯 #enrichProduct : Prend un Products d'Appwrite et fusionne avec existant
   *
   * Cas 1 : Nouveau produit Appwrite (sync)
   *   - Récupérer l'existant local, garder byDate
   *   - Fusionner les données Appwrite fraîches
   *   - Recalculer les dérivés
   *
   * Cas 2 : Mise à jour existant
   *   - Remplacer les champs bruts modifiés
   *   - Recalculer les dérivés concernés
   */
  #enrichProduct(
    product: Products & { purchases?: Purchases[] },
    existing?: EnrichedProduct,
  ): EnrichedProduct {
    if (existing) {
      return updateExistingProduct(product, existing);
    } else {
      return createEnrichedProductFromAppwrite(product);
    }
  }

  /**
   * Batch upsert multiple products
   */
  #batchUpsertEnrichedProducts(products: Products[]) {
    if (!products.length) return;

    products.forEach((product) => this.#upsertEnrichedProduct(product));
    console.log(`[ProductsStore] ${products.length} produits upserted`);
  }

  /**
   * Upsert dans la SvelteMap (mutation directe = réactive)
   * Version optimisée avec enrichProduct intelligent
   */
  #upsertEnrichedProduct(product: Products) {
    const existingModel = this.#enrichedProducts.get(product.$id);
    const enriched = this.#enrichProduct(product, existingModel?.data);

    if (existingModel) {
      existingModel.update(enriched);
    } else {
      const allDates = this.dateStore.dates;
      this.#enrichedProducts.set(
        product.$id,
        new ProductModel(enriched, this.dateStore),
      );
    }
  }

  /**
   * Supprime un produit de la SvelteMap
   */
  #removeEnrichedProduct(productId: string) {
    this.#enrichedProducts.delete(productId);
  }

  addProductOptimistic(product: Products) {
    this.#handleProductUpsert(product);
  }

  // =========================================================================
  // GESTION DES PURCHASES
  // =========================================================================

  async #applyPurchaseCreated(purchase: Purchases): Promise<string[]> {
    if (!purchase.products?.length) {
      console.warn(
        "[ProductsStore] Purchase créé sans products:",
        purchase.$id,
      );
      return [];
    }
    // Extraire les product IDs
    const productIds = purchase.products
      .map((prod: any) => (typeof prod === "string" ? prod : prod.$id))
      .filter(Boolean);

    // Mise à jour locale immédiate
    this.#addPurchaseToProducts(productIds, purchase);

    return productIds; // Retourner les produits affectés pour persistence
  }

  /**
   * Gère la mise à jour d'un purchase (payload partiel possible)
   */
  async #applyPurchaseUpdated(purchase: Purchases): Promise<string[]> {
    // Si le statut passe à "deleted", traiter comme une suppression
    if (purchase.status === "deleted") {
      console.log(
        `[ProductsStore] Purchase ${purchase.$id} marqué comme supprimé, retrait...`,
      );
      return await this.#applyPurchaseDeleted(purchase.$id);
    }

    // Si products[] est dans le payload, on peut procéder directement
    // TOCHECK : normalement n'y ait jamais, sauf peut etre lorsque l'on mergera des products ??
    if (purchase.products?.length) {
      const productIds = purchase.products
        .map((prod: any) => (typeof prod === "string" ? prod : prod.$id))
        .filter(Boolean);

      this.#updatePurchaseInProducts(productIds, purchase);
      return productIds;
    }

    // ⚠️ Sinon, on doit recharger le purchase complet
    console.log(
      "[ProductsStore] Purchase update sans products[], rechargement...",
    );

    try {
      const [fullPurchase] = await loadPurchasesListByIds([purchase.$id]);

      if (fullPurchase?.products?.length) {
        const productIds = fullPurchase.products
          .map((prod: any) => (typeof prod === "string" ? prod : prod.$id))
          .filter(Boolean);

        this.#updatePurchaseInProducts(productIds, fullPurchase);
        return productIds;
      }

      return [];
    } catch (err) {
      console.error("[ProductsStore] Erreur rechargement purchase:", err);
      return [];
    }
  }

  /**
   * Gère la suppression d'un purchase (marqué deleted = true)
   */
  async #applyPurchaseDeleted(purchaseId: string): Promise<string[]> {
    // 0. Gérer les achats orphelins (dépenses)
    if (this.#orphanPurchases.has(purchaseId)) {
      this.#orphanPurchases.delete(purchaseId);
    }

    // 1. Trouver les produits affectés
    const affectedProducts = Array.from(this.#enrichedProducts.values())
      .map((m) => m.data)
      .filter((p) => p.purchases?.some((pur) => pur.$id === purchaseId));

    affectedProducts.forEach((product) => {
      // Créer une nouvelle liste sans le purchase supprimé
      const updatedPurchases = (product.purchases || []).filter(
        (p) => p.$id !== purchaseId,
      );

      // Recalculer le produit enrichi sans ce purchase
      const updatedProduct = updateExistingProduct(
        {
          ...product,
          purchases: updatedPurchases,
        },
        product,
      );

      // Mettre à jour le modèle (réactif)
      const model = this.#enrichedProducts.get(product.$id);
      if (model) {
        model.update(updatedProduct);
      }
    });

    // Retourner les IDs des produits affectés pour persistence
    return affectedProducts.map((p) => p.$id);
  }

  /**
   * Ajoute un purchase à ses products (pour CREATE)
   */
  #addPurchaseToProducts(productIds: string[], purchase: Purchases) {
    // Nettoyer les relations du purchase pour éviter la récursion dans le cache
    const sanitizedPurchase = sanitizePurchase(purchase);

    const productsToUpdate: EnrichedProduct[] = [];

    productIds.forEach((productId) => {
      const model = this.#enrichedProducts.get(productId);
      if (model) {
        const product = model.data;
        const purchases = product.purchases || [];
        // Éviter les doublons (au cas où)
        if (!purchases.some((p) => p.$id === sanitizedPurchase.$id)) {
          // Créer un nouveau produit enrichi avec le purchase ajouté
          // 🔥 RESTAURER LE STATUT À "active" car le purchase a été créé avec succès
          const updatedProduct = updateExistingProduct(
            {
              ...product,
              purchases: [...purchases, sanitizedPurchase],
              status: "active", // Retour au statut normal après sync réussie
            },
            product,
          );
          productsToUpdate.push(updatedProduct);
        }
      }
    });

    // Mettre à jour directement les produits dans la map
    productsToUpdate.forEach((product) => {
      const model = this.#enrichedProducts.get(product.$id);
      if (model) {
        model.update(product);
      }
    });
  }

  /**
   * Met à jour un purchase dans ses products (pour UPDATE)
   */
  #updatePurchaseInProducts(productIds: string[], purchase: Purchases) {
    // Nettoyer les relations du purchase pour éviter la récursion dans le cache
    const sanitizedPurchase = sanitizePurchase(purchase);

    const productsToUpdate: EnrichedProduct[] = [];

    productIds.forEach((productId) => {
      const model = this.#enrichedProducts.get(productId);
      if (model) {
        const product = model.data;
        const purchases = product.purchases || [];
        const index = purchases.findIndex(
          (p) => p.$id === sanitizedPurchase.$id,
        );

        if (index >= 0) {
          // Remplacer le purchase existant
          const updatedPurchases = [...purchases];
          updatedPurchases[index] = sanitizedPurchase;
          // 🔥 RESTAURER LE STATUT À "active" car le purchase a été mis à jour avec succès
          const updatedProduct = updateExistingProduct(
            {
              ...product,
              purchases: updatedPurchases,
              status: "active", // Retour au statut normal après sync réussie
            },
            product,
          );
          productsToUpdate.push(updatedProduct);
        } else {
          // Ajouter si pas trouvé (edge case)
          // Sécurité si il y a eu desync entre appwrite et les données locales ?
          const updatedProduct = updateExistingProduct(
            {
              ...product,
              purchases: [...purchases, purchase],
              status: "active", // Retour au statut normal après sync réussie
            },
            product,
          );
          productsToUpdate.push(updatedProduct);
        }
      }
    });

    // Mettre à jour directement les produits dans la map
    productsToUpdate.forEach((product) => {
      const model = this.#enrichedProducts.get(product.$id);
      if (model) {
        model.update(product);
      }
    });
  }

  // =========================================================================
  // REALTIME
  // =========================================================================

  /**
   * Handler commun pour create/update de produit (DRY)
   */
  #handleProductUpsert(product: Products): void {
    this.#upsertEnrichedProduct(product);
    // Persistence immédiate du produit modifié
    if (this.#idbCache) {
      const model = this.#enrichedProducts.get(product.$id);
      if (model) {
        this.#idbCache
          .upsertProduct($state.snapshot(model.data))
          .catch((err) =>
            console.error("[ProductsStore] Erreur persistence produit:", err),
          );
      }
    }
  }

  #setupRealtimeCallbacks() {
    return {
      onProductCreate: (product: Products) =>
        this.#handleProductUpsert(product),
      onProductUpdate: (product: Products) =>
        this.#handleProductUpsert(product),
      onProductDelete: (productId: string) => {
        this.#removeEnrichedProduct(productId);
        // Persistence immédiate de la suppression
        if (this.#idbCache) {
          this.#idbCache
            .deleteProduct(productId)
            .catch((err) =>
              console.error("[ProductsStore] Erreur suppression produit:", err),
            );
        }
      },
      onPurchaseCreate: async (purchase: Purchases) => {
        if (purchase.status === "expense") {
          this.#orphanPurchases.set(purchase.$id, purchase);
          return;
        }
        const affectedIds = await this.#applyPurchaseCreated(purchase);
        await this.#persistAffectedProducts(affectedIds);
      },
      onPurchaseUpdate: async (purchase: Purchases) => {
        if (purchase.status === "expense") {
          this.#orphanPurchases.set(purchase.$id, purchase);
          return;
        }
        // Si un purchase passe de "expense" à "lié" (peu probable mais possible), on le retire des orphelins
        if (this.#orphanPurchases.has(purchase.$id)) {
          this.#orphanPurchases.delete(purchase.$id);
        }

        const affectedIds = await this.#applyPurchaseUpdated(purchase);
        await this.#persistAffectedProducts(affectedIds);
      },

      // TODO: on ne delete pas les purchase, on les marque deleted = true
      onPurchaseDelete: async (purchaseId: string) => {
        const affectedIds = await this.#applyPurchaseDeleted(purchaseId);
        await this.#persistAffectedProducts(affectedIds);
      },
      onConnect: () => {
        this.#realtimeConnected = true;
      },
      onDisconnect: () => {
        this.#realtimeConnected = false;
      },
      onError: (error: any) => {
        console.error("[ProductsStore] Erreur realtime:", error);
      },
    };
  }

  /**
   * Configure les abonnements realtime via le service externalisé
   */
  #setupRealtimeSubscriptions(): void {
    // 🔥 MODE LOCAL: Skip realtime
    if (isDemoEvent(this.#currentEventId)) {
      console.log("[ProductsStore] Mode local: skip realtime setup");
      return;
    }

    // Utiliser le service externalisé
    const callbacks = this.#setupRealtimeCallbacks();
    this.#unsubscribe = setupProductsRealtimeHandler(callbacks);
  }

  // =========================================================================
  // FILTRAGE
  // =========================================================================

  // Setters publics pour les filtres

  // recherche debouncée - Mode recherche exclusive : désactive les autres filtres
  setSearchQuery = useDebounce(
    (query: string) => {
      this.#filters.searchQuery = query;
      // Si recherche active, réinitialiser les autres filtres
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

  /**
   * Définit le mode de filtre de température (mode exclusif)
   * @param mode - "all" | "frais" | "not-frais" | "surgele" | "not-surgele"
   */
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

  // =========================================================================
  // UTILITAIRES PUBLICS
  // =========================================================================

  getEnrichedProductById(productId: string): EnrichedProduct | null {
    return this.#enrichedProducts.get(productId)?.data ?? null;
  }

  getProductModelById(productId: string): ProductModel | null {
    return this.#enrichedProducts.get(productId) ?? null;
  }

  /**
   * Détecte si un produit a des conversions (q/u différent de qEq/uEq)
   */
  hasConversions(productId: string): boolean {
    const product = this.#enrichedProducts.get(productId)?.data;
    if (!product?.byDate) return false;

    return hasConversions(product.byDate);
  }

  async forceReload(eventId: string) {
    await this.clearCache();
    await this.initialize(eventId);
  }

  async clearCache() {
    this.#enrichedProducts.clear();
    this.#lastSync = null;
    if (this.#idbCache) {
      await this.#idbCache.clear();
    }
    console.log("[ProductsStore] Cache vidé");
  }

  // =============================================================================
  // GESTION DU STATUT DE SYNCHRONISATION
  // =============================================================================

  /**
   * Définit le statut de synchronisation pour plusieurs produits
   * @param productIds - Liste des IDs des produits concernés
   * @param syncing - true pour "isSyncing", false pour "active"
   */
  setSyncStatus(productIds: string[], syncing: boolean) {
    const status = syncing ? "isSyncing" : "active";

    productIds.forEach((productId) => {
      const model = this.#enrichedProducts.get(productId);
      if (model) {
        const updatedProduct = {
          ...model.data,
          status,
        };
        model.update(updatedProduct);
      }
    });

    console.log(
      `[ProductsStore] Statut de synchronisation mis à jour: ${productIds.length} produits → ${status}`,
    );
  }

  /**
   * Nettoie tous les statuts "isSyncing" (retour à "active")
   * Utile en cas d'erreur ou timeout
   */
  clearSyncStatus() {
    const productsToReset: string[] = [];

    for (const [productId, model] of this.#enrichedProducts) {
      if (model.status === "isSyncing") {
        productsToReset.push(productId);
      }
    }

    if (productsToReset.length > 0) {
      this.setSyncStatus(productsToReset, false);
      console.log(
        `[ProductsStore] Nettoyage de ${productsToReset.length} produits en statut "isSyncing"`,
      );
    }
  }

  /**
   * Réinitialise le store pour un nouvel événement.
   * Nettoie l'état interne sans fermer les ressources globales.
   * Appelée automatiquement lors du changement d'eventId.
   */
  reset() {
    console.log(`[ProductsStore] Reset pour eventId: ${this.#currentEventId}`);

    // 1. Désabonner du realtime
    this.#unsubscribe?.();
    this.#unsubscribe = null;

    // 2. Cleanup de l'effet réactif
    if (this.#cleanupSyncEffect) {
      this.#cleanupSyncEffect();
      this.#cleanupSyncEffect = null;
    }

    // 3. Fermer le cache IDB (spécifique à l'event)
    if (this.#idbCache) {
      this.#idbCache.close();
      this.#idbCache = null;
    }

    // 4. Vider les données
    this.#enrichedProducts.clear();
    this.#orphanPurchases.clear();

    // 5. Reset des métadonnées
    this.#currentMainId = null;
    this.#currentEventId = null;
    this.#isInitialized = false;
    this.#loading = false;
    this.#error = null;
    this.#syncing = false;
    this.#realtimeConnected = false;
    this.#lastSync = null;
    this.#lastMealsHash = "";

    // 6. Reset du dateStore
    this.dateStore.reset();

    // 7. Reset des filtres
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

    console.log("[ProductsStore] Reset terminé");
  }

  // =========================================================================
  // MODE LOCAL : Méthodes dédiées (sans Appwrite)
  // =========================================================================

  /**
   * Crée un purchase en mode local (sans Appwrite)
   * Met à jour le produit concerné et persiste dans IndexedDB
   */
  async createPurchaseLocal(
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
    const productModel = this.#enrichedProducts.get(productId);
    if (!productModel) {
      throw new Error(`Produit ${productId} introuvable`);
    }

    // 1. Créer l'objet purchase plain
    const purchaseStatus = options.status || "delivered";
    let deliveryDate = options.deliveryDate || null;

    // Auto-date de livraison si "delivered" et pas de date fournie
    if (purchaseStatus === "delivered" && !deliveryDate) {
      deliveryDate = new Date().toISOString();
    }

    const newPurchase: Purchases = {
      $id: crypto.randomUUID(),
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      $databaseId: "localDemo",
      $tableId: "localDemo",
      $permissions: [],
      $sequence: 0,
      invoiceId: options.invoiceId || null,
      notes: options.notes || "",
      store: options.store || null,
      mainId: this.#currentEventId!,
      unit: quantities[0]?.u || "", // Unité principale
      quantity: quantities.reduce((sum, qty) => sum + qty.q, 0), // Quantité totale
      price: options.price || null,
      status: purchaseStatus,
      who: options.who || null,
      createdBy: "guest",
      orderDate: options.orderDate || new Date().toISOString(),
      deliveryDate,
      invoiceTotal: null,
      products: [productId],
    };

    // 2. Ajouter au produit via le ProductModel
    const currentProduct = $state.snapshot(productModel.data);
    const updatedProduct: EnrichedProduct = {
      ...currentProduct,
      purchases: [...(currentProduct.purchases || []), newPurchase],
      $updatedAt: new Date().toISOString(),
    };

    // 3. Persister dans IndexedDB AVANT de mettre à jour l'état réactif
    if (this.#idbCache) {
      await this.#idbCache.upsertProduct(updatedProduct);
    }

    // Mettre à jour le ProductModel APRÈS
    productModel.update(updatedProduct);

    console.log(`[ProductsStore] Mode local: purchase créé pour ${productId}`);
  }

  /**
   * Crée un produit en mode local (sans Appwrite)
   * Met à jour la Map réactive et persiste dans IndexedDB
   */
  async createProductLocal(productData: {
    productName: string;
    productType?: string;
    pF?: boolean;
    pS?: boolean;
    status?: string;
    who?: string[];
    store?: string;
    stockReel?: string;
  }): Promise<string> {
    const newProductId = crypto.randomUUID();

    // 1. Créer l'objet produit plain
    const newProduct: EnrichedProduct = {
      $id: newProductId,
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      $permissions: [], // Pas de permissions en mode local
      // Données de base
      productHugoUuid: null,
      productName: productData.productName,
      productType: productData.productType || "ingredient",
      pF: productData.pF ?? false,
      pS: productData.pS ?? false,
      nbRecipes: 0,
      totalAssiettes: 0,
      isSynced: false, // Produit local, pas synchronisé avec Appwrite
      mainId: this.#currentEventId!,
      totalNeededRaw: [],
      // Données interactives
      status: productData.status || "ok",
      who: productData.who || null,
      store: productData.store || "",
      stockReel: productData.stockReel || null,
      previousNames: null,
      isMerged: false,
      mergedFrom: null,
      mergeDate: null,
      mergeReason: null,
      mergedInto: null,
      totalNeededOverride: null,
      updatedBy: null,
      specs: null,
      // Données enrichies
      purchases: [],
      byDate: {},
      storeInfo: null,
      stockParsed: null,
      totalNeededArray: [],
      totalPurchasesArray: [],
      stockOrTotalPurchases: "",
      displayTotalNeeded: "",
      displayTotalPurchases: "",
      displayMissingQuantity: "",
      displayTotalOverride: "",
      totalNeededOverrideParsed: null,
      missingQuantityArray: [],
      dateDisplayInfo: {},
      specsParsed: null,
    };

    // 2. Créer le ProductModel et l'ajouter à la Map
    const productModel = new ProductModel(newProduct, this.dateStore);
    this.#enrichedProducts.set(newProductId, productModel);

    // 3. Persister dans IndexedDB
    if (this.#idbCache) {
      await this.#idbCache.upsertProduct(newProduct);
    }

    console.log(`[ProductsStore] Mode local: produit créé ${newProductId}`);
    return newProductId;
  }

  /**
   * Met à jour un produit en mode local
   * Met à jour la Map réactive et persiste dans IndexedDB
   * Maintenant publique pour être utilisée directement si besoin
   */
  async updateProductLocal(
    productId: string,
    updates: Partial<EnrichedProduct>,
  ): Promise<void> {
    const productModel = this.#enrichedProducts.get(productId);
    if (!productModel) {
      throw new Error(`Produit ${productId} introuvable`);
    }

    // 1. Fusionner les données
    const updatedProduct: EnrichedProduct = {
      ...productModel.data,
      ...updates,
      $updatedAt: new Date().toISOString(),
    };

    // 2. Mettre à jour le ProductModel (déclenche la réactivité Svelte 5)
    productModel.update(updatedProduct);

    // 3. Persister dans IndexedDB (avec snapshot pour supprimer les Proxy)
    if (this.#idbCache) {
      const snapshot = $state.snapshot(productModel.data);
      await this.#idbCache.upsertProduct(snapshot);
    }

    console.log(`[ProductsStore] Mode local: produit mis à jour ${productId}`);
  }

  /**
   * Ajoute un purchase en mode local (alias pour #createPurchaseLocal)
   */
  async addPurchaseToLocal(
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
    return await this.createPurchaseLocal(productId, quantities, options);
  }

  /**
   * Met à jour un purchase en mode local
   */
  async updatePurchaseLocal(
    purchaseId: string,
    updates: Partial<Purchases>,
  ): Promise<void> {
    // 1. Trouver le produit qui contient ce purchase
    let targetProductId: string | null = null;
    for (const [productId, productModel] of this.#enrichedProducts) {
      if (productModel.data.purchases?.some((p) => p.$id === purchaseId)) {
        targetProductId = productId;
        break;
      }
    }

    if (!targetProductId) {
      // Vérifier si c'est un achat orphelin (dépense)
      if (this.#orphanPurchases.has(purchaseId)) {
        const existing = this.#orphanPurchases.get(purchaseId)!;
        const updated = {
          ...existing,
          ...updates,
          $updatedAt: new Date().toISOString(),
        };

        if (updated.status === "deleted") {
          this.#orphanPurchases.delete(purchaseId);
        } else {
          this.#orphanPurchases.set(purchaseId, updated);
        }
        return;
      }
      throw new Error(`Purchase ${purchaseId} introuvable`);
    }

    // 2. Mettre à jour le purchase dans la liste
    const productModel = this.#enrichedProducts.get(targetProductId);
    if (!productModel) return;
    const updatedPurchases = productModel.data.purchases.map((p) =>
      p.$id === purchaseId
        ? { ...p, ...updates, $updatedAt: new Date().toISOString() }
        : p,
    );

    // 3. Mettre à jour via la méthode générique
    await this.updateProductLocal(targetProductId, {
      purchases: updatedPurchases,
    });
  }

  /**
   * Supprime un purchase en mode local (pseudo-suppression)
   */
  async deletePurchaseLocal(purchaseId: string): Promise<void> {
    await this.updatePurchaseLocal(purchaseId, { status: "deleted" });
  }

  // =========================================================================
  // API PUBLIQUE (avec guards intégrés)
  // =========================================================================

  /**
   * Crée un purchase (avec détection automatique du mode)
   * Cette méthode route vers la version locale ou Appwrite
   */
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
    if (isDemoEvent(this.#currentEventId)) {
      return await this.createPurchaseLocal(productId, quantities, options);
    } else {
      // Mode normal : utiliser le service Appwrite
      const { createQuickValidationPurchases } =
        await import("../services/appwrite-products");
      await createQuickValidationPurchases(
        this.#currentMainId!,
        productId,
        quantities,
        options,
      );
    }
  }

  /**
   * Met à jour un purchase (avec détection automatique du mode)
   */
  async updatePurchase(
    purchaseId: string,
    updates: Partial<Purchases>,
  ): Promise<void> {
    if (isDemoEvent(this.#currentEventId)) {
      return await this.updatePurchaseLocal(purchaseId, updates);
    } else {
      const { updatePurchase } = await import("../services/appwrite-products");
      await updatePurchase(
        purchaseId,
        updates as Parameters<typeof updatePurchase>[1],
      );
    }
  }

  /**
   * Supprime un purchase (pseudo-suppression via status: 'deleted')
   */
  async deletePurchase(purchaseId: string): Promise<void> {
    if (isDemoEvent(this.#currentEventId)) {
      return await this.deletePurchaseLocal(purchaseId);
    } else {
      // Optimistic update : on applique localement immédiatement pour la réactivité
      try {
        await this.deletePurchaseLocal(purchaseId);
      } catch (err) {
        console.warn(
          "[ProductsStore] Optimistic delete failed or purchase not found locally:",
          err,
        );
      }

      // Pseudo-suppression : on met à jour le statut au lieu de supprimer physiquement
      const { updatePurchase } = await import("../services/appwrite-products");
      await updatePurchase(purchaseId, { status: "deleted" });
    }
  }

  /**
   * Crée un produit (avec détection automatique du mode)
   */
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
    if (isDemoEvent(this.#currentEventId)) {
      return await this.createProductLocal(productData);
    } else {
      // Mode normal : utiliser le service Appwrite
      const { upsertProduct } = await import("../services/appwrite-products");
      const newProduct = await upsertProduct(
        crypto.randomUUID(),
        productData,
        (id) => this.getEnrichedProductById(id),
      );
      return newProduct.$id;
    }
  }

  /**
   * Met à jour un produit (avec détection automatique du mode)
   * Version générique qui remplace updateProductFields, updateWho, updateStore, etc.
   *
   */
  async updateProduct(
    productId: string,
    updates: Partial<EnrichedProduct>,
  ): Promise<void> {
    if (isDemoEvent(this.#currentEventId)) {
      return await this.updateProductLocal(productId, updates);
    } else {
      const { updateProduct: updateProductAppwrite, upsertProduct } =
        await import("../services/appwrite-products");

      // Vérifier si le produit est synchronisé avec Appwrite
      const enrichedProduct = this.getEnrichedProductById(productId);
      if (enrichedProduct && !enrichedProduct.isSynced) {
        // Produit local uniquement : créer sur Appwrite via upsert
        await upsertProduct(productId, updates, (id: string) =>
          this.getEnrichedProductById(id),
        );
      } else {
        // Produit déjà synchronisé : update normal
        await updateProductAppwrite(productId, updates);
      }
    }
  }

  /**
   * Met à jour un produit en batch (avec détection automatique du mode)
   * En mode normal : utilise la cloud function optimisée
   * En mode local : boucle d'appels à updateProductLocal
   */
  async updateProductBatch(
    productId: string,
    updates: Partial<EnrichedProduct>,
    callback?: (id: string) => EnrichedProduct | undefined,
  ): Promise<void> {
    if (isDemoEvent(this.#currentEventId)) {
      // Mode local : boucle d'appels à #updateProductLocal
      for (const [key, value] of Object.entries(updates)) {
        await this.updateProductLocal(productId, { [key]: value });
      }
    } else {
      // Mode normal : appel batch Appwrite (cloud function optimisée)
      const { updateProductBatch } =
        await import("../services/appwrite-products");
      await updateProductBatch(
        productId,
        updates,
        callback || ((id) => this.getEnrichedProductById(id)),
      );
    }
  }

  // =========================================================================
  // MÉTHODES BATCH AVEC GUARDS
  // =========================================================================

  /**
   * Met à jour plusieurs produits en batch (avec détection automatique du mode)
   * Utilisé par WhoBatchEditModal et StoreBatchEditModal
   */
  async batchUpdateProducts(
    productIds: string[],
    products: EnrichedProduct[],
    updateType: "who" | "store",
    updateData: { names?: string[] } | StoreInfo,
  ): Promise<BatchUpdateResult> {
    if (isDemoEvent(this.#currentEventId)) {
      return await this.#batchUpdateProductsLocal(
        productIds,
        updateType,
        updateData,
      );
    } else {
      const { batchUpdateProductsOptimized } =
        await import("../services/appwrite-products");
      return await batchUpdateProductsOptimized(
        productIds,
        products,
        updateType,
        updateData,
      );
    }
  }

  /**
   * Met à jour plusieurs produits en mode local
   */
  async #batchUpdateProductsLocal(
    productIds: string[],
    updateType: "who" | "store",
    updateData: { names?: string[] } | StoreInfo,
  ): Promise<BatchUpdateResult> {
    try {
      let updatedCount = 0;

      for (const productId of productIds) {
        if (updateType === "who") {
          const whoList = (updateData as { names?: string[] }).names || [];
          await this.updateProductLocal(productId, { who: whoList });
        } else if (updateType === "store") {
          const storeInfo = updateData as StoreInfo;
          await this.updateProductLocal(productId, { storeInfo });
        }
        updatedCount++;
      }

      return {
        success: true,
        updatedCount,
        updateType,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        updatedCount: 0,
        updateType,
        error: error instanceof Error ? error.message : "Erreur inconnue",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Crée des achats groupés (avec détection automatique du mode)
   * Utilisé par GroupPurchaseModal
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
  ): Promise<GroupPurchaseBatchResult> {
    if (isDemoEvent(this.#currentEventId)) {
      return await this.#createGroupPurchaseLocal(productsData, invoiceData);
    } else {
      const { createGroupPurchaseWithSync } =
        await import("../services/appwrite-transaction");
      return await createGroupPurchaseWithSync(
        this.#currentMainId!,
        productsData,
        invoiceData,
      );
    }
  }

  /**
   * Crée des achats groupés en mode local
   */
  async #createGroupPurchaseLocal(
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
    try {
      if (!productsData?.length) {
        return {
          success: false,
          results: [],
          totalProductsCreated: 0,
          totalPurchasesCreated: 0,
          totalExpensesCreated: 0,
          error: "Aucun produit à traiter",
        };
      }

      let totalPurchasesCreated = 0;

      for (const productData of productsData) {
        await this.createPurchaseLocal(
          productData.productId,
          productData.missingQuantities,
          {
            invoiceId: invoiceData.invoiceId,
            notes: invoiceData.notes,
            store: invoiceData.store,
          },
        );
        totalPurchasesCreated++;
      }

      return {
        success: true,
        results: [],
        totalProductsCreated: productsData.length,
        totalPurchasesCreated,
        totalExpensesCreated: 0,
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        totalProductsCreated: 0,
        totalPurchasesCreated: 0,
        totalExpensesCreated: 0,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      };
    }
  }

  destroy() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;

    if (this.#idbCache) {
      this.#idbCache.close();
      this.#idbCache = null;
    }
    console.log("[ProductsStore] Ressources nettoyées");
  }
  // =========================================================================
  // GESTION DES DÉPENSES GLOBALES (ORPHELINES)
  // =========================================================================

  async #loadOrphanPurchases() {
    // 🔥 MODE LOCAL: Skip Appwrite
    if (isDemoEvent(this.#currentEventId)) {
      console.log("[ProductsStore] Mode local: skip loadOrphanPurchases");
      return;
    }

    // Mode normal (existing code)
    if (!this.#currentMainId) return;

    try {
      const orphans = await loadOrphanPurchases(this.#currentMainId);

      orphans.forEach((purchase) => {
        this.#orphanPurchases.set(purchase.$id, purchase);
      });

      console.log(
        `[ProductsStore] ${orphans.length} dépenses globales chargées`,
      );
    } catch (err) {
      console.error(
        "[ProductsStore] Erreur chargement dépenses globales:",
        err,
      );
    }
  }

  /**
   * Statistiques de complétion des produits (basé sur hasMissing)
   */
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

    return {
      completed,
      missing,
      total: completed + missing,
    };
  });

  /**
   * Statistiques financières globales
   */
  financialStats = $derived.by(() => {
    let totalGlobal = 0;
    const byStore: Record<string, number> = {};
    const byWho: Record<string, number> = {};
    const allPurchases: Purchases[] = [];

    // 1. Ajouter les dépenses orphelines
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

    // 2. Ajouter les achats liés aux produits
    for (const model of this.#enrichedProducts.values()) {
      const product = model.data;
      if (product.purchases && product.purchases.length > 0) {
        for (const purchase of product.purchases) {
          // Ignorer les achats annulés ou non livrés/commandés si nécessaire
          // Ici on prend tout ce qui a un prix
          if (purchase.price) {
            totalGlobal += purchase.price;

            const store = purchase.store || "Non défini";
            byStore[store] = (byStore[store] || 0) + purchase.price;

            const who = purchase.who || "Non défini";
            byWho[who] = (byWho[who] || 0) + purchase.price;

            // Enrichir l'achat avec le nom du produit pour l'affichage
            const purchaseWithProductName = {
              ...purchase,
              _productName: product.productName,
            };
            allPurchases.push(purchaseWithProductName);
          }
        }
      }
    }

    // Trier tous les achats par date (plus récent en premier)
    allPurchases.sort((a, b) => {
      const dateA = new Date(a.orderDate || a.$createdAt).getTime();
      const dateB = new Date(b.orderDate || b.$createdAt).getTime();
      return dateB - dateA;
    });

    return {
      totalGlobal,
      byStore,
      byWho,
      allPurchases,
    };
  });
}

// =============================================================================
// SINGLETON & EXPORTS
// =============================================================================

export const productsStore = new ProductsStore();
