/**
 * StatusBarStore — état centralisé pour le composant StatusBar.
 *
 * Sources de statut :
 *   - offline (géré automatiquement par le composant StatusBar)
 *   - lock by others / lock by me (poussé par les pages d'édition)
 *   - serveur inaccessible (plus tard)
 *
 * La priorité d'affichage est : offline > lock by others > lock by me
 */

export type LockStatus =
  | { type: "locked-by-me" }
  | { type: "locked-by-other"; userName: string }
  | null;

class StatusBarStore {
  #lockStatus = $state<LockStatus>(null);

  get lockStatus(): LockStatus {
    return this.#lockStatus;
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
