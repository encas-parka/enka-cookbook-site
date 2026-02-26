/**
 * Service de cache IndexedDB pour EventsStore
 *
 * Architecture:
 * - 1 base: `events-cache`
 * - 1 store "events" pour les EnrichedEvent
 * - 1 store "metadata" pour lastSync
 *
 * Stratégie:
 * - Tous les événements sont chargés au démarrage
 * - Cache persistant pour éviter les fetches répétés
 * - Synchronisation automatique via realtime
 */

import type { EnrichedEvent } from "$lib/types/events";

// =============================================================================
// TYPES
// =============================================================================

export interface EventsCacheMetadata {
  lastSync: string | null;
}

export interface EventsIDBCache {
  open(): Promise<void>;

  // Events
  loadEvents(): Promise<Map<string, EnrichedEvent>>;
  saveEvents(events: Map<string, EnrichedEvent>): Promise<void>;
  saveEvent(event: EnrichedEvent): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;

  // Poster Configs
  loadPosterConfig(eventId: string): Promise<any | null>;
  savePosterConfig(eventId: string, config: any): Promise<void>;

  // Metadata
  loadMetadata(): Promise<EventsCacheMetadata>;
  saveMetadata(metadata: EventsCacheMetadata): Promise<void>;

  // Utilitaires
  clear(): Promise<void>;
  close(): void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

class EventsIndexedDBCache implements EventsIDBCache {
  private dbName = "events-cache";
  private db: IDBDatabase | null = null;
  private version = 2;

  // Noms des object stores
  private readonly EVENTS_STORE = "events";
  private readonly METADATA_STORE = "metadata";
  private readonly POSTER_CONFIGS_STORE = "poster-configs";

  // Clés pour les métadonnées
  private readonly LAST_SYNC_KEY = "lastSync";

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

          // Store des événements (key = $id)
          if (!db.objectStoreNames.contains(this.EVENTS_STORE)) {
            db.createObjectStore(this.EVENTS_STORE, {
              keyPath: "$id",
            });
            console.log("[EventsIDBCache] Object store 'events' créé");
          }

          // Store des métadonnées
          if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
            db.createObjectStore(this.METADATA_STORE, { keyPath: "key" });
            console.log("[EventsIDBCache] Object store 'metadata' créé");
          }

          // Store des configurations d'affiches (key = eventId)
          if (!db.objectStoreNames.contains(this.POSTER_CONFIGS_STORE)) {
            db.createObjectStore(this.POSTER_CONFIGS_STORE, { keyPath: "eventId" });
            console.log("[EventsIDBCache] Object store 'poster-configs' créé");
          }
        };
      });
    };

    // Tenter d'ouvrir la base
    let db = await tryOpen();

    // Vérifier que les object stores nécessaires existent
    const hasEventsStore = db.objectStoreNames.contains(this.EVENTS_STORE);
    const hasMetadataStore = db.objectStoreNames.contains(this.METADATA_STORE);
    const hasPosterConfigsStore = db.objectStoreNames.contains(this.POSTER_CONFIGS_STORE);

    if (!hasEventsStore || !hasMetadataStore || !hasPosterConfigsStore) {
      // La base est corrompue ou obsolète (existe mais sans les stores nécessaires)
      console.warn(
        `[EventsIDBCache] Base incomplète détectée (events=${hasEventsStore}, metadata=${hasMetadataStore}, posters=${hasPosterConfigsStore}), suppression et recréation...`,
      );

      // Fermer la connexion actuelle
      db.close();

      // Supprimer la base corrompue
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn("[EventsIDBCache] Suppression bloquée, réessai...");
        };
      });

      // Recréer la base
      db = await tryOpen();
    }

    this.db = db;
    console.log(`[EventsIDBCache] Base ouverte: ${this.dbName}`);
  }

  // =============================================================================
  // EVENTS
  // =============================================================================

  /**
   * Charge tous les événements
   */
  async loadEvents(): Promise<Map<string, EnrichedEvent>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.EVENTS_STORE, "readonly");
      const store = tx.objectStore(this.EVENTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const events = new Map<string, EnrichedEvent>();
        (request.result as EnrichedEvent[]).forEach((event) => {
          events.set(event.$id, event);
        });
        console.log(`[EventsIDBCache] ${events.size} événements chargés`);
        resolve(events);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde tous les événements (bulk write)
   */
  async saveEvents(events: Map<string, EnrichedEvent>): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.EVENTS_STORE, "readwrite");
      const store = tx.objectStore(this.EVENTS_STORE);

      store.clear();

      events.forEach((event) => {
        store.put(event);
      });

      tx.oncomplete = () => {
        console.log(`[EventsIDBCache] ${events.size} événements sauvegardés`);
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sauvegarde un événement individuel
   */
  async saveEvent(event: EnrichedEvent): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.EVENTS_STORE, "readwrite");
      const store = tx.objectStore(this.EVENTS_STORE);
      const request = store.put(event);

      request.onsuccess = () => {
        console.log(`[EventsIDBCache] Événement ${event.$id} sauvegardé`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime un événement
   */
  async deleteEvent(eventId: string): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.EVENTS_STORE, "readwrite");
      const store = tx.objectStore(this.EVENTS_STORE);
      const request = store.delete(eventId);

      request.onsuccess = () => {
        console.log(`[EventsIDBCache] Événement ${eventId} supprimé`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // =============================================================================
  // POSTER CONFIGS
  // =============================================================================

  /**
   * Charge la configuration d'affiche pour un événement
   */
  async loadPosterConfig(eventId: string): Promise<any | null> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.POSTER_CONFIGS_STORE, "readwrite");
      const store = tx.objectStore(this.POSTER_CONFIGS_STORE);
      const request = store.get(eventId);

      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          resolve(null);
          return;
        }

        // MigrationV1 -> V2 : Si on a { config } mais pas { current }
        if (result.config && !result.current) {
          console.log(
            `[EventsIDBCache] Migration config affiche V1 -> V2 pour ${eventId}`,
          );
          const migratedContainer = {
            current: result.config,
            versions: [],
          };
          // On sauvegarde la migration
          store.put({
            eventId,
            ...migratedContainer,
            updatedAt: new Date().toISOString(),
          });
          resolve(migratedContainer);
        } else {
          // Format V2 ou inconnu
          if (result.current) {
            resolve({ current: result.current, versions: result.versions });
          } else {
            resolve(null);
          }
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde la configuration d'affiche pour un événement
   */
  async savePosterConfig(eventId: string, container: any): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.POSTER_CONFIGS_STORE, "readwrite");
      const store = tx.objectStore(this.POSTER_CONFIGS_STORE);
      const request = store.put({
        eventId,
        ...container, // spread { current, versions }
        updatedAt: new Date().toISOString(),
      });

      request.onsuccess = () => {
        console.log(
          `[EventsIDBCache] Config affiche (container) pour ${eventId} sauvegardée`,
        );
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // =============================================================================
  // METADATA
  // =============================================================================

  /**
   * Charge les métadonnées
   */
  async loadMetadata(): Promise<EventsCacheMetadata> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readonly");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const allEntries = request.result;

        const metadata: EventsCacheMetadata = {
          lastSync: null,
        };

        allEntries.forEach((entry) => {
          if (entry.key === this.LAST_SYNC_KEY) metadata.lastSync = entry.value;
        });

        console.log(
          `[EventsIDBCache] Metadata chargées: lastSync=${metadata.lastSync}`,
        );
        resolve(metadata);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde les métadonnées
   */
  async saveMetadata(metadata: EventsCacheMetadata): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);

      store.put({ key: this.LAST_SYNC_KEY, value: metadata.lastSync });

      tx.oncomplete = () => {
        console.log(`[EventsIDBCache] Metadata sauvegardées`);
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
        [this.EVENTS_STORE, this.METADATA_STORE, this.POSTER_CONFIGS_STORE],
        "readwrite",
      );

      tx.objectStore(this.EVENTS_STORE).clear();
      tx.objectStore(this.METADATA_STORE).clear();
      tx.objectStore(this.POSTER_CONFIGS_STORE).clear();

      tx.oncomplete = () => {
        console.log("[EventsIDBCache] Cache vidé");
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
      console.log("[EventsIDBCache] Connexion fermée");
    }
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

/**
 * Crée et ouvre une instance de cache IndexedDB pour les événements
 */
export async function createEventsIDBCache(): Promise<EventsIDBCache> {
  const cache = new EventsIndexedDBCache();
  await cache.open();
  return cache;
}

/**
 * Supprime complètement la base IndexedDB des événements
 */
export async function deleteEventsIDBCache(): Promise<void> {
  const dbName = "events-cache";

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      console.log(`[EventsIDBCache] Base supprimée: ${dbName}`);
      resolve();
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(`[EventsIDBCache] Suppression bloquée: ${dbName}`);
    };
  });
}
