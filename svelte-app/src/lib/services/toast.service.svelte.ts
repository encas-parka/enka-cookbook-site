/**
 * Types d'états des toasts
 */
export type ToastState = "loading" | "success" | "error" | "info" | "warning";

/**
 * Source du toast
 */
export type ToastSource = "user" | "realtime-other" | "system";

/**
 * Position du toast (valeurs DaisyUI)
 */
export type ToastPosition =
  | "toast-center toast-bottom"
  | "toast-top toast-end"
  | "toast-top toast-start"
  | "toast-bottom toast-end"
  | "toast-bottom toast-start"
  | "toast-center";

/**
 * Interface pour une action de toast
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/**
 * Interface pour un toast
 */
export interface Toast {
  /** ID unique du toast */
  id: string;
  /** État actuel du toast */
  state: ToastState;
  /** Message à afficher */
  message: string;
  /** Timestamp de création */
  timestamp: number;
  /** Source de l'action */
  source: ToastSource;
  /** Position du toast (optionnel, utilise la position globale par défaut) */
  position?: ToastPosition;
  /** Délai d'auto-fermeture (ID du setTimeout) */
  timeoutId?: number;
  /** Durée d'auto-fermeture personnalisée en ms (0 = persistant) */
  autoCloseDelay?: number;
  /** Détails optionnels pour affichage dans un modal */
  details?: any;
  /** Actions optionnelles (boutons) */
  actions?: ToastAction[];
  /** Timeout pour le message "Échec, temps expiré" des toasts de loading */
  loadingTimeoutId?: number;
}

/**
 * Options pour la création d'un toast
 */
export interface ToastOptions {
  /** ID personnalisé optionnel */
  id?: string;
  /** État initial */
  state: ToastState;
  /** Message à afficher */
  message: string;
  /** Source de l'action */
  source?: ToastSource;
  /** Position du toast (optionnel) */
  position?: ToastPosition;
  /** Délai d'auto-fermeture personnalisé (0 = persistant) */
  autoCloseDelay?: number;
  /** Détails optionnels pour affichage dans un modal */
  details?: any;
  /** Actions optionnelles (boutons) */
  actions?: ToastAction[];
}

/**
 * Options pour le tracking d'une opération asynchrone
 */
export interface ToastTrackOptions {
  /** Message pendant le chargement */
  loading: string;
  /** Message en cas de succès */
  success?: string;
  /** Message en cas d'erreur */
  error?: string;
  /** ID personnalisé du toast */
  id?: string;
  /** Durée d'auto-fermeture pour le toast de succès (0 = persistant) */
  successDelay?: number;
  /** Durée d'auto-fermeture pour le toast d'erreur (0 = persistant) */
  errorDelay?: number;
  /** Position du toast */
  position?: ToastPosition;
}

/**
 * Durées d'auto-fermeture par défaut (en ms)
 * 0 = pas d'auto-fermeture (toast persistant)
 */
const DEFAULT_AUTO_CLOSE_DELAYS = {
  loading: 0, // Jamais d'auto-close pour loading
  success: 2000,
  info: 3000,
  warning: 5000,
  error: 5000,
} as const;

/**
 * Multiplicateur pour les toasts realtime-other
 */
const REALTIME_MULTIPLIER = 2; // 2x plus long (success/info = 4s, warning = 10s)

/**
 * Service de gestion des toasts
 */
export class ToastService {
  /** Array des toasts actifs avec réactivité Svelte 5 */
  #toasts = $state<Toast[]>([]);
  /** Maximum de toasts simultanés (1 par source) */
  readonly MAX_TOASTS = 3; // user + realtime-other + system

  /** Accès en lecture seule aux toasts */
  get toasts(): Toast[] {
    return [...this.#toasts].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Crée un nouveau toast avec stratégie de limitation
   */
  create(options: ToastOptions): string {
    const id = options.id || crypto.randomUUID();
    const toast: Toast = {
      id,
      state: options.state,
      message: options.message,
      timestamp: Date.now(),
      source: options.source || "user",
      position: options.position,
      timeoutId: undefined,
      autoCloseDelay: options.autoCloseDelay,
      details: options.details,
      actions: options.actions || [],
    };

    // Stratégie : 1 toast par source max
    this.#addToQueue(toast);

    return id;
  }

  /**
   * Met à jour un toast existant
   */
  update(id: string, updates: Partial<ToastOptions>): void {
    const index = this.#toasts.findIndex((t) => t.id === id);
    if (index === -1) return;

    // Annuler l'auto-fermeture précédente
    const existingToast = this.#toasts[index];
    if (existingToast.timeoutId) {
      clearTimeout(existingToast.timeoutId);
    }

    // Annuler le timeout de loading précédent
    if (existingToast.loadingTimeoutId) {
      clearTimeout(existingToast.loadingTimeoutId);
    }

    // Appliquer les mises à jour
    this.#toasts[index] = {
      ...existingToast,
      state: updates.state || existingToast.state,
      message: updates.message || existingToast.message,
      source: updates.source || existingToast.source,
      position: updates.position || existingToast.position,
      actions: updates.actions || existingToast.actions,
      autoCloseDelay:
        updates.autoCloseDelay !== undefined
          ? updates.autoCloseDelay
          : existingToast.autoCloseDelay,
      loadingTimeoutId: undefined, // Reset du loading timeout
    };

    // Nouvelle auto-fermeture si nécessaire
    this.#scheduleAutoClose(this.#toasts[index]);
  }

  /**
   * Suit une opération asynchrone avec un toast
   */
  async track<T>(promise: Promise<T>, options: ToastTrackOptions): Promise<T> {
    // Toast loading
    const toastId = this.create({
      id: options.id,
      state: "loading",
      message: options.loading,
      source: "user",
      position: options.position,
    });

    try {
      const result = await promise;

      // Succès
      this.update(toastId, {
        state: "success",
        message: options.success || "Opération réussie",
        autoCloseDelay: options.successDelay,
      });

      return result;
    } catch (error) {
      // Erreur
      this.update(toastId, {
        state: "error",
        message: options.error || "Erreur lors de l'opération",
        autoCloseDelay: options.errorDelay,
      });

      throw error;
    }
  }

  /**
   * Ferme un toast
   */
  dismiss(id: string): void {
    const index = this.#toasts.findIndex((t) => t.id === id);
    if (index === -1) return;

    const toast = this.#toasts[index];
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }
    if (toast.loadingTimeoutId) {
      clearTimeout(toast.loadingTimeoutId);
    }

    this.#toasts.splice(index, 1);
  }

  /**
   * Ferme tous les toasts
   */
  dismissAll(): void {
    this.#toasts.forEach((toast) => {
      if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
      }
      if (toast.loadingTimeoutId) {
        clearTimeout(toast.loadingTimeoutId);
      }
    });
    this.#toasts = [];
  }

  /**
   * Stratégie d'ajout : 1 toast par source max
   */
  #addToQueue(newToast: Toast): void {
    // Trouver et remplacer le toast existant de la même source
    const existingIndex = this.#toasts.findIndex(
      (t) => t.source === newToast.source,
    );

    if (existingIndex >= 0) {
      // Remplacer le toast existant
      const oldToast = this.#toasts[existingIndex];
      if (oldToast.timeoutId) {
        clearTimeout(oldToast.timeoutId);
      }
      this.#toasts[existingIndex] = newToast;
    } else {
      // Ajouter nouveau toast si max non atteint
      if (this.#toasts.length < this.MAX_TOASTS) {
        this.#toasts.push(newToast);
      } else {
        // Max atteint - supprimer le plus ancien
        const oldest = this.#toasts[0];
        if (oldest.timeoutId) {
          clearTimeout(oldest.timeoutId);
        }
        this.#toasts.shift();
        this.#toasts.push(newToast);
      }
    }

    // Auto-fermeture
    this.#scheduleAutoClose(newToast);
  }

  /**
   * Programme l'auto-fermeture selon les délais par défaut
   */
  #scheduleAutoClose(toast: Toast): void {
    // Annuler l'ancien timeout si existe
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }

    // Déterminer le délai d'auto-fermeture
    let delay: number | undefined;

    if (toast.autoCloseDelay !== undefined) {
      // Valeur personnalisée (0 signifie pas d'auto-close)
      delay = toast.autoCloseDelay === 0 ? undefined : toast.autoCloseDelay;
    } else {
      // Utiliser les valeurs par défaut
      const defaultDelay = DEFAULT_AUTO_CLOSE_DELAYS[toast.state];

      // Pour realtime-other, multiplier par 2 (sauf si 0)
      if (toast.source === "realtime-other" && defaultDelay > 0) {
        delay = defaultDelay * REALTIME_MULTIPLIER;
      } else {
        delay = defaultDelay === 0 ? undefined : defaultDelay;
      }
    }

    // Pas d'auto-fermeture si delay est undefined
    if (delay === undefined) {
      return;
    }

    // Programmer l'auto-fermeture
    toast.timeoutId = setTimeout(() => {
      this.dismiss(toast.id);
    }, delay) as unknown as number;
  }

  /**
   * Méthodes utilitaires simples
   */
  success(
    message: string,
    options?: {
      details?: any;
      autoCloseDelay?: number;
      position?: ToastPosition;
    },
  ): string {
    return this.create({
      state: "success",
      message,
      details: options?.details,
      autoCloseDelay: options?.autoCloseDelay,
      position: options?.position,
    });
  }

  error(
    message: string,
    options?: {
      details?: any;
      autoCloseDelay?: number;
      position?: ToastPosition;
    },
  ): string {
    return this.create({
      state: "error",
      message,
      details: options?.details,
      autoCloseDelay: options?.autoCloseDelay,
      position: options?.position,
    });
  }

  warning(
    message: string,
    options?: {
      source?: ToastSource;
      details?: any;
      actions?: ToastAction[];
      autoCloseDelay?: number;
      position?: ToastPosition;
    },
  ): string {
    return this.create({
      state: "warning",
      message,
      source: options?.source || "system",
      details: options?.details,
      actions: options?.actions,
      autoCloseDelay: options?.autoCloseDelay,
      position: options?.position,
    });
  }

  info(
    message: string,
    options?: {
      source?: ToastSource;
      details?: any;
      autoCloseDelay?: number;
      position?: ToastPosition;
    },
  ): string {
    return this.create({
      state: "info",
      message,
      source: options?.source || "system",
      details: options?.details,
      autoCloseDelay: options?.autoCloseDelay,
      position: options?.position,
    });
  }

  loading(
    message: string,
    options?: {
      details?: any;
      autoCloseDelay?: number;
      position?: ToastPosition;
    },
  ): string {
    const DEFAULT_LOADING_TIMEOUT = 30000; // 30 secondes

    // Utiliser le autoCloseDelay personnalisé si fourni, sinon 30s
    const delay = options?.autoCloseDelay ?? DEFAULT_LOADING_TIMEOUT;

    const id = this.create({
      state: "loading",
      message,
      details: options?.details,
      autoCloseDelay: delay,
      position: options?.position,
    });

    // Changer le message en "Échec, temps expiré" 2s avant la fermeture
    // On stocke le loadingTimeoutId séparément pour pouvoir l'annuler si update() est appelé
    const loadingTimeoutId = setTimeout(() => {
      this.update(id, {
        state: "warning",
        message: "Échec, temps expiré",
        autoCloseDelay: 2000,
      });
    }, delay - 2000) as unknown as number;

    // Récupérer le toast et stocker le loadingTimeoutId
    const toastIndex = this.#toasts.findIndex((t) => t.id === id);
    if (toastIndex !== -1) {
      this.#toasts[toastIndex].loadingTimeoutId = loadingTimeoutId;
    }

    return id;
  }
}

/**
 * Instance singleton
 */
export const toastService = new ToastService();
