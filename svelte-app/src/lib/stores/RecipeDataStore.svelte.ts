/**
 * RecipeDataStore — Données de référence des recettes (pb-sync + constantes)
 *
 * Architecture :
 * ┌─────────────────────────────────────────────────────────┐
 * │  PocketBase  (ingredients, categories)                  │
 * │    ↕ initialFetch (delta sync) + subscribe (SSE)        │
 * │  Dexie        (ingredients, categories)                 │
 * │    ↕ liveQuery → bridgeToMap                             │
 * │  SvelteMap    (IngredientsDoc, CategoriesDoc)           │
 * │    ↕ $derived.by (conversion + filtrage)                │
 * │  API publique (Ingredient[], string[])                  │
 * └─────────────────────────────────────────────────────────┘
 *
 * Matériel et régimes : constantes TS + ajouts utilisateur dans db.catalog.
 * Voir src/lib/data/recipe-reference.ts.
 *
 * @usage
 * await recipeDataStore.initialize();
 * const ingredient = recipeDataStore.getIngredientByRef('xo0ibs');
 * const categories = recipeDataStore.categories;
 */

import fuzzysort from "fuzzysort";
import type {
  Ingredient,
  FuzzyIngredientResult,
} from "../types/recipes.types";
import { toAppIngredient } from "../types/recipes.types";
import type { IngredientsDoc, CategoriesDoc } from "../types/recipes.types";
import type { IngredientsRecord, CategoriesRecord } from "../types/pb-generated";
import {
  createSyncCollection,
  bridgeToMap,
  db,
  pb,
} from "$lib/db-sync/pb-sync";
import { DEFAULT_MATERIEL, DEFAULT_REGIMES, mergeWithCustom } from "$lib/data/recipe-reference";
import { nanoid } from "nanoid";

// =============================================================================
// CATALOG KEYS (db.catalog — persistance des ajouts utilisateur)
// =============================================================================

const KEY_CUSTOM_MATERIEL = "custom-materiel";
const KEY_CUSTOM_REGIMES = "custom-regimes";

// =============================================================================
// STORE
// =============================================================================

class RecipeDataStore {
  // ===========================================================================
  // PB-SYNC COLLECTIONS
  // ===========================================================================

  /** Sync collection : PocketBase ingredients ↔ Dexie ingredients */
  #ingredientsCollection = createSyncCollection<IngredientsDoc>(
    pb,
    db.ingredients,
    "ingredients",
  );

  /** Sync collection : PocketBase categories ↔ Dexie categories */
  #categoriesCollection = createSyncCollection<CategoriesDoc>(
    pb,
    db.categories,
    "categories",
  );

  // ===========================================================================
  // BRIDGES (liveQuery Dexie → SvelteMap réactif)
  // ===========================================================================

  /** Bridge réactif ingredients (key = PB id) */
  #ingredientsBridge = bridgeToMap<IngredientsDoc>(() =>
    db.ingredients.toArray(),
  );

  /** Bridge réactif categories (key = PB id) */
  #categoriesBridge = bridgeToMap<CategoriesDoc>(() =>
    db.categories.toArray(),
  );

  // ===========================================================================
  // ÉTAT RÉACTIF
  // ===========================================================================

  #loading = $state(false);
  #error = $state<string | null>(null);
  #lastSync = $state<string | null>(null);
  #isInitialized = $state(false);
  #initPromise: Promise<void> | null = null;

  /** Ajouts utilisateur (matériel), persistés dans db.catalog */
  #customMateriel = $state<string[]>([]);

  /** Ajouts utilisateur (régimes), persistés dans db.catalog */
  #customRegimes = $state<string[]>([]);

  // ===========================================================================
  // VUES DÉRIVÉES
  // ===========================================================================

  /**
   * Map des ingrédients keyée par ref (PB `ref` field).
   *
   * Conversion IngredientsRecord (PB) → Ingredient (app).
   * Après renormalisation, les noms de champs correspondent directement.
   *
   * Utilise un Map natif (pas SvelteMap) car la reconstruction complète est
   * peu fréquente (845 items, rarement modifiés).
   */
  #ingredientsMap = $derived.by<Map<string, Ingredient>>(() => {
    const map = new Map<string, Ingredient>();
    for (const record of this.#ingredientsBridge.map.values()) {
      const ingredient = toAppIngredient(record);
      map.set(ingredient.ref, ingredient);
    }
    return map;
  });

  /**
   * Liste triée des ingrédients (pour affichage UI).
   */
  #ingredientsList = $derived.by<Ingredient[]>(() => {
    return Array.from(this.#ingredientsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "fr"),
    );
  });

  /**
   * Noms des ingrédients (pour autocomplete / suggestions).
   */
  #ingredientNames = $derived.by<string[]>(() =>
    this.#ingredientsList.map((ing) => ing.name),
  );

  /**
   * Catégories de recettes (depuis PB categories où type="category").
   */
  #categoriesList = $derived.by<string[]>(() => {
    const names = new Set<string>();
    for (const record of this.#categoriesBridge.map.values()) {
      if (record.type === "category") {
        names.add(record.name);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "fr"));
  });

  /**
   * Matériel de référence (constantes + ajouts utilisateur).
   */
  #materielList = $derived.by<string[]>(() =>
    mergeWithCustom(DEFAULT_MATERIEL, this.#customMateriel),
  );

  /**
   * Régimes (constantes + ajouts utilisateur).
   */
  #regimesList = $derived.by<string[]>(() =>
    mergeWithCustom(DEFAULT_REGIMES, this.#customRegimes),
  );

  // ===========================================================================
  // GETTERS PUBLICS
  // ===========================================================================

  get loading() {
    return this.#loading;
  }
  get error() {
    return this.#error;
  }
  get lastSync() {
    return this.#lastSync;
  }
  get isInitialized() {
    return this.#isInitialized;
  }

  /** Tous les ingrédients, triés par nom */
  get ingredients(): Ingredient[] {
    return this.#ingredientsList;
  }

  /** Nombre d'ingrédients */
  get count(): number {
    return this.#ingredientsMap.size;
  }

  /** Noms de tous les ingrédients (triés) */
  get ingredientNames(): string[] {
    return this.#ingredientNames;
  }

  /** Catégories de recettes (triées) */
  get categories(): string[] {
    return this.#categoriesList;
  }

  /** Équipements de cuisine (constantes + ajouts) */
  get materiel(): string[] {
    return this.#materielList;
  }

  /** Régimes alimentaires (constantes + ajouts) */
  get regimes(): string[] {
    return this.#regimesList;
  }

  // ===========================================================================
  // INITIALISATION (3 PHASES)
  // ===========================================================================

  async initialize(): Promise<void> {
    if (this.#isInitialized) {
      console.log("[RecipeDataStore] Déjà initialisé");
      return;
    }

    if (this.#initPromise) {
      console.log("[RecipeDataStore] Initialisation déjà en cours, attente...");
      return this.#initPromise;
    }

    console.log("[RecipeDataStore] Initialisation...");
    this.#initPromise = (async () => {
      this.#loading = true;
      this.#error = null;

      try {
        // Phase 1 : charger les ajouts utilisateur depuis db.catalog
        await this.#loadCustomAdditions();

        // Phase 2 : delta sync PocketBase → Dexie
        await this.syncFromRemote();

        // Phase 3 : abonnement SSE temps réel
        await this.setupRealtime();

        this.#isInitialized = true;
        console.log(
          `[RecipeDataStore] ✓ ${this.#ingredientsMap.size} ingrédients, ${this.#categoriesList.length} catégories`,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur initialisation";
        this.#error = message;
        console.error("[RecipeDataStore]", message, err);
        throw err;
      } finally {
        this.#loading = false;
      }
    })();

    return this.#initPromise;
  }

  /**
   * Charge les ajouts utilisateur depuis db.catalog (Dexie).
   */
  async #loadCustomAdditions(): Promise<void> {
    try {
      const [materielRow, regimesRow] = await db.catalog.bulkGet([
        KEY_CUSTOM_MATERIEL,
        KEY_CUSTOM_REGIMES,
      ]);

      if (materielRow?.data) {
        this.#customMateriel = materielRow.data as string[];
      }
      if (regimesRow?.data) {
        this.#customRegimes = regimesRow.data as string[];
      }

      console.log(
        `[RecipeDataStore] Cache local: ${this.#customMateriel.length} matériels, ${this.#customRegimes.length} régimes`,
      );
    } catch (err) {
      console.warn(
        "[RecipeDataStore] Erreur chargement cache local:",
        err,
      );
    }
  }

  /**
   * Delta sync PocketBase → Dexie (ingredients + categories).
   */
  async syncFromRemote(): Promise<void> {
    try {
      await Promise.all([
        this.#ingredientsCollection.initialFetch(),
        this.#categoriesCollection.initialFetch(),
      ]);
      this.#lastSync = new Date().toISOString();
      console.log(
        `[RecipeDataStore] Sync terminé: ${this.#ingredientsMap.size} ingrédients`,
      );
    } catch (err) {
      console.error("[RecipeDataStore] Erreur sync:", err);
      throw err;
    }
  }

  /**
   * Abonnement SSE PocketBase temps réel.
   */
  async setupRealtime(): Promise<void> {
    try {
      this.#ingredientsCollection.subscribe();
      this.#categoriesCollection.subscribe();
      console.log("[RecipeDataStore] ✓ Realtime configuré");
    } catch (err) {
      console.error(
        "[RecipeDataStore] Erreur configuration realtime:",
        err,
      );
      throw err;
    }
  }

  // ===========================================================================
  // API PUBLIQUE — INGRÉDIENTS
  // ===========================================================================

  /**
   * Récupère un ingrédient par sa ref.
   */
  getIngredientByRef(ref: string): Ingredient | null {
    return this.#ingredientsMap.get(ref) || null;
  }

  /**
   * Recherche textuelle d'ingrédients par nom.
   */
  searchIngredients(query: string): Ingredient[] {
    if (!query.trim()) return this.#ingredientsList;
    const results = fuzzysort.go(query, this.#ingredientsList, {
      key: "name",
      threshold: 0.3,
      limit: 50,
    });
    return results.map((r) => r.obj);
  }

  /**
   * Recherche fuzzy avec scores et highlight — pour les composants UI
   * qui nécessitent d'afficher la pertinence et les caractères matchés.
   */
  searchIngredientsFuzzy(
    query: string,
    threshold = 0.3,
    limit = 50,
  ): FuzzyIngredientResult[] {
    if (!query.trim()) return [];
    const results = fuzzysort.go(query, this.#ingredientsList, {
      key: "name",
      threshold,
      limit,
    });
    return results.map((r) => ({
      ingredient: r.obj,
      score: r.score,
      highlighted: r.highlight("<mark>", "</mark>"),
    }));
  }

  /**
   * Trouve les ingrédients similaires à un nom donné — utilisé comme
   * guard anti-doublon dans la modal de création.
   * Seuil plus permissif (0.5) pour capter les variantes proches.
   */
  findSimilarIngredients(name: string, limit = 5): FuzzyIngredientResult[] {
    if (!name.trim() || name.trim().length < 2) return [];
    const results = fuzzysort.go(name, this.#ingredientsList, {
      key: "name",
      threshold: 0.5,
      limit,
    });
    return results.map((r) => ({
      ingredient: r.obj,
      score: r.score,
      highlighted: r.highlight("<mark>", "</mark>"),
    }));
  }

  /**
   * Filtre les ingrédients par type.
   */
  getIngredientsByType(type: string): Ingredient[] {
    return this.#ingredientsList.filter((ing) => ing.type === type);
  }

  /**
   * Types d'ingrédients disponibles.
   */
  get availableTypes(): string[] {
    const types = new Set<string>();
    for (const ing of this.#ingredientsList) {
      types.add(ing.type);
    }
    return Array.from(types).sort();
  }

  /**
   * Ingrédients contenant un allergène donné.
   */
  getIngredientsByAllergen(allergen: string): Ingredient[] {
    return this.#ingredientsList.filter((ing) => ing.allergens?.includes(allergen));
  }

  /**
   * Allergènes disponibles.
   */
  get availableAllergens(): string[] {
    const allergens = new Set<string>();
    for (const ing of this.#ingredientsList) {
      ing.allergens?.forEach((a) => allergens.add(a));
    }
    return Array.from(allergens).sort();
  }

  /**
   * Ajoute un ingrédient via PocketBase.
   * Utilise les vrais noms de champs PB (ref, name, type, allergens…).
   */
  async addIngredient(data: {
    name: string;
    type: string;
    allergens: string[];
    pF: boolean;
    pS: boolean;
    saisons?: string[];
  }): Promise<Ingredient> {
    if (!this.#isInitialized) {
      throw new Error("Store non initialisé");
    }

    try {
      console.log("[RecipeDataStore] Ajout ingrédient:", data.name);

      // Ref court (7 chars, ~3.5T combinaisons) — cohérent avec les refs Hugo legacy
      const ref = nanoid(7);

      // Création via pb-sync (écrit PB + Dexie, bridge réactif propage)
      // PB auto-génère l'id, on fournit le ref métier
      const record = await this.#ingredientsCollection.create({
        ref,
        name: data.name,
        type: data.type as IngredientsRecord["type"],
        allergens: data.allergens,
        pF: data.pF,
        pS: data.pS,
        ...(data.saisons ? { saisons: data.saisons } : {}),
      } as Omit<IngredientsRecord, "created" | "updated">);

      const newIngredient = toAppIngredient(record);

      console.log(
        `[RecipeDataStore] ✓ Ingrédient ajouté: ${newIngredient.name} (${newIngredient.ref})`,
      );

      return newIngredient;
    } catch (err) {
      console.error("[RecipeDataStore] Erreur ajout ingrédient:", err);
      throw err;
    }
  }

  // ===========================================================================
  // API PUBLIQUE — CATÉGORIES
  // ===========================================================================

  /**
   * Ajoute une catégorie dans PocketBase (categories, type="category").
   * Le SSE la réplique → Dexie → bridge → vue dérivée.
   */
  async addCategory(name: string): Promise<void> {
    if (this.#categoriesList.includes(name)) {
      console.warn(`[RecipeDataStore] Catégorie déjà existante: ${name}`);
      return;
    }

    try {
      await this.#categoriesCollection.create({
        name,
        type: "category",
      } as Omit<CategoriesRecord, "created" | "updated">);

      console.log(`[RecipeDataStore] ✓ Catégorie ajoutée: ${name}`);
    } catch (err) {
      console.error("[RecipeDataStore] Erreur ajout catégorie:", err);
      throw err;
    }
  }

  // ===========================================================================
  // API PUBLIQUE — MATÉRIEL
  // ===========================================================================

  /**
   * Ajoute un matériel localement (db.catalog).
   * Les matériels sont des constantes TS + ajouts utilisateur persistés.
   */
  async addMateriel(name: string): Promise<void> {
    if (this.#materielList.includes(name)) {
      console.warn(`[RecipeDataStore] Matériel déjà existant: ${name}`);
      return;
    }

    try {
      this.#customMateriel = [...this.#customMateriel, name].sort((a, b) =>
        a.localeCompare(b, "fr"),
      );
      await db.catalog.put({
        key: KEY_CUSTOM_MATERIEL,
        data: this.#customMateriel,
      });
      console.log(`[RecipeDataStore] ✓ Matériel ajouté: ${name}`);
    } catch (err) {
      console.error("[RecipeDataStore] Erreur ajout matériel:", err);
      throw err;
    }
  }

  // ===========================================================================
  // API PUBLIQUE — RÉGIMES
  // ===========================================================================

  /**
   * Ajoute un régime localement (db.catalog).
   * Les régimes sont des constantes TS + ajouts utilisateur persistés.
   */
  async addRegime(name: string): Promise<void> {
    if (this.#regimesList.includes(name)) {
      console.warn(`[RecipeDataStore] Régime déjà existant: ${name}`);
      return;
    }

    try {
      this.#customRegimes = [...this.#customRegimes, name].sort((a, b) =>
        a.localeCompare(b, "fr"),
      );
      await db.catalog.put({
        key: KEY_CUSTOM_REGIMES,
        data: this.#customRegimes,
      });
      console.log(`[RecipeDataStore] ✓ Régime ajouté: ${name}`);
    } catch (err) {
      console.error("[RecipeDataStore] Erreur ajout régime:", err);
      throw err;
    }
  }

  // ===========================================================================
  // NETTOYAGE
  // ===========================================================================

  /**
   * Vide le cache local.
   */
  async clearCache(): Promise<void> {
    await this.#ingredientsCollection.clearLocal();
    await this.#categoriesCollection.clearLocal();
    await db.catalog.where("key").startsWith("custom-").delete();
    this.#customMateriel = [];
    this.#customRegimes = [];
    this.#lastSync = null;
    this.#isInitialized = false;
    console.log("[RecipeDataStore] Cache vidé");
  }

  /**
   * Nettoie toutes les ressources (bridge, SSE, Dexie).
   */
  destroy(): void {
    this.#ingredientsBridge.subscription.unsubscribe();
    this.#categoriesBridge.subscription.unsubscribe();
    this.#ingredientsCollection.unsubscribeAll();
    this.#categoriesCollection.unsubscribeAll();
    this.#isInitialized = false;
    this.#initPromise = null;
    console.log("[RecipeDataStore] Ressources nettoyées");
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const recipeDataStore = new RecipeDataStore();
