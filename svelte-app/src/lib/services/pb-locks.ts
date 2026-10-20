/**
 * Service de gestion des verrous (Lock System) — PocketBase
 *
 * Collection PB : `locks`
 *   - id = resourceId (ex: "doc_abc123" ou "event_xyz789")
 *   - userId : relation vers users (maxSelect: 1)
 *   - userName : text
 *   - expiresAt : date
 *
 * API rules :
 *   - update/delete : userId = @request.auth.id
 *   - list/view/create : @request.auth.id != ""
 */

import { pb } from "$lib/db-sync/pb-sync";

// ===========================================================================
//  TYPES
// ===========================================================================

export interface Lock {
  id: string; // resourceId
  userId: string;
  userName: string;
  expiresAt: string;
  updated: string;
}

/** @deprecated Use Lock directly */
export type AppwriteLock = Lock;

// ===========================================================================
//  CONFIG
// ===========================================================================

const LOCK_DURATION_MINUTES = 7;

// ===========================================================================
//  HELPERS
// ===========================================================================

function normalizeLock(record: Record<string, any>): Lock {
  return {
    id: record.id,
    userId: record.userId || "",
    userName: record.userName || "",
    expiresAt: record.expiresAt || "",
    updated: record.updated || "",
  };
}

function isLockExpired(lock: Record<string, any>): boolean {
  return !lock.userId || new Date(lock.expiresAt || 0) < new Date();
}

// ===========================================================================
//  SERVICE
// ===========================================================================

export const locksService = {
  /**
   * Lit un verrou. Retourne null si inexistant ou expiré.
   * `requestKey: null` désactive l'autocancel du SDK : deux lectures
   * simultanées du même verrou (souscription initiale + acquisition) ne
   * doivent pas s'annuler entre elles.
   */
  async getLock(resourceId: string): Promise<Lock | null> {
    try {
      const record = await pb
        .collection("locks")
        .getOne(resourceId, { requestKey: null });
      if (isLockExpired(record)) return null;
      return normalizeLock(record);
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  /**
   * Acquiert ou rafraîchit un verrou.
   *
   * Flux :
   *   1. Lire le lock existant
   *   2. Si pas de document → créer (id = resourceId)
   *   3. Si même utilisateur → refresh (heartbeat)
   *   4. Si utilisateur différent + non expiré → refuser
   *   5. Si utilisateur différent + expiré → prendre le relais
   *
   * Contrat : renvoie TOUJOURS l'état du verrou après tentative — le lock
   * détenu par l'appelant s'il a été acquis/rafraîchi, le lock d'autrui
   * sinon (à l'appelant de verrouiller sa page). Lève sur toute erreur
   * technique (réseau, validation, règle PB, course de création).
   */
  async acquireLock(
    resourceId: string,
    userId: string,
    userName: string,
  ): Promise<Lock> {
    const expiresAt = new Date(
      Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
    ).toISOString();

    const data = { userId, userName, expiresAt };

    let existing: Record<string, any>;
    try {
      existing = await pb
        .collection("locks")
        .getOne(resourceId, { requestKey: null });
    } catch (err: any) {
      if (err.status !== 404) throw err; // panne réseau/serveur : lever
      // Pas de document → créer avec ID personnalisé (une course de création
      // simultanée lève 400 not_unique : contrat « erreur technique »)
      const created = await pb
        .collection("locks")
        .create({ id: resourceId, ...data }, { requestKey: null });
      return normalizeLock(created);
    }

    // Lock actif détenu par un autre utilisateur → renvoyer son état
    if (
      existing.userId &&
      existing.userId !== userId &&
      new Date(existing.expiresAt) >= new Date()
    ) {
      return normalizeLock(existing);
    }

    // Même utilisateur (heartbeat) OU lock expiré → update
    const updated = await pb
      .collection("locks")
      .update(resourceId, data, { requestKey: null });
    return normalizeLock(updated);
  },

  /**
   * Libère un verrou (réinitialise les valeurs).
   * userId est mis à null pour vider la relation PB.
   */
  async releaseLock(resourceId: string, _userId: string): Promise<void> {
    try {
      await pb.collection("locks").update(resourceId, {
        userId: null,
        userName: "",
        expiresAt: new Date(0).toISOString(),
      });
      console.log(`[locksService] Verrou libéré pour ${resourceId}`);
    } catch (err: any) {
      if (err.status === 404) {
        console.log(`[locksService] Verrou déjà libéré pour ${resourceId}`);
        return;
      }
      console.warn(
        "[locksService] Impossible de libérer le verrou:",
        err.message,
      );
    }
  },

  /**
   * S'abonne aux changements d'un verrou via PB SSE.
   *
   * Retourne une fonction de désinscription (Promise).
   * Les consommateurs doivent faire : `lockUnsub = await locksService.subscribeToLock(...)`
   */
  async subscribeToLock(
    resourceId: string,
    callback: (lock: Lock | null) => void,
  ): Promise<() => void> {
    return pb.collection("locks").subscribe(resourceId, (e) => {
      if (e.action === "delete") {
        callback(null);
        return;
      }

      if (isLockExpired(e.record)) {
        callback(null);
      } else {
        callback(normalizeLock(e.record));
      }
    });
  },
};
