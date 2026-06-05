import { ID, Query } from "appwrite";
import {
  getAppwriteInstances,
  getDatabaseId,
  getCollectionId,
} from "./appwrite";
import { registerRealtimeDynamic } from "$lib/db-sync/aw-sync";

export interface AppwriteLock {
  $id: string; // L'ID du document verrouillé (ex: eventId)
  userId: string;
  userName: string;
  expiresAt: string;
  $updatedAt: string;
}

const LOCK_DURATION_MINUTES = 7;

/**
 * Service de gestion des verrous (Lock System)
 */
export const locksService = {
  async getLock(resourceId: string): Promise<AppwriteLock | null> {
    const { tables } = await getAppwriteInstances();
    try {
      const lock = await tables.getRow({
        databaseId: getDatabaseId(),
        tableId: getCollectionId("locks"),
        rowId: resourceId,
      });

      // Vérifier si le verrou est vide ou périmé
      if (!lock.userId || new Date(lock.expiresAt) < new Date()) {
        return null;
      }

      return lock as unknown as AppwriteLock;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  },

  /**
   * Acquiert ou rafraîchit un verrou.
   *
   * Flux :
   *   1. Lire le lock brut (sans filtrage d'expiration)
   *   2. Si pas de document → créer
   *   3. Si même utilisateur → refresh (heartbeat)
   *   4. Si utilisateur différent + non expiré → refuser
   *   5. Si utilisateur différent + expiré → prendre le relais
   *
   * Update est autorisé au niveau collection (Users),
   * la protection contre le vol de lock actif est dans le code.
   */
  async acquireLock(
    resourceId: string,
    userId: string,
    userName: string,
  ): Promise<boolean> {
    const { tables } = await getAppwriteInstances();
    const expiresAt = new Date(
      Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
    ).toISOString();

    const data = { userId, userName, expiresAt };

    // 1. Lecture du lock brut (sans filtrage d'expiration)
    // Permissions gérées au niveau collection (Create, Read, Update → Users)
    try {
      const existing = await tables.getRow({
        databaseId: getDatabaseId(),
        tableId: getCollectionId("locks"),
        rowId: resourceId,
      });

      // Document existe : vérifier si on peut l'acquérir
      if (
        existing.userId &&
        existing.userId !== userId &&
        new Date(existing.expiresAt) >= new Date()
      ) {
        // Lock actif détenu par un autre utilisateur → refuser
        return false;
      }

      // Même utilisateur (heartbeat) OU lock expiré → update
      await tables.updateRow({
        databaseId: getDatabaseId(),
        tableId: getCollectionId("locks"),
        rowId: resourceId,
        data,
      });
      return true;
    } catch (error: any) {
      // Pas de document → créer
      if (error.code === 404) {
        try {
          await tables.createRow({
            databaseId: getDatabaseId(),
            tableId: getCollectionId("locks"),
            rowId: resourceId,
            data,
          });
          return true;
        } catch (createError: any) {
          console.error("[locksService] Erreur création verrou:", createError);
          return false;
        }
      }

      console.warn(
        "[locksService] Erreur acquisition verrou:",
        error.message,
      );
      return false;
    }
  },

  /**
   * Libère un verrou (Réinitialise les valeurs pour le rendre disponible).
   * Permissions gérées au niveau collection (Update → Users).
   */
  async releaseLock(resourceId: string, userId: string): Promise<void> {
    const { tables } = await getAppwriteInstances();
    try {
      await tables.updateRow({
        databaseId: getDatabaseId(),
        tableId: getCollectionId("locks"),
        rowId: resourceId,
        data: {
          userId: "",
          userName: "",
          expiresAt: new Date(0).toISOString(),
        },
      });
      console.log(
        `[locksService] Verrou libéré pour ${resourceId}`,
      );
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`[locksService] Verrou déjà libéré pour ${resourceId}`);
        return;
      }
      console.warn(
        "[locksService] Impossible de libérer le verrou sur le serveur:",
        error.message,
      );
    }
  },

  /**
   * S'abonne aux changements d'un verrou
   * Utilise le registre realtime centralisé (aw-sync) avec inscription dynamique
   */
  subscribeToLock(
    resourceId: string,
    callback: (lock: AppwriteLock | null) => void,
  ): () => void {
    const databaseId = getDatabaseId();
    const collectionId = getCollectionId("locks");

    const channel = `databases.${databaseId}.collections.${collectionId}.documents.${resourceId}`;

    console.log(`[locksService] Enregistrement du channel de lock:`, channel);

    return registerRealtimeDynamic([channel], (response: any) => {
      // Événement de suppression
      if (response.events?.some((e: string) => e.endsWith(".delete"))) {
        callback(null);
        return;
      }

      // Événement de création ou mise à jour
      if (!response.payload) return;

      const payload = response.payload as AppwriteLock;
      if (!payload.userId || new Date(payload.expiresAt) < new Date()) {
        callback(null);
      } else {
        callback(payload);
      }
    });
  },
};
