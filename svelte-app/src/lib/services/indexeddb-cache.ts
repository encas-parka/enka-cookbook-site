/**
 * Service de cache IndexedDB pour ProductsStore
 *
 * Architecture:
 * - 1 base par mainId: `products-cache-${mainId}`
 * - 1 store "products" pour les EnrichedProduct
 * - 1 store "metadata" pour lastSync + allDates
 *
 * Avantages vs localStorage:
 * - Pas de limite 5-10MB
 * - Transactions atomiques
 * - Stockage natif des objets (pas de JSON.stringify)
 * - Gestion native des Date, Map, Set, undefined
 * - ⚠️ IMPORTANT: IndexedDB utilise l'algorithme "structured clone"
 *   qui ne supporte PAS les fonctions, symbols, ou prototypes personnalisés
 */

import type { EnrichedProduct } from "../types/store.types";

// =============================================================================
// TYPES
// =============================================================================

interface CacheMetadata {
  lastSync: string | null;
  allDates: string[];
  hugoContentHash?: string | null;
  migrationVersion: number;
}

export interface IDBCache {
  open(): Promise<void>;
  loadProducts(): Promise<Map<string, EnrichedProduct>>;
  loadMetadata(): Promise<CacheMetadata>;
  saveProducts(products: Map<string, EnrichedProduct>): Promise<void>;
  saveMetadata(metadata: CacheMetadata): Promise<void>;
  updateLastSync(lastSync: string | null): Promise<void>;
  updateAllDates(allDates: string[]): Promise<void>;
  updateHugoContentHash(hash: string | null): Promise<void>;
  updateLastHugoMenuUpdate(data: any): Promise<void>;
  upsertProduct(product: EnrichedProduct): Promise<void>;
  deleteProduct(productId: string): Promise<void>;
  clear(): Promise<void>;
  close(): void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

class IndexedDBCache implements IDBCache {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private version = 1;

  // Noms des object stores
  private readonly PRODUCTS_STORE = "products";
  private readonly METADATA_STORE = "metadata";
  // Clés pour les métadonnées séparées
  private readonly LAST_SYNC_KEY = "lastSync";
  private readonly ALL_DATES_KEY = "allDates";
  private readonly HUGO_HASH_KEY = "hugoContentHash";
  private readonly MIGRATION_VERSION_KEY = "migrationVersion";

  constructor(mainId: string) {
    this.dbName = `products-cache-${mainId}`;
  }

  /**
   * Ouvre/crée la base IndexedDB
   */
  async open(): Promise<void> {
    if (this.db) return; // Déjà ouverte

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log(`[IDBCache] Base ouverte: ${this.dbName}`);
        resolve();
      };

      // Création/upgrade du schéma
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store des produits (key = $id)
        if (!db.objectStoreNames.contains(this.PRODUCTS_STORE)) {
          const productsStore = db.createObjectStore(this.PRODUCTS_STORE, {
            keyPath: "$id",
          });
          console.log("[IDBCache] Object store 'products' créé");
        }

        // Store des métadonnées (avec keyPath pour objets {key, value})
        if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
          db.createObjectStore(this.METADATA_STORE, { keyPath: "key" });
          console.log("[IDBCache] Object store 'metadata' créé avec keyPath");
        }
      };
    });
  }

  /**
   * Charge tous les produits depuis IndexedDB
   */
  async loadProducts(): Promise<Map<string, EnrichedProduct>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.PRODUCTS_STORE, "readonly");
      const store = tx.objectStore(this.PRODUCTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const products = new Map<string, EnrichedProduct>();
        (request.result as EnrichedProduct[]).forEach((product) => {
          products.set(product.$id, product);
        });
        console.log(`[IDBCache] ${products.size} produits chargés`);
        resolve(products);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Charge les métadonnées (lastSync, allDates, hugoContentHash)
   */
  async loadMetadata(): Promise<CacheMetadata> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readonly");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const allEntries = request.result;

        // Reconstruire l'objet depuis les entrées {key, value}
        const metadata: CacheMetadata = {
          lastSync: null,
          allDates: [],
          hugoContentHash: null,
          migrationVersion: 0, // 0 = version par défaut pour les caches anciens
        };

        allEntries.forEach((entry) => {
          if (entry.key === this.LAST_SYNC_KEY) metadata.lastSync = entry.value;
          else if (entry.key === this.ALL_DATES_KEY)
            metadata.allDates = entry.value || [];
          else if (entry.key === this.HUGO_HASH_KEY)
            metadata.hugoContentHash = entry.value;
          else if (entry.key === this.MIGRATION_VERSION_KEY)
            metadata.migrationVersion = entry.value || 0;
        });

        console.log(
          `[IDBCache] Metadata chargées: lastSync=${metadata.lastSync}, dates=${metadata.allDates?.length || 0}, hash=${metadata.hugoContentHash}, migrationVersion=${metadata.migrationVersion}`,
        );
        resolve(metadata);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde tous les produits (bulk write)
   * 🎯 Utilisé lors de l'initialisation Hugo ou sync complet
   */
  async saveProducts(products: Map<string, EnrichedProduct>): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.PRODUCTS_STORE, "readwrite");
      const store = tx.objectStore(this.PRODUCTS_STORE);

      // Vider puis réécrire (stratégie simple)
      store.clear();

      products.forEach((product) => {
        store.put(product);
      });

      tx.oncomplete = () => {
        console.log(`[IDBCache] ${products.size} produits sauvegardés`);
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sauvegarde les métadonnées (legacy - pour compatibilité)
   */
  async saveMetadata(metadata: CacheMetadata): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);

      // Sauvegarder chaque métadonnée comme objet {key, value}
      store.put({ key: this.LAST_SYNC_KEY, value: metadata.lastSync });
      store.put({ key: this.ALL_DATES_KEY, value: metadata.allDates });
      if (metadata.hugoContentHash !== undefined) {
        store.put({ key: this.HUGO_HASH_KEY, value: metadata.hugoContentHash });
      }
      // Toujours sauvegarder la version de migration
      store.put({
        key: this.MIGRATION_VERSION_KEY,
        value: metadata.migrationVersion,
      });

      tx.oncomplete = () => {
        console.log(`[IDBCache] Metadata sauvegardées (objets {key, value})`);
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Met à jour uniquement lastSync (optimisé pour les syncs fréquents)
   * 🎯 Utilisé lors des synchronisations incrémentielles
   */
  async updateLastSync(lastSync: string | null): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.put({ key: this.LAST_SYNC_KEY, value: lastSync });

      request.onsuccess = () => {
        console.log(`[IDBCache] lastSync mis à jour: ${lastSync}`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Met à jour uniquement allDates (optimisé pour l'initialisation)
   * 🎯 Utilisé lors du premier chargement depuis Hugo
   */
  async updateAllDates(allDates: string[]): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.put({ key: this.ALL_DATES_KEY, value: allDates });

      request.onsuccess = () => {
        console.log(`[IDBCache] allDates mis à jour: ${allDates.length} dates`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Met à jour uniquement hugoContentHash (optimisé pour le suivi de contenu)
   * 🎯 Utilisé lors du chargement depuis Hugo
   */
  async updateHugoContentHash(hash: string | null): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.put({ key: this.HUGO_HASH_KEY, value: hash });

      request.onsuccess = () => {
        console.log(`[IDBCache] hugoContentHash mis à jour: ${hash}`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Met à jour uniquement migrationVersion (optimisé pour les migrations)
   * 🎯 Utilisé lors des migrations de données pour marquer les caches comme à jour
   */
  async updateMigrationVersion(version: number): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.put({
        key: this.MIGRATION_VERSION_KEY,
        value: version,
      });

      request.onsuccess = () => {
        console.log(`[IDBCache] migrationVersion mis à jour: ${version}`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Met à jour le rapport de la dernière mise à jour Hugo
   */
  async updateLastHugoMenuUpdate(data: any): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.put({ key: "lastHugoMenuUpdate", value: data });

      request.onsuccess = () => {
        console.log(`[IDBCache] lastHugoMenuUpdate sauvegardé`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Upsert un produit individuel
   * 🎯 Utilisé lors des updates realtime
   */
  async upsertProduct(product: EnrichedProduct): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.PRODUCTS_STORE, "readwrite");
      const store = tx.objectStore(this.PRODUCTS_STORE);
      const request = store.put(product);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime un produit
   * 🎯 Utilisé lors des suppressions realtime
   */
  async deleteProduct(productId: string): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.PRODUCTS_STORE, "readwrite");
      const store = tx.objectStore(this.PRODUCTS_STORE);
      const request = store.delete(productId);

      request.onsuccess = () => resolve();
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
        [this.PRODUCTS_STORE, this.METADATA_STORE],
        "readwrite",
      );

      tx.objectStore(this.PRODUCTS_STORE).clear();
      tx.objectStore(this.METADATA_STORE).clear();

      tx.oncomplete = () => {
        console.log("[IDBCache] Cache vidé");
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
      console.log("[IDBCache] Connexion fermée");
    }
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

/**
 * Crée et ouvre une instance de cache IndexedDB
 */
export async function createIDBCache(mainId: string): Promise<IDBCache> {
  const cache = new IndexedDBCache(mainId);
  await cache.open();
  return cache;
}

/**
 * Supprime complètement une base IndexedDB
 * ⚠️ À utiliser avec précaution (clearCache, forceReload)
 */
export async function deleteIDBCache(mainId: string): Promise<void> {
  const dbName = `products-cache-${mainId}`;

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      console.log(`[IDBCache] Base supprimée: ${dbName}`);
      resolve();
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(`[IDBCache] Suppression bloquée: ${dbName}`);
    };
  });
}
