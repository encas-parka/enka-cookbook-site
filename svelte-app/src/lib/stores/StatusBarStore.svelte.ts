/**
 * StatusBarStore — état centralisé pour le composant StatusBar.
 *
 * Sources de statut :
 *   - offline (géré automatiquement par le composant StatusBar)
 *   - serveur inaccessible (détecté via échec resync / WebSocket)
 *   - lock by others / lock by me (poussé par les pages d'édition)
 *
 * La priorité d'affichage est : offline > serveur inaccessible > lock by others > lock by me
 */

export type LockStatus =
  | { type: "locked-by-me" }
  | { type: "locked-by-other"; userName: string }
  | null;

export type ServerStatus = "connected" | "disconnected" | "unreachable" | null;

class StatusBarStore {
  #lockStatus = $state<LockStatus>(null);
  #serverStatus = $state<ServerStatus>(null);

  get lockStatus(): LockStatus {
    return this.#lockStatus;
  }

  get serverStatus(): ServerStatus {
    return this.#serverStatus;
  }

  /**
   * Met à jour le statut du serveur.
   * Appelé par aw-realtime (connect/reconnect/destroy) et main.ts (resync).
   */
  setServerStatus(status: ServerStatus) {
    this.#serverStatus = status;
  }

  /**
   * Met à jour le statut du lock.
   * Appelé par les pages d'édition via $effect.
   */
  setLockStatus(status: LockStatus) {
    this.#lockStatus = status;
  }

  /**
   * Réinitialise le lock status.
   * Appelé au démontage des pages d'édition.
   */
  clearLockStatus() {
    this.#lockStatus = null;
  }
}

export const statusBarStore = new StatusBarStore();
