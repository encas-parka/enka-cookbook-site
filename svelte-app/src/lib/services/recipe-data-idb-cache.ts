/**
 * Service de cache IndexedDB pour RecipeDataStore
 *
 * Gère les données statiques unifiées :
 * - Ingrédients (800 items, ~50ko)
 * - Recipe Info (materiel, categories, regimes)
 *
 * Schema :
 * - DB: `recipe-data-cache`
 * - Store "ingredients": Ingredient[] (keyPath: "u")
 * - Store "recipe-info": RecipeInfo (single entry, key: "data")
 * - Store "metadata": lastSync, dataJsonHash, ingredientsCount
 */

import type {
  Ingredient,
  RecipeInfo,
  RecipeDataCacheMetadata,
} from "../types/recipes.types";

// =============================================================================
// TYPES
// =============================================================================

export interface RecipeDataIDBCache {
  open(): Promise<void>;
  loadAll(): Promise<{
    ingredients: Map<string, Ingredient>;
    recipeInfo: RecipeInfo;
  }>;
  loadMetadata(): Promise<RecipeDataCacheMetadata>;
  saveAll(data: {
    ingredients: Map<string, Ingredient>;
    recipeInfo: RecipeInfo;
  }): Promise<void>;
  saveMetadata(metadata: RecipeDataCacheMetadata): Promise<void>;
  updateDataJsonHash(hash: string | null): Promise<void>;
  upsertIngredient(ingredient: Ingredient): Promise<void>;
  deleteIngredient(uuid: string): Promise<void>;
  clear(): Promise<void>;
  close(): void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

class RecipeDataIndexedDBCache implements RecipeDataIDBCache {
  private dbName = "recipe-data-cache";
  private db: IDBDatabase | null = null;
  private version = 1;

  // Object stores
  private readonly INGREDIENTS_STORE = "ingredients";
  private readonly RECIPE_INFO_STORE = "recipe-info";
  private readonly METADATA_STORE = "metadata";

  // Metadata keys
  private readonly LAST_SYNC_KEY = "lastSync";
  private readonly DATA_JSON_HASH_KEY = "dataJsonHash";
  private readonly INGREDIENTS_COUNT_KEY = "ingredientsCount";
  private readonly RECIPE_INFO_KEY = "data";

  /**
   * Ouvre/crée la base IndexedDB
   */
  async open(): Promise<void> {
    if (this.db) return;

    // Fonction pour tenter d'ouvrir la base
    const tryOpen = (): Promise<IDBDatabase> => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Store ingrédients
          if (!db.objectStoreNames.contains(this.INGREDIENTS_STORE)) {
            db.createObjectStore(this.INGREDIENTS_STORE, { keyPath: "u" });
            console.log("[RecipeDataIDBCache] Store 'ingredients' créé");
          }

          // Store recipe-info
          if (!db.objectStoreNames.contains(this.RECIPE_INFO_STORE)) {
            db.createObjectStore(this.RECIPE_INFO_STORE);
            console.log("[RecipeDataIDBCache] Store 'recipe-info' créé");
          }

          // Store metadata
          if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
            db.createObjectStore(this.METADATA_STORE, { keyPath: "key" });
            console.log("[RecipeDataIDBCache] Store 'metadata' créé");
          }
        };
      });
    };

    // Tenter d'ouvrir la base
    let db = await tryOpen();

    // Vérifier que les object stores nécessaires existent
    const hasIngredientsStore = db.objectStoreNames.contains(
      this.INGREDIENTS_STORE,
    );
    const hasRecipeInfoStore = db.objectStoreNames.contains(
      this.RECIPE_INFO_STORE,
    );
    const hasMetadataStore = db.objectStoreNames.contains(this.METADATA_STORE);

    if (!hasIngredientsStore || !hasRecipeInfoStore || !hasMetadataStore) {
      // La base est corrompue (existe mais sans les stores nécessaires)
      console.warn(
        `[RecipeDataIDBCache] Base corrompue détectée (ingredients=${hasIngredientsStore}, recipe-info=${hasRecipeInfoStore}, metadata=${hasMetadataStore}), suppression et recréation...`,
      );

      // Fermer la connexion actuelle
      db.close();

      // Supprimer la base corrompue
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn("[RecipeDataIDBCache] Suppression bloquée, réessai...");
        };
      });

      // Recréer la base
      db = await tryOpen();
    }

    this.db = db;
    console.log(`[RecipeDataIDBCache] Base ouverte: ${this.dbName}`);
  }

  /**
   * Charge toutes les données
   */
  async loadAll(): Promise<{
    ingredients: Map<string, Ingredient>;
    recipeInfo: RecipeInfo;
  }> {
    if (!this.db) throw new Error("DB non ouverte");

    const [ingredients, recipeInfo] = await Promise.all([
      this.#loadIngredients(),
      this.#loadRecipeInfo(),
    ]);

    return { ingredients, recipeInfo };
  }

  /**
   * Charge les ingrédients
   */
  async #loadIngredients(): Promise<Map<string, Ingredient>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.INGREDIENTS_STORE, "readonly");
      const store = tx.objectStore(this.INGREDIENTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const ingredients = new Map<string, Ingredient>();
        (request.result as Ingredient[]).forEach((ing) => {
          ingredients.set(ing.u, ing);
        });
        console.log(
          `[RecipeDataIDBCache] ${ingredients.size} ingrédients chargés`,
        );
        resolve(ingredients);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Charge recipe-info
   */
  async #loadRecipeInfo(): Promise<RecipeInfo> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPE_INFO_STORE, "readonly");
      const store = tx.objectStore(this.RECIPE_INFO_STORE);
      const request = store.get(this.RECIPE_INFO_KEY);

      request.onsuccess = () => {
        const data = request.result || {
          materiel: [],
          categories: [],
          regimes: [],
        };
        console.log(
          `[RecipeDataIDBCache] recipe-info chargé: ${data.categories?.length || 0} catégories`,
        );
        resolve(data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Charge les métadonnées
   */
  async loadMetadata(): Promise<RecipeDataCacheMetadata> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readonly");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const metadata: RecipeDataCacheMetadata = {
          lastSync: null,
          dataJsonHash: null,
          ingredientsCount: 0,
        };

        request.result.forEach((entry) => {
          if (entry.key === this.LAST_SYNC_KEY) metadata.lastSync = entry.value;
          else if (entry.key === this.DATA_JSON_HASH_KEY)
            metadata.dataJsonHash = entry.value;
          else if (entry.key === this.INGREDIENTS_COUNT_KEY)
            metadata.ingredientsCount = entry.value;
        });

        console.log(
          `[RecipeDataIDBCache] Metadata: count=${metadata.ingredientsCount}, hash=${metadata.dataJsonHash?.slice(0, 8)}...`,
        );
        resolve(metadata);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde toutes les données (bulk write)
   */
  async saveAll(data: {
    ingredients: Map<string, Ingredient>;
    recipeInfo: RecipeInfo;
  }): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        [this.INGREDIENTS_STORE, this.RECIPE_INFO_STORE],
        "readwrite",
      );

      // 1. Sauvegarder ingrédients
      const ingredientsStore = tx.objectStore(this.INGREDIENTS_STORE);
      ingredientsStore.clear();
      data.ingredients.forEach((ing) => {
        ingredientsStore.put(ing);
      });

      // 2. Sauvegarder recipe-info
      const recipeInfoStore = tx.objectStore(this.RECIPE_INFO_STORE);
      recipeInfoStore.put(data.recipeInfo, this.RECIPE_INFO_KEY);

      tx.oncomplete = () => {
        console.log(
          `[RecipeDataIDBCache] ✓ ${data.ingredients.size} ingrédients + recipe-info sauvegardés`,
        );
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sauvegarde les métadonnées
   */
  async saveMetadata(metadata: RecipeDataCacheMetadata): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);

      store.put({ key: this.LAST_SYNC_KEY, value: metadata.lastSync });
      store.put({
        key: this.DATA_JSON_HASH_KEY,
        value: metadata.dataJsonHash,
      });
      store.put({
        key: this.INGREDIENTS_COUNT_KEY,
        value: metadata.ingredientsCount,
      });

      tx.oncomplete = () => {
        console.log("[RecipeDataIDBCache] ✓ Metadata sauvegardées");
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Met à jour uniquement le hash
   */
  async updateDataJsonHash(hash: string | null): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.put({
        key: this.DATA_JSON_HASH_KEY,
        value: hash,
      });

      request.onsuccess = () => {
        console.log(
          `[RecipeDataIDBCache] Hash mis à jour: ${hash?.slice(0, 8) || "null"}`,
        );
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Upsert un ingrédient
   */
  async upsertIngredient(ingredient: Ingredient): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.INGREDIENTS_STORE, "readwrite");
      const store = tx.objectStore(this.INGREDIENTS_STORE);
      const request = store.put(ingredient);

      request.onsuccess = () => {
        console.log(`[RecipeDataIDBCache] Ingrédient upsert: ${ingredient.n}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime un ingrédient
   */
  async deleteIngredient(uuid: string): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.INGREDIENTS_STORE, "readwrite");
      const store = tx.objectStore(this.INGREDIENTS_STORE);
      const request = store.delete(uuid);

      request.onsuccess = () => {
        console.log(`[RecipeDataIDBCache] Ingrédient supprimé: ${uuid}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Vide complètement le cache
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        [this.INGREDIENTS_STORE, this.RECIPE_INFO_STORE, this.METADATA_STORE],
        "readwrite",
      );

      tx.objectStore(this.INGREDIENTS_STORE).clear();
      tx.objectStore(this.RECIPE_INFO_STORE).clear();
      tx.objectStore(this.METADATA_STORE).clear();

      tx.oncomplete = () => {
        console.log("[RecipeDataIDBCache] Cache vidé");
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Ferme la connexion
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("[RecipeDataIDBCache] Connexion fermée");
    }
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

export async function createRecipeDataIDBCache(): Promise<RecipeDataIDBCache> {
  const cache = new RecipeDataIndexedDBCache();
  await cache.open();
  return cache;
}

export async function deleteRecipeDataIDBCache(): Promise<void> {
  const dbName = "recipe-data-cache";

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      console.log(`[RecipeDataIDBCache] Base supprimée: ${dbName}`);
      resolve();
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(`[RecipeDataIDBCache] Suppression bloquée: ${dbName}`);
    };
  });
}
