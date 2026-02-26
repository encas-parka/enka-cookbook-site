/**
 * RecipeDataStore - Store unifié pour les données statiques de recettes
 *
 * Gère 3 sources de données JSON statiques :
 * 1. /static/data/ingredients.json (~50ko, 800 items)
 * 2. /static/data/recipe-info.json (materiel, categories, regimes)
 * 3. Cache IndexedDB pour performance
 *
 * Architecture :
 * - Chargement IDB → Fetch JSON → Compare hash → Update si nécessaire
 * - Ajout d'ingrédients via fonction cloud Appwrite → Commit GitHub → Invalidation cache
 * - Modification recipe-info via fonction cloud
 *
 * Data Flow (ajout ingrédient) :
 * CMS → Appwrite Function → GitHub (Octokit) → Webhook → Rebuild → Client recharge
 *
 * @usage
 * await recipeDataStore.initialize();
 * const ingredient = recipeDataStore.getIngredientByUuid('xo0ibs');
 * const categories = recipeDataStore.categories;
 * await recipeDataStore.addIngredient({ name: 'Tomate', type: 'legumes' });
 */

import { SvelteMap } from "svelte/reactivity";
import type {
  Ingredient,
  RecipeInfo,
  RecipeDataCacheMetadata,
} from "../types/recipes.types";
import {
  createRecipeDataIDBCache,
  type RecipeDataIDBCache,
} from "../services/recipe-data-idb-cache";
import { serializeRecipeInfo } from "$lib/utils/serialization.utils";
import { getAppwriteInstances } from "$lib/services/appwrite";

// =============================================================================
// CONFIGURATION
// =============================================================================

const INGREDIENTS_JSON_URL = "/data/ingredients.json";
const RECIPE_INFO_JSON_URL = "/data/recipe-info.json";

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

  // Cache IndexedDB
  #cache: RecipeDataIDBCache | null = null;

  // Propriétés dérivées
  #ingredientNames = $derived.by(() =>
    Array.from(this.#ingredients.values())
      .map((ing) => ing.n)
      .sort(),
  );

  // Getters publics
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

  // =============================================================================
  // INITIALISATION
  // =============================================================================

  /**
   * Initialise le store
   * 1. Ouvre IndexedDB
   * 2. Charge depuis cache si disponible
   * 3. Fetch JSON et compare hash
   * 4. Met à jour si nécessaire
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
      // 1. Ouvrir IndexedDB
      this.#cache = await createRecipeDataIDBCache();

      // 2. Charger depuis cache
      const cachedData = await this.#cache.loadAll();
      const cachedMetadata = await this.#cache.loadMetadata();

      if (cachedData.ingredients.size > 0) {
        console.log(
          `[RecipeDataStore] Cache: ${cachedData.ingredients.size} ingrédients`,
        );
        this.#ingredients = new SvelteMap(cachedData.ingredients);
        this.#recipeInfo = cachedData.recipeInfo;
        this.#lastSync = cachedMetadata.lastSync;
      }

      // 3. Charger depuis JSON et vérifier hash
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
   * Charge depuis JSON statiques et compare les hash
   */
  async #loadFromJSON(): Promise<void> {
    try {
      console.log("[RecipeDataStore] Fetch JSON...");

      // Fetch parallèle
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
      const cachedMetadata = await this.#cache!.loadMetadata();
      if (cachedMetadata.dataJsonHash === contentHash) {
        console.log("[RecipeDataStore] JSON inchangés, cache valide");
        return;
      }

      console.log("[RecipeDataStore] Mise à jour depuis JSON...");

      // Trier les ingrédients par nom alphabétique (français) avant de créer le Map
      const sortedIngredients = (ingredientsData as Ingredient[]).sort((a, b) =>
        a.n.localeCompare(b.n, "fr"),
      );

      // Mettre à jour ingrédients
      const ingredientsMap = new Map<string, Ingredient>();
      sortedIngredients.forEach((ing) => {
        ingredientsMap.set(ing.u, ing);
      });

      this.#ingredients = new SvelteMap(ingredientsMap);
      this.#recipeInfo = recipeInfoData as RecipeInfo;
      this.#lastSync = new Date().toISOString();

      // Sauvegarder dans IndexedDB
      if (this.#cache) {
        await this.#cache.saveAll({
          ingredients: ingredientsMap,
          recipeInfo: serializeRecipeInfo(this.#recipeInfo),
        });
        await this.#cache.saveMetadata({
          lastSync: this.#lastSync,
          dataJsonHash: contentHash,
          ingredientsCount: ingredientsMap.size,
        });
      }

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

  // =============================================================================
  // API PUBLIQUE - INGRÉDIENTS
  // =============================================================================

  getIngredientByUuid(uuid: string): Ingredient | null {
    return this.#ingredients.get(uuid) || null;
  }

  searchIngredients(query: string): Ingredient[] {
    if (!query.trim()) return this.ingredients;
    const lowerQuery = query.toLowerCase();
    return this.ingredients.filter((ing) =>
      ing.n.toLowerCase().includes(lowerQuery),
    );
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
   * Ajoute un ingrédient via fonction cloud Appwrite
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

      // Récupérer les instances Appwrite
      const { functions } = await getAppwriteInstances();

      // Appeler la fonction cloud Appwrite
      const response = await functions.createExecution({
        functionId: "68f00487000c624533a3", // enkaData function ID
        body: JSON.stringify({
          action: "add_ingredient",
          data: {
            name: data.name,
            type: data.type,
            allergens: data.allergens,
            pF: data.pF,
            pS: data.pS,
            saisons: data.saisons,
          },
        }),
        async: false,
      });

      // Parser la réponse
      const result = JSON.parse(response.responseBody);

      if (!result.success) {
        throw new Error(
          result.error || "Erreur lors de la création de l'ingrédient",
        );
      }

      const newIngredient = result.ingredient as Ingredient;

      // Mise à jour locale optimiste
      this.#ingredients.set(newIngredient.u, newIngredient);

      // Sauvegarder dans IDB
      if (this.#cache) {
        await this.#cache.upsertIngredient(newIngredient);
      }

      // Invalider le hash pour forcer le reload au prochain refresh
      if (this.#cache) {
        await this.#cache.updateDataJsonHash(null);
      }

      console.log(
        `[RecipeDataStore] ✓ Ingrédient ajouté: ${newIngredient.n} (${newIngredient.u})`,
      );

      return newIngredient;
    } catch (err) {
      console.error("[RecipeDataStore] Erreur ajout ingrédient:", err);
      throw err;
    }
  }

  // =============================================================================
  // API PUBLIQUE - RECIPE INFO
  // =============================================================================

  /**
   * Ajoute une catégorie
   */
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

  /**
   * Ajoute du matériel
   */
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

  /**
   * Ajoute un régime
   */
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
   * Met à jour recipe-info.json via fonction cloud
   */
  async #updateRecipeInfo(newInfo: RecipeInfo): Promise<void> {
    try {
      console.log("[RecipeDataStore] Mise à jour recipe-info...");

      // Récupérer les instances Appwrite
      const { functions } = await getAppwriteInstances();

      const response = await functions.createExecution({
        functionId: "68f00487000c624533a3", // enkaData function ID
        body: JSON.stringify({
          action: "update_recipe_info",
          data: newInfo,
        }),
        async: false,
      });

      // Parser la réponse
      const result = JSON.parse(response.responseBody);

      if (!result.success) {
        throw new Error(
          result.error || "Erreur lors de la mise à jour du recipe-info",
        );
      }

      // Mise à jour locale optimiste
      this.#recipeInfo = newInfo;

      // Sauvegarder dans IDB
      if (this.#cache) {
        await this.#cache.saveAll({
          ingredients: new Map(this.#ingredients),
          recipeInfo: serializeRecipeInfo(newInfo),
        });
        // Invalider le hash
        await this.#cache.updateDataJsonHash(null);
      }

      console.log("[RecipeDataStore] ✓ recipe-info mis à jour");
    } catch (err) {
      console.error("[RecipeDataStore] Erreur MAJ recipe-info:", err);
      throw err;
    }
  }

  // =============================================================================
  // UTILITAIRES
  // =============================================================================

  async forceReload(): Promise<void> {
    console.log("[RecipeDataStore] Rechargement forcé...");
    this.#loading = true;
    this.#error = null;

    try {
      if (this.#cache) {
        await this.#cache.updateDataJsonHash(null);
      }
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
    if (this.#cache) {
      await this.#cache.clear();
      console.log("[RecipeDataStore] Cache vidé");
    }
    this.#ingredients.clear();
    this.#recipeInfo = { materiel: [], categories: [], regimes: [] };
    this.#lastSync = null;
    this.#isInitialized = false;
  }

  destroy(): void {
    if (this.#cache) {
      this.#cache.close();
      this.#cache = null;
    }
    this.#ingredients.clear();
    this.#isInitialized = false;
    console.log("[RecipeDataStore] Ressources nettoyées");
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const recipeDataStore = new RecipeDataStore();
