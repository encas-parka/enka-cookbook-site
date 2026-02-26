/**
 * Service de cache IndexedDB pour RecipesStore
 *
 * Architecture:
 * - 1 base: `recipes-cache`
 * - 1 store "recipes-index" pour les RecipeIndexEntry (index léger)
 * - 1 store "recipes-details" pour les Recettes (détails complets)
 * - 1 store "metadata" pour buildTimestamp + lastAppwriteSync
 *
 * Stratégie:
 * - L'index est chargé au démarrage (léger)
 * - Les détails sont lazy-loadés à la demande
 * - Cache persistant pour éviter les fetches répétés
 */

import type { Recettes } from "../types/appwrite";
import type {
  RecipeIndexEntry,
  RecipeForDisplay,
  RecipesCacheMetadata,
} from "../types/recipes.types";

// =============================================================================
// TYPES
// =============================================================================

export interface RecipesIDBCache {
  open(): Promise<void>;

  // Index
  loadRecipesIndex(): Promise<Map<string, RecipeIndexEntry>>;
  saveRecipesIndex(recipes: Map<string, RecipeIndexEntry>): Promise<void>;

  // Détails
  loadRecipeDetail(uuid: string): Promise<RecipeForDisplay | null>;
  saveRecipeDetail(recipe: RecipeForDisplay): Promise<void>;
  loadAllRecipeDetails(): Promise<Map<string, RecipeForDisplay>>;

  // Méthodes bulk (OPTIMISATION)
  loadRecipeDetailsBulk(
    uuids: string[],
  ): Promise<Map<string, RecipeForDisplay>>;
  saveRecipeDetailsBulk(recipes: Map<string, RecipeForDisplay>): Promise<void>;

  loadMetadata(): Promise<RecipesCacheMetadata>;
  saveMetadata(metadata: RecipesCacheMetadata): Promise<void>;

  // Utilitaires
  deleteRecipeDetail(uuid: string): Promise<void>;
  deleteRecipeFromIndex(uuid: string): Promise<void>;
  clear(): Promise<void>;
  close(): void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

class RecipesIndexedDBCache implements RecipesIDBCache {
  private dbName = "recipes-cache";
  private db: IDBDatabase | null = null;
  private version = 5; // Incrément de version pour suppression de lastSync

  // Noms des object stores
  private readonly RECIPES_INDEX_STORE = "recipes-index";
  private readonly RECIPES_DETAILS_STORE = "recipes-details";
  private readonly METADATA_STORE = "metadata";

  // Clés pour les métadonnées
  private readonly BUILD_TIMESTAMP_KEY = "buildTimestamp";
  private readonly LAST_APPWRITE_SYNC_KEY = "lastAppwriteSync";
  private readonly RECIPES_COUNT_KEY = "recipesCount";

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

          // Store de l'index (key = $id)
          if (!db.objectStoreNames.contains(this.RECIPES_INDEX_STORE)) {
            db.createObjectStore(this.RECIPES_INDEX_STORE, {
              keyPath: "$id",
            });
            console.log("[RecipesIDBCache] Object store 'recipes-index' créé");
          }

          // Store des détails (key = $id)
          if (!db.objectStoreNames.contains(this.RECIPES_DETAILS_STORE)) {
            db.createObjectStore(this.RECIPES_DETAILS_STORE, {
              keyPath: "$id",
            });
            console.log(
              "[RecipesIDBCache] Object store 'recipes-details' créé",
            );
          }

          // Store des métadonnées
          if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
            db.createObjectStore(this.METADATA_STORE, { keyPath: "key" });
            console.log("[RecipesIDBCache] Object store 'metadata' créé");
          }
        };
      });
    };

    // Tenter d'ouvrir la base
    let db = await tryOpen();

    // Vérifier que les object stores nécessaires existent
    const hasIndexStore = db.objectStoreNames.contains(
      this.RECIPES_INDEX_STORE,
    );
    const hasDetailsStore = db.objectStoreNames.contains(
      this.RECIPES_DETAILS_STORE,
    );
    const hasMetadataStore = db.objectStoreNames.contains(this.METADATA_STORE);

    if (!hasIndexStore || !hasDetailsStore || !hasMetadataStore) {
      // La base est corrompue (existe mais sans les stores nécessaires)
      console.warn(
        `[RecipesIDBCache] Base corrompue détectée (index=${hasIndexStore}, details=${hasDetailsStore}, metadata=${hasMetadataStore}), suppression et recréation...`,
      );

      // Fermer la connexion actuelle
      db.close();

      // Supprimer la base corrompue
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn("[RecipesIDBCache] Suppression bloquée, réessai...");
        };
      });

      // Recréer la base
      db = await tryOpen();
    }

    this.db = db;
    console.log(`[RecipesIDBCache] Base ouverte: ${this.dbName}`);
  }

  // =============================================================================
  // INDEX
  // =============================================================================

  /**
   * Charge l'index complet des recettes
   */
  async loadRecipesIndex(): Promise<Map<string, RecipeIndexEntry>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPES_INDEX_STORE, "readonly");
      const store = tx.objectStore(this.RECIPES_INDEX_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const recipes = new Map<string, RecipeIndexEntry>();
        (request.result as RecipeIndexEntry[]).forEach((recipe) => {
          recipes.set(recipe.$id, recipe);
        });
        console.log(
          `[RecipesIDBCache] ${recipes.size} recettes (index) chargées`,
        );
        resolve(recipes);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde l'index complet (bulk write)
   */
  async saveRecipesIndex(
    recipes: Map<string, RecipeIndexEntry>,
  ): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPES_INDEX_STORE, "readwrite");
      const store = tx.objectStore(this.RECIPES_INDEX_STORE);

      store.clear();

      recipes.forEach((recipe) => {
        store.put(recipe);
      });

      tx.oncomplete = () => {
        console.log(
          `[RecipesIDBCache] ${recipes.size} recettes (index) sauvegardées`,
        );
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  // =============================================================================
  // DÉTAILS
  // =============================================================================

  /**
   * Charge les détails d'une recette spécifique
   */
  async loadRecipeDetail(uuid: string): Promise<RecipeForDisplay | null> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPES_DETAILS_STORE, "readonly");
      const store = tx.objectStore(this.RECIPES_DETAILS_STORE);
      const request = store.get(uuid);

      request.onsuccess = () => {
        const recipe = request.result as RecipeForDisplay | undefined;
        if (recipe) {
          console.log(
            `[RecipesIDBCache] Détails de ${uuid} chargés depuis le cache`,
          );
        }
        resolve(recipe || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde les détails d'une recette
   */
  async saveRecipeDetail(recipe: RecipeForDisplay): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPES_DETAILS_STORE, "readwrite");
      const store = tx.objectStore(this.RECIPES_DETAILS_STORE);
      const request = store.put(recipe);

      request.onsuccess = () => {
        console.log(`[RecipesIDBCache] Détails de ${recipe.$id} sauvegardés`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Charge tous les détails de recettes (pour debug/export)
   */
  async loadAllRecipeDetails(): Promise<Map<string, RecipeForDisplay>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPES_DETAILS_STORE, "readonly");
      const store = tx.objectStore(this.RECIPES_DETAILS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const recipes = new Map<string, RecipeForDisplay>();
        (request.result as RecipeForDisplay[]).forEach((recipe) => {
          recipes.set(recipe.$id, recipe);
        });
        console.log(
          `[RecipesIDBCache] ${recipes.size} détails de recettes chargés`,
        );
        resolve(recipes);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Charge les détails de plusieurs recettes en une seule transaction (OPTIMISATION BULK)
   * @param uuids - Liste des UUIDs de recettes à charger
   * @returns Map des recettes trouvées (UUID → RecipeForDisplay)
   */
  async loadRecipeDetailsBulk(
    uuids: string[],
  ): Promise<Map<string, RecipeForDisplay>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPES_DETAILS_STORE, "readonly");
      const store = tx.objectStore(this.RECIPES_DETAILS_STORE);
      const results = new Map<string, RecipeForDisplay>();

      // Compteur pour suivre les requêtes terminées
      let completed = 0;
      const total = uuids.length;

      // Créer toutes les requêtes dans la même transaction
      for (const uuid of uuids) {
        const request = store.get(uuid);

        request.onsuccess = () => {
          const recipe = request.result as RecipeForDisplay | undefined;
          if (recipe) {
            results.set(uuid, recipe);
          }
          completed++;

          // Résoudre quand toutes les requêtes sont terminées
          if (completed === total) {
            console.log(
              `[RecipesIDBCache] ${results.size}/${total} recettes chargées en bulk`,
            );
            resolve(results);
          }
        };

        request.onerror = () => {
          console.warn(
            `[RecipesIDBCache] Erreur chargement ${uuid} en bulk:`,
            request.error,
          );
          completed++;

          // Continuer même en cas d'erreur partielle
          if (completed === total) {
            console.log(
              `[RecipesIDBCache] ${results.size}/${total} recettes chargées en bulk (avec erreurs)`,
            );
            resolve(results);
          }
        };
      }

      // Gérer le cas où la liste est vide
      if (total === 0) {
        console.log(`[RecipesIDBCache] 0 recettes à charger en bulk`);
        resolve(results);
      }
    });
  }

  /**
   * Sauvegarde les détails de plusieurs recettes en une seule transaction (OPTIMISATION BULK)
   * @param recipes - Map des recettes à sauvegarder (UUID → RecipeForDisplay)
   */
  async saveRecipeDetailsBulk(
    recipes: Map<string, RecipeForDisplay>,
  ): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPES_DETAILS_STORE, "readwrite");
      const store = tx.objectStore(this.RECIPES_DETAILS_STORE);

      // Compteur pour suivre les opérations terminées
      let completed = 0;
      const total = recipes.size;

      // Créer toutes les opérations dans la même transaction
      recipes.forEach((recipe) => {
        const request = store.put(recipe);

        request.onsuccess = () => {
          completed++;

          // Résoudre quand toutes les opérations sont terminées
          if (completed === total) {
            console.log(
              `[RecipesIDBCache] ${total} recettes sauvegardées en bulk`,
            );
            resolve();
          }
        };

        request.onerror = () => {
          console.error(
            `[RecipesIDBCache] Erreur sauvegarde ${recipe.$id} en bulk:`,
            request.error,
          );
          // Rejeter en cas d'erreur
          reject(request.error);
        };
      });

      // Gérer le cas où la map est vide
      if (total === 0) {
        console.log(`[RecipesIDBCache] 0 recettes à sauvegarder en bulk`);
        resolve();
      }

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Supprime les détails d'une recette
   */
  async deleteRecipeDetail(uuid: string): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.RECIPES_DETAILS_STORE, "readwrite");
      const store = tx.objectStore(this.RECIPES_DETAILS_STORE);
      const request = store.delete(uuid);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime complètement une recette (index + détails)
   * Utilisé lors de la suppression (soft delete) d'une recette
   */
  async deleteRecipeFromIndex(uuid: string): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        [this.RECIPES_INDEX_STORE, this.RECIPES_DETAILS_STORE],
        "readwrite",
      );

      const indexStore = tx.objectStore(this.RECIPES_INDEX_STORE);
      const detailsStore = tx.objectStore(this.RECIPES_DETAILS_STORE);

      indexStore.delete(uuid);
      detailsStore.delete(uuid);

      tx.oncomplete = () => {
        console.log(
          `[RecipesIDBCache] Recette ${uuid} supprimée de l'index et des détails`,
        );
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  // =============================================================================
  // METADATA
  // =============================================================================

  /**
   * Charge les métadonnées
   */
  async loadMetadata(): Promise<RecipesCacheMetadata> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readonly");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const allEntries = request.result;

        const metadata: RecipesCacheMetadata = {
          buildTimestamp: null,
          lastAppwriteSync: null,
          recipesCount: 0,
          cacheVersion: 1,
        };

        allEntries.forEach((entry) => {
          if (entry.key === this.RECIPES_COUNT_KEY)
            metadata.recipesCount = entry.value;
          else if (entry.key === this.BUILD_TIMESTAMP_KEY)
            metadata.buildTimestamp = entry.value;
          else if (entry.key === this.LAST_APPWRITE_SYNC_KEY)
            metadata.lastAppwriteSync = entry.value;
        });

        console.log(
          `[RecipesIDBCache] Metadata chargées: count=${metadata.recipesCount}, build=${metadata.buildTimestamp}, sync=${metadata.lastAppwriteSync}`,
        );
        resolve(metadata);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde les métadonnées
   */
  async saveMetadata(metadata: RecipesCacheMetadata): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);

      store.put({
        key: this.BUILD_TIMESTAMP_KEY,
        value: metadata.buildTimestamp,
      });
      store.put({
        key: this.LAST_APPWRITE_SYNC_KEY,
        value: metadata.lastAppwriteSync,
      });
      store.put({ key: this.RECIPES_COUNT_KEY, value: metadata.recipesCount });

      tx.oncomplete = () => {
        console.log(`[RecipesIDBCache] Metadata sauvegardées`);
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }
  // =============================================================================
  // UTILITAIRES
  // =============================================================================

  /**
   * Vide complètement le cache
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        [
          this.RECIPES_INDEX_STORE,
          this.RECIPES_DETAILS_STORE,
          this.METADATA_STORE,
        ],
        "readwrite",
      );

      tx.objectStore(this.RECIPES_INDEX_STORE).clear();
      tx.objectStore(this.RECIPES_DETAILS_STORE).clear();
      tx.objectStore(this.METADATA_STORE).clear();

      tx.oncomplete = () => {
        console.log("[RecipesIDBCache] Cache vidé");
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
      console.log("[RecipesIDBCache] Connexion fermée");
    }
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

/**
 * Crée et ouvre une instance de cache IndexedDB pour les recettes
 */
export async function createRecipesIDBCache(): Promise<RecipesIDBCache> {
  const cache = new RecipesIndexedDBCache();
  await cache.open();
  return cache;
}

/**
 * Supprime complètement la base IndexedDB des recettes
 */
export async function deleteRecipesIDBCache(): Promise<void> {
  const dbName = "recipes-cache";

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      console.log(`[RecipesIDBCache] Base supprimée: ${dbName}`);
      resolve();
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(`[RecipesIDBCache] Suppression bloquée: ${dbName}`);
    };
  });
}
