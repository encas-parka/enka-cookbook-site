/**
 * RecipeDataStore - Store unifié pour les données statiques de recettes
 *
 * Gère 2 sources de données JSON statiques Hugo :
 * 1. /data/ingredients.json (~50ko, 800 items)
 * 2. /data/recipe-info.json (materiel, categories, regimes)
 *
 * Architecture :
 * - Persistence via Dexie db.catalog (key-value)
 * - Chargement cache → Fetch JSON → Compare hash → Update si nécessaire
 * - Ajout d'ingrédients via fonction cloud Appwrite → Commit GitHub → Webhook → Rebuild
 *
 * @usage
 * await recipeDataStore.initialize();
 * const ingredient = recipeDataStore.getIngredientByUuid('xo0ibs');
 * const categories = recipeDataStore.categories;
 */

import { SvelteMap } from "svelte/reactivity";
import fuzzysort from "fuzzysort";
import type {
  Ingredient,
  RecipeInfo,
} from "../types/recipes.types";
import { serializeRecipeInfo } from "$lib/utils/serialization.utils";
import { pb, db } from "$lib/db-sync/pb-sync";

// =============================================================================
// CONFIGURATION
// =============================================================================

const INGREDIENTS_JSON_URL = "/data/ingredients.json";
const RECIPE_INFO_JSON_URL = "/data/recipe-info.json";

// Catalog keys in db.catalog
const KEY_INGREDIENTS = "ingredients";
const KEY_RECIPE_INFO = "recipe-info";
const KEY_METADATA = "catalog-metadata";

// =============================================================================
// TYPES
// =============================================================================

interface CatalogMetadata {
  lastSync: string | null;
  dataJsonHash: string | null;
  ingredientsCount: number;
}

// =============================================================================
// TYPES EXPORTÉS
// =============================================================================

/** Résultat de recherche fuzzy avec score et highlight */
export interface FuzzyIngredientResult {
  ingredient: Ingredient;
  score: number;
  highlighted: string;
}

// =============================================================================
// STORE SINGLETON
// =============================================================================

class RecipeDataStore {
  // État réactif
  #ingredients = new SvelteMap<string, Ingredient>();
  #recipeInfo = $state<RecipeInfo>({
    materiel: [],
    categories: [],
    regimes: [],
  });
  #loading = $state(false);
  #error = $state<string | null>(null);
  #lastSync = $state<string | null>(null);
  #isInitialized = $state(false);

  // Propriétés dérivées
  #ingredientNames = $derived.by(() =>
    Array.from(this.#ingredients.values())
      .map((ing) => ing.n)
      .sort(),
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
  get ingredients() {
    return Array.from(this.#ingredients.values()).sort((a, b) =>
      a.n.localeCompare(b.n, "fr"),
    );
  }
  get count() {
    return this.#ingredients.size;
  }
  get ingredientNames() {
    return this.#ingredientNames;
  }

  // Recipe Info getters
  get materiel() {
    return this.#recipeInfo.materiel;
  }
  get categories() {
    return this.#recipeInfo.categories;
  }
  get regimes() {
    return this.#recipeInfo.regimes;
  }

  // ===========================================================================
  // INITIALISATION
  // ===========================================================================

  /**
   * Initialise le store
   * 1. Charge depuis db.catalog si disponible
   * 2. Fetch JSON et compare hash
   * 3. Met à jour si nécessaire
   */
  async initialize(): Promise<void> {
    if (this.#isInitialized) {
      console.log("[RecipeDataStore] Déjà initialisé");
      return;
    }

    console.log("[RecipeDataStore] Initialisation...");
    this.#loading = true;
    this.#error = null;

    try {
      // 1. Charger depuis le cache Dexie
      await this.#loadFromCatalog();

      // 2. Charger depuis JSON et vérifier hash
      await this.#loadFromJSON();

      this.#isInitialized = true;
      console.log(
        `[RecipeDataStore] ✓ ${this.#ingredients.size} ingrédients, ${this.#recipeInfo.categories.length} catégories`,
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
  }

  /**
   * Charge les données depuis db.catalog (Dexie)
   */
  async #loadFromCatalog(): Promise<void> {
    const [ingredientsRow, recipeInfoRow, metadataRow] = await db.catalog.bulkGet([
      KEY_INGREDIENTS,
      KEY_RECIPE_INFO,
      KEY_METADATA,
    ]);

    const ingredientsMap = ingredientsRow?.data as Map<string, Ingredient> | undefined;
    const recipeInfo = recipeInfoRow?.data as RecipeInfo | undefined;
    const metadata = metadataRow?.data as CatalogMetadata | undefined;

    if (ingredientsMap && ingredientsMap.size > 0) {
      this.#ingredients = new SvelteMap(ingredientsMap);
      console.log(
        `[RecipeDataStore] Cache: ${ingredientsMap.size} ingrédients`,
      );
    }

    if (recipeInfo) {
      this.#recipeInfo = recipeInfo;
    }

    if (metadata) {
      this.#lastSync = metadata.lastSync;
    }
  }

  /**
   * Charge depuis JSON statiques et compare les hash
   */
  async #loadFromJSON(): Promise<void> {
    try {
      console.log("[RecipeDataStore] Fetch JSON...");

      const [ingredientsRes, recipeInfoRes] = await Promise.all([
        fetch(INGREDIENTS_JSON_URL),
        fetch(RECIPE_INFO_JSON_URL),
      ]);

      if (!ingredientsRes.ok || !recipeInfoRes.ok) {
        throw new Error("Erreur HTTP lors du chargement des JSON");
      }

      const [ingredientsData, recipeInfoData] = await Promise.all([
        ingredientsRes.json(),
        recipeInfoRes.json(),
      ]);

      // Calculer hash du contenu
      const contentHash = await this.#calculateHash(
        JSON.stringify(ingredientsData) + JSON.stringify(recipeInfoData),
      );

      // Vérifier si changement
      const metadataRow = await db.catalog.get(KEY_METADATA);
      const metadata = metadataRow?.data as CatalogMetadata | undefined;

      if (metadata?.dataJsonHash === contentHash) {
        console.log("[RecipeDataStore] JSON inchangés, cache valide");
        return;
      }

      console.log("[RecipeDataStore] Mise à jour depuis JSON...");

      // Trier les ingrédients par nom alphabétique
      const sortedIngredients = (ingredientsData as Ingredient[]).sort((a, b) =>
        a.n.localeCompare(b.n, "fr"),
      );

      const ingredientsMap = new Map<string, Ingredient>();
      sortedIngredients.forEach((ing) => {
        ingredientsMap.set(ing.u, ing);
      });

      this.#ingredients = new SvelteMap(ingredientsMap);
      this.#recipeInfo = recipeInfoData as RecipeInfo;
      this.#lastSync = new Date().toISOString();

      // Sauvegarder dans db.catalog
      await db.catalog.bulkPut([
        { key: KEY_INGREDIENTS, data: ingredientsMap },
        { key: KEY_RECIPE_INFO, data: serializeRecipeInfo(this.#recipeInfo) },
        {
          key: KEY_METADATA,
          data: {
            lastSync: this.#lastSync,
            dataJsonHash: contentHash,
            ingredientsCount: ingredientsMap.size,
          } satisfies CatalogMetadata,
        },
      ]);

      console.log(
        `[RecipeDataStore] ✓ Cache mis à jour (hash: ${contentHash.slice(0, 8)}...)`,
      );
    } catch (err) {
      console.error("[RecipeDataStore] Erreur chargement JSON:", err);
      throw err;
    }
  }

  /**
   * Calcule SHA-256 hash
   */
  async #calculateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ===========================================================================
  // API PUBLIQUE - INGRÉDIENTS
  // ===========================================================================

  getIngredientByUuid(uuid: string): Ingredient | null {
    return this.#ingredients.get(uuid) || null;
  }

  searchIngredients(query: string): Ingredient[] {
    if (!query.trim()) return this.ingredients;
    const results = fuzzysort.go(query, this.ingredients, {
      key: "n",
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
    const results = fuzzysort.go(query, this.ingredients, {
      key: "n",
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
    const results = fuzzysort.go(name, this.ingredients, {
      key: "n",
      threshold: 0.5,
      limit,
    });
    return results.map((r) => ({
      ingredient: r.obj,
      score: r.score,
      highlighted: r.highlight("<mark>", "</mark>"),
    }));
  }

  getIngredientsByType(type: string): Ingredient[] {
    return this.ingredients.filter((ing) => ing.t === type);
  }

  get availableTypes(): string[] {
    const types = new Set<string>();
    this.ingredients.forEach((ing) => types.add(ing.t));
    return Array.from(types).sort();
  }

  getIngredientsByAllergen(allergen: string): Ingredient[] {
    return this.ingredients.filter((ing) => ing.a?.includes(allergen));
  }

  get availableAllergens(): string[] {
    const allergens = new Set<string>();
    this.ingredients.forEach((ing) => {
      ing.a?.forEach((a) => allergens.add(a));
    });
    return Array.from(allergens).sort();
  }

  /**
   * Ajoute un ingrédient via PocketBase
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

      const newIngredient: Ingredient = {
        u: crypto.randomUUID(),
        n: data.name,
        t: data.type,
        a: data.allergens,
        pF: data.pF,
        pS: data.pS,
        ...(data.saisons ? { s: data.saisons } : {}),
      };

      // Créer dans PocketBase
      await (pb.collection as any)("ingredients").create({
        id: newIngredient.u,
        ...newIngredient,
      });

      // Mise à jour locale optimiste
      this.#ingredients.set(newIngredient.u, newIngredient);

      // Sauvegarder dans db.catalog
      await db.catalog.put({ key: KEY_INGREDIENTS, data: new Map(this.#ingredients) });

      // Invalider le hash pour forcer le reload au prochain refresh
      await db.catalog.put({
        key: KEY_METADATA,
        data: {
          lastSync: this.#lastSync,
          dataJsonHash: null,
          ingredientsCount: this.#ingredients.size,
        } satisfies CatalogMetadata,
      });

      console.log(
        `[RecipeDataStore] ✓ Ingrédient ajouté: ${newIngredient.n} (${newIngredient.u})`,
      );

      return newIngredient;
    } catch (err) {
      console.error("[RecipeDataStore] Erreur ajout ingrédient:", err);
      throw err;
    }
  }

  // ===========================================================================
  // API PUBLIQUE - RECIPE INFO
  // ===========================================================================

  async addCategory(category: string): Promise<void> {
    if (this.#recipeInfo.categories.includes(category)) {
      console.warn(`[RecipeDataStore] Catégorie déjà existante: ${category}`);
      return;
    }

    await this.#updateRecipeInfo({
      ...this.#recipeInfo,
      categories: [...this.#recipeInfo.categories, category].sort(),
    });
  }

  async addMateriel(materiel: string): Promise<void> {
    if (this.#recipeInfo.materiel.includes(materiel)) {
      console.warn(`[RecipeDataStore] Matériel déjà existant: ${materiel}`);
      return;
    }

    await this.#updateRecipeInfo({
      ...this.#recipeInfo,
      materiel: [...this.#recipeInfo.materiel, materiel].sort(),
    });
  }

  async addRegime(regime: string): Promise<void> {
    if (this.#recipeInfo.regimes.includes(regime)) {
      console.warn(`[RecipeDataStore] Régime déjà existant: ${regime}`);
      return;
    }

    await this.#updateRecipeInfo({
      ...this.#recipeInfo,
      regimes: [...this.#recipeInfo.regimes, regime].sort(),
    });
  }

  /**
   * Met à jour recipe-info localement (Dexie)
   * TODO: Remplacer par pb.collection('catalog') quand la collection PB existe
   */
  async #updateRecipeInfo(newInfo: RecipeInfo): Promise<void> {
    console.log("[RecipeDataStore] Mise à jour recipe-info...");

    // Mise à jour locale
    this.#recipeInfo = newInfo;

    // Sauvegarder dans db.catalog
    await db.catalog.bulkPut([
      { key: KEY_RECIPE_INFO, data: serializeRecipeInfo(newInfo) },
      {
        key: KEY_METADATA,
        data: {
          lastSync: this.#lastSync,
          dataJsonHash: null,
          ingredientsCount: this.#ingredients.size,
        } satisfies CatalogMetadata,
      },
    ]);

    console.log("[RecipeDataStore] ✓ recipe-info mis à jour");
  }

  // ===========================================================================
  // UTILITAIRES
  // ===========================================================================

  async forceReload(): Promise<void> {
    console.log("[RecipeDataStore] Rechargement forcé...");
    this.#loading = true;
    this.#error = null;

    try {
      await db.catalog.put({
        key: KEY_METADATA,
        data: { lastSync: this.#lastSync, dataJsonHash: null, ingredientsCount: 0 } satisfies CatalogMetadata,
      });
      await this.#loadFromJSON();
      console.log("[RecipeDataStore] ✓ Rechargement complété");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur rechargement";
      this.#error = message;
      console.error("[RecipeDataStore]", message, err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async clearCache(): Promise<void> {
    await db.catalog.clear();
    this.#ingredients.clear();
    this.#recipeInfo = { materiel: [], categories: [], regimes: [] };
    this.#lastSync = null;
    this.#isInitialized = false;
    console.log("[RecipeDataStore] Cache vidé");
  }

  destroy(): void {
    this.#ingredients.clear();
    this.#isInitialized = false;
    console.log("[RecipeDataStore] Ressources nettoyées");
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const recipeDataStore = new RecipeDataStore();
