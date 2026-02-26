/**
 * Service de cache IndexedDB pour MaterielStore
 *
 * Architecture:
 * - 1 base: `materiel-cache`
 * - 1 store "materiels" pour les EnrichedMateriel
 * - 1 store "loans" pour les MaterielLoan
 * - 1 store "metadata" pour lastSyncMateriel et lastSyncLoans
 *
 * Stratégie:
 * - Tous les matériels et emprunts sont chargés au démarrage depuis IDB
 * - Cache persistant pour éviter les fetchs répétés
 * - Synchronisation automatique via realtime avec Appwrite
 */

import type { EnrichedMateriel } from "$lib/types/materiel.types";
import type { MaterielLoan } from "$lib/types/appwrite";
import type { Models } from "appwrite";

// =============================================================================
// TYPES
// =============================================================================

export interface MaterielCacheMetadata {
  lastSyncMateriel: string | null;
  lastSyncLoans: string | null;
}

export interface MaterielIDBCache {
  open(): Promise<void>;

  // Materiels
  loadMateriels(): Promise<Map<string, EnrichedMateriel>>;
  saveMateriels(materiels: Map<string, EnrichedMateriel>): Promise<void>;
  upsertMateriel(materiel: EnrichedMateriel): Promise<void>;
  deleteMateriel(materielId: string): Promise<void>;

  // Loans
  loadLoans(): Promise<Map<string, MaterielLoan>>;
  saveLoans(loans: Map<string, MaterielLoan>): Promise<void>;
  upsertLoan(loan: MaterielLoan): Promise<void>;
  deleteLoan(loanId: string): Promise<void>;

  // Metadata
  loadMetadata(): Promise<MaterielCacheMetadata>;
  saveMetadata(metadata: MaterielCacheMetadata): Promise<void>;

  // Utilitaires
  clear(): Promise<void>;
  close(): void;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

class MaterielIndexedDBCache implements MaterielIDBCache {
  private dbName = "materiel-cache";
  private db: IDBDatabase | null = null;
  private version = 1;

  // Noms des object stores
  private readonly MATERIELS_STORE = "materiels";
  private readonly LOANS_STORE = "loans";
  private readonly METADATA_STORE = "metadata";

  // Clés pour les métadonnées
  private readonly LAST_SYNC_MATERIEL_KEY = "lastSyncMateriel";
  private readonly LAST_SYNC_LOANS_KEY = "lastSyncLoans";

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

          // Store des matériels (key = $id)
          if (!db.objectStoreNames.contains(this.MATERIELS_STORE)) {
            db.createObjectStore(this.MATERIELS_STORE, {
              keyPath: "$id",
            });
            console.log("[MaterielIDBCache] Object store 'materiels' créé");
          }

          // Store des emprunts (key = $id)
          if (!db.objectStoreNames.contains(this.LOANS_STORE)) {
            db.createObjectStore(this.LOANS_STORE, {
              keyPath: "$id",
            });
            console.log("[MaterielIDBCache] Object store 'loans' créé");
          }

          // Store des métadonnées
          if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
            db.createObjectStore(this.METADATA_STORE, { keyPath: "key" });
            console.log("[MaterielIDBCache] Object store 'metadata' créé");
          }
        };
      });
    };

    // Tenter d'ouvrir la base
    let db = await tryOpen();

    // Vérifier que les object stores nécessaires existent
    const hasMaterielsStore = db.objectStoreNames.contains(
      this.MATERIELS_STORE,
    );
    const hasLoansStore = db.objectStoreNames.contains(this.LOANS_STORE);
    const hasMetadataStore = db.objectStoreNames.contains(this.METADATA_STORE);

    if (!hasMaterielsStore || !hasLoansStore || !hasMetadataStore) {
      // La base est corrompue ou obsolète
      console.warn(
        `[MaterielIDBCache] Base incomplète détectée (materiels=${hasMaterielsStore}, loans=${hasLoansStore}, metadata=${hasMetadataStore}), suppression et recréation...`,
      );

      // Fermer la connexion actuelle
      db.close();

      // Supprimer la base corrompue
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn("[MaterielIDBCache] Suppression bloquée, réessai...");
        };
      });

      // Recréer la base
      db = await tryOpen();
    }

    this.db = db;
    console.log(`[MaterielIDBCache] Base ouverte: ${this.dbName}`);
  }

  // =============================================================================
  // MATERIELS
  // =============================================================================

  /**
   * Charge tous les matériels
   */
  async loadMateriels(): Promise<Map<string, EnrichedMateriel>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.MATERIELS_STORE, "readonly");
      const store = tx.objectStore(this.MATERIELS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const materiels = new Map<string, EnrichedMateriel>();
        (request.result as EnrichedMateriel[]).forEach((materiel) => {
          materiels.set(materiel.$id, materiel);
        });
        console.log(`[MaterielIDBCache] ${materiels.size} matériels chargés`);
        resolve(materiels);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde tous les matériels (bulk write)
   */
  async saveMateriels(materiels: Map<string, EnrichedMateriel>): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.MATERIELS_STORE, "readwrite");
      const store = tx.objectStore(this.MATERIELS_STORE);

      store.clear();

      materiels.forEach((materiel) => {
        store.put(materiel);
      });

      tx.oncomplete = () => {
        console.log(
          `[MaterielIDBCache] ${materiels.size} matériels sauvegardés`,
        );
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sauvegarde un matériel individuel
   */
  async upsertMateriel(materiel: EnrichedMateriel): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.MATERIELS_STORE, "readwrite");
      const store = tx.objectStore(this.MATERIELS_STORE);
      const request = store.put(materiel);

      request.onsuccess = () => {
        console.log(`[MaterielIDBCache] Matériel ${materiel.$id} sauvegardé`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime un matériel
   */
  async deleteMateriel(materielId: string): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.MATERIELS_STORE, "readwrite");
      const store = tx.objectStore(this.MATERIELS_STORE);
      const request = store.delete(materielId);

      request.onsuccess = () => {
        console.log(`[MaterielIDBCache] Matériel ${materielId} supprimé`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // =============================================================================
  // LOANS
  // =============================================================================

  /**
   * Charge tous les emprunts
   */
  async loadLoans(): Promise<Map<string, MaterielLoan>> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.LOANS_STORE, "readonly");
      const store = tx.objectStore(this.LOANS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const loans = new Map<string, MaterielLoan>();
        (request.result as (Models.Document & MaterielLoan)[]).forEach(
          (loan) => {
            loans.set(loan.$id, loan);
          },
        );
        console.log(`[MaterielIDBCache] ${loans.size} emprunts chargés`);
        resolve(loans);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde tous les emprunts (bulk write)
   */
  async saveLoans(loans: Map<string, MaterielLoan>): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.LOANS_STORE, "readwrite");
      const store = tx.objectStore(this.LOANS_STORE);

      store.clear();

      loans.forEach((loan) => {
        store.put(loan);
      });

      tx.oncomplete = () => {
        console.log(`[MaterielIDBCache] ${loans.size} emprunts sauvegardés`);
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sauvegarde un emprunt individuel
   */
  async upsertLoan(loan: MaterielLoan): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.LOANS_STORE, "readwrite");
      const store = tx.objectStore(this.LOANS_STORE);
      const request = store.put(loan);

      request.onsuccess = () => {
        console.log(`[MaterielIDBCache] Emprunt ${loan.$id} sauvegardé`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime un emprunt
   */
  async deleteLoan(loanId: string): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.LOANS_STORE, "readwrite");
      const store = tx.objectStore(this.LOANS_STORE);
      const request = store.delete(loanId);

      request.onsuccess = () => {
        console.log(`[MaterielIDBCache] Emprunt ${loanId} supprimé`);
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
  async loadMetadata(): Promise<MaterielCacheMetadata> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readonly");
      const store = tx.objectStore(this.METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const allEntries = request.result;

        const metadata: MaterielCacheMetadata = {
          lastSyncMateriel: null,
          lastSyncLoans: null,
        };

        allEntries.forEach((entry) => {
          if (entry.key === this.LAST_SYNC_MATERIEL_KEY)
            metadata.lastSyncMateriel = entry.value;
          if (entry.key === this.LAST_SYNC_LOANS_KEY)
            metadata.lastSyncLoans = entry.value;
        });

        console.log(
          `[MaterielIDBCache] Metadata chargées: lastSyncMateriel=${metadata.lastSyncMateriel}, lastSyncLoans=${metadata.lastSyncLoans}`,
        );
        resolve(metadata);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde les métadonnées
   */
  async saveMetadata(metadata: MaterielCacheMetadata): Promise<void> {
    if (!this.db) throw new Error("DB non ouverte");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.METADATA_STORE, "readwrite");
      const store = tx.objectStore(this.METADATA_STORE);

      store.put({
        key: this.LAST_SYNC_MATERIEL_KEY,
        value: metadata.lastSyncMateriel,
      });
      store.put({
        key: this.LAST_SYNC_LOANS_KEY,
        value: metadata.lastSyncLoans,
      });

      tx.oncomplete = () => {
        console.log(`[MaterielIDBCache] Metadata sauvegardées`);
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
        [this.MATERIELS_STORE, this.LOANS_STORE, this.METADATA_STORE],
        "readwrite",
      );

      tx.objectStore(this.MATERIELS_STORE).clear();
      tx.objectStore(this.LOANS_STORE).clear();
      tx.objectStore(this.METADATA_STORE).clear();

      tx.oncomplete = () => {
        console.log("[MaterielIDBCache] Cache vidé");
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
      console.log("[MaterielIDBCache] Connexion fermée");
    }
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

/**
 * Crée et ouvre une instance de cache IndexedDB pour les matériels
 */
export async function createMaterielIDBCache(): Promise<MaterielIDBCache> {
  const cache = new MaterielIndexedDBCache();
  await cache.open();
  return cache;
}

/**
 * Supprime complètement la base IndexedDB des matériels
 */
export async function deleteMaterielIDBCache(): Promise<void> {
  const dbName = "materiel-cache";

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      console.log(`[MaterielIDBCache] Base supprimée: ${dbName}`);
      resolve();
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(`[MaterielIDBCache] Suppression bloquée: ${dbName}`);
    };
  });
}
