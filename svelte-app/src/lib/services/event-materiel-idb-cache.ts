/**
 * Service de cache IndexedDB pour EventMaterielStore
 *
 * Architecture:
 * - 1 base: `event-materiel-cache`
 * - 1 store "items" pour les EventMateriel (keyPath: $id)
 * - 1 store "metadata" pour lastSync
 *
 * Pattern identique à events-idb-cache.ts
 */

import type { EventMateriel } from "$lib/types/appwrite";

// =============================================================================
// TYPES
// =============================================================================

export interface EventMaterielCacheMetadata {
  lastSync: string | null;
}

export interface EventMaterielIDBCache {
  open(): Promise<void>;

  // Items
  loadItems(eventId: string): Promise<Map<string, EventMateriel>>;
  saveItems(items: EventMateriel[]): Promise<void>;
  saveItem(item: EventMateriel): Promise<void>;
  deleteItem(itemId: string): Promise<void>;

  // Metadata
  loadMetadata(eventId: string): Promise<EventMaterielCacheMetadata>;
  saveMetadata(
    eventId: string,
    metadata: EventMaterielCacheMetadata,
  ): Promise<void>;

  // Utilitaires
  clear(): Promise<void>;
  close(): void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

class EventMaterielIndexedDBCache implements EventMaterielIDBCache {
  private dbName = "event-materiel-cache";
  private db: IDBDatabase | null = null;
  private version = 1;

  private readonly ITEMS_STORE = "items";
  private readonly METADATA_STORE = "metadata";

  /**
   * Ouvre/crée la base IndexedDB
   */
  async open(): Promise<void> {
    if (this.db) return;

    const tryOpen = (): Promise<IDBDatabase> => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(this.ITEMS_STORE)) {
            db.createObjectStore(this.ITEMS_STORE, { keyPath: "$id" });
          }

          if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
            db.createObjectStore(this.METADATA_STORE, { keyPath: "key" });
          }
        };
      });
    };

    let db = await tryOpen();

    // Vérifier l'intégrité des stores
    const hasItems = db.objectStoreNames.contains(this.ITEMS_STORE);
    const hasMetadata = db.objectStoreNames.contains(this.METADATA_STORE);

    if (!hasItems || !hasMetadata) {
      console.warn(
        `[EventMaterielIDBCache] Base incomplète détectée, suppression et recréation...`,
      );
      db.close();

      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn("[EventMaterielIDBCache] Suppression bloquée...");
        };
      });

      db = await tryOpen();
    }

    this.db = db;
    console.log(`[EventMaterielIDBCache] Base ouverte: ${this.dbName}`);
  }

  // =============================================================================
  // ITEMS
  // =============================================================================

  /**
   * Charge les items pour un événement spécifique
   */
  async loadItems(eventId: string): Promise<Map<string, EventMateriel>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.ITEMS_STORE, "readonly");
      const store = tx.objectStore(this.ITEMS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = new Map<string, EventMateriel>();
        (request.result as EventMateriel[])
          .filter((item) => item.eventId === eventId)
          .forEach((item) => {
            items.set(item.$id, item);
          });
        console.log(
          `[EventMaterielIDBCache] ${items.size} items chargés pour event ${eventId}`,
        );
        resolve(items);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde un ensemble d'items (bulk write)
   */
  async saveItems(items: EventMateriel[]): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.ITEMS_STORE, "readwrite");
      const store = tx.objectStore(this.ITEMS_STORE);

      for (const item of items) {
        store.put(item);
      }

      tx.oncomplete = () => {
        console.log(
          `[EventMaterielIDBCache] ${items.length} items sauvegardés`,
        );
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sauvegarde un item individuel (upsert)
   */
  async saveItem(item: EventMateriel): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.ITEMS_STORE, "readwrite");
      const store = tx.objectStore(this.ITEMS_STORE);
      const request = store.put(item);

      request.onsuccess = () => {
        console.log(`[EventMaterielIDBCache] Item ${item.$id} sauvegardé`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime un item
   */
  async deleteItem(itemId: string): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.ITEMS_STORE, "readwrite");
      const store = tx.objectStore(this.ITEMS_STORE);
      const request = store.delete(itemId);

      request.onsuccess = () => {
        console.log(`[EventMaterielIDBCache] Item ${itemId} supprimé`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // =============================================================================
  // METADATA
  // =============================================================================

  /**
   * Charge les métadonnées pour un événement
   */
  async loadMetadata(eventId: string): Promise<EventMaterielCacheMetadata> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readonly");
      const store = tx.objectStore(this.METADATA_STORE);
      const key = `lastSync_${eventId}`;
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result;
        const metadata: EventMaterielCacheMetadata = {
          lastSync: entry?.value ?? null,
        };
        resolve(metadata);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde les métadonnées pour un événement
   */
  async saveMetadata(
    eventId: string,
    metadata: EventMaterielCacheMetadata,
  ): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);

      store.put({
        key: `lastSync_${eventId}`,
        value: metadata.lastSync,
      });

      tx.oncomplete = () => {
        console.log(`[EventMaterielIDBCache] Metadata sauvegardées`);
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  // =============================================================================
  // UTILITAIRES
  // =============================================================================

  async clear(): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        [this.ITEMS_STORE, this.METADATA_STORE],
        "readwrite",
      );

      tx.objectStore(this.ITEMS_STORE).clear();
      tx.objectStore(this.METADATA_STORE).clear();

      tx.oncomplete = () => {
        console.log("[EventMaterielIDBCache] Cache vidé");
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("[EventMaterielIDBCache] Connexion fermée");
    }
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

export async function createEventMaterielIDBCache(): Promise<EventMaterielIDBCache> {
  const cache = new EventMaterielIndexedDBCache();
  await cache.open();
  return cache;
}

export async function deleteEventMaterielIDBCache(): Promise<void> {
  const dbName = "event-materiel-cache";

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      console.log(`[EventMaterielIDBCache] Base supprimée: ${dbName}`);
      resolve();
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(`[EventMaterielIDBCache] Suppression bloquée: ${dbName}`);
    };
  });
}
