import { ID, Query, Permission, Role } from "appwrite";
import {
  getAppwriteInstances,
  getDatabaseId,
  getCollectionId,
} from "./appwrite";
import { realtimeManager } from "../stores/RealtimeManager.svelte";

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
   * Acquiert ou rafraîchit un verrou (Permanent UPSERT)
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

    const data = {
      userId,
      userName,
      expiresAt,
    };

    const permissions = [
      Permission.read(Role.any()),
      Permission.update(Role.user(userId)),
    ];

    try {
      // 1. Tenter une mise à jour (Si le document existe déjà)
      await tables.updateRow({
        databaseId: getDatabaseId(),
        tableId: getCollectionId("locks"),
        rowId: resourceId,
        data,
        permissions,
      });
      return true;
    } catch (error: any) {
      // 2. Si non trouvé (404), créer le document
      if (error.code === 404) {
        try {
          await tables.createRow({
            databaseId: getDatabaseId(),
            tableId: getCollectionId("locks"),
            rowId: resourceId,
            data,
            permissions,
          });
          return true;
        } catch (createError: any) {
          console.error("[locksService] Erreur création verrou:", createError);
          return false;
        }
      }

      // 3. Si erreur de permission (déjà verrouillé par un autre)
      console.warn(
        "[locksService] Acquisition refusée (peut-être déjà verrouillé):",
        error.message,
      );
      return false;
    }
  },

  /**
   * Libère un verrou (Réinitialise les valeurs pour le rendre disponible)
   */
  async releaseLock(resourceId: string, userId: string): Promise<void> {
    const { tables } = await getAppwriteInstances();
    try {
      // Réinitialiser le verrou au lieu de supprimer la row
      // Plus robuste : évite les erreurs 401 si les permissions changent
      await tables.updateRow({
        databaseId: getDatabaseId(),
        tableId: getCollectionId("locks"),
        rowId: resourceId,
        data: {
          userId: "", // Vide = aucun utilisateur
          userName: "",
          expiresAt: new Date(0).toISOString(), // Date passée = verrou expiré
        },
        permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.any()), // Réinitialiser les permissions pour permettre à任何人 de prendre le lock
        ],
      });
      console.log(
        `[locksService] Verrou libéré (réinitialisé) pour ${resourceId}`,
      );
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`[locksService] Verrou déjà libéré pour ${resourceId}`);
        return;
      }
      // En cas d'erreur (401, 403, etc.), on logue mais on ne bloque pas
      // Le cleanup local se fera dans EventEditPage anyway
      console.warn(
        "[locksService] Impossible de libérer le verrou sur le serveur:",
        error.message,
      );
    }
  },

  /**
   * S'abonne aux changements d'un verrou
   * Utilise RealtimeManager avec inscription dynamique pour le multiplexage WebSocket
   */
  subscribeToLock(
    resourceId: string,
    callback: (lock: AppwriteLock | null) => void,
  ): () => void {
    const databaseId = getDatabaseId();
    const collectionId = getCollectionId("locks");

    const channel = `databases.${databaseId}.collections.${collectionId}.documents.${resourceId}`;

    console.log(`[locksService] Enregistrement du channel de lock:`, channel);

    // Utiliser RealtimeManager pour le multiplexage WebSocket (inscription dynamique)
    return realtimeManager.registerDynamic([channel], (response: any) => {
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
