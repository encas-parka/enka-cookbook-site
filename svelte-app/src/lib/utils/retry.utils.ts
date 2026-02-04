export interface RetryOptions {
  /** Nom de l'opération pour les logs */
  operationName: string;
  /** Message de succès */
  successMessage?: string;
  /** Message d'erreur */
  errorMessage?: string;
  /** Nombre de tentatives automatiques (défaut: 1) */
  maxAutoRetries?: number;
  /** Délai avant auto-retry en ms (défaut: 1000) */
  autoRetryDelay?: number;
  /** Callback en cas de succès */
  onSuccess?: (result: any) => void;
  /** Callback en cas d'échec final */
  onError?: (error: any) => void;
}

/**
 * Exécute une opération avec stratégie de réessai (auto + manuel)
 *
 * NOTE: Cette fonction ne crée plus de toasts. C'est à l'appelant de gérer
 * l'affichage via toastService.track() ou autre.
 *
 * @param operation - L'opération à exécuter
 * @param options - Options de retry
 * @returns Promise qui se résout avec le résultat ou null en cas d'échec
 */
export function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T | null> {
  const { operationName, maxAutoRetries = 1, autoRetryDelay = 1000 } = options;

  let attempt = 1;

  return new Promise<T | null>((resolve, reject) => {
    const tryOperation = async () => {
      try {
        console.log(
          `[RetryUtils] ${operationName} - Tentative ${attempt}/${maxAutoRetries + 1}`,
        );

        const result = await operation();

        // Succès
        console.log(`[RetryUtils] ${operationName} - Succès`);
        options.onSuccess?.(result);
        resolve(result);
      } catch (error) {
        console.error(
          `[RetryUtils] Erreur ${operationName} (Tentative ${attempt}):`,
          error,
        );
        const errMessage =
          error instanceof Error ? error.message : "Erreur inconnue";

        // Auto-retry
        if (attempt <= maxAutoRetries) {
          attempt++;
          console.log(
            `[RetryUtils] Nouvelle tentative dans ${autoRetryDelay / 1000}s...`,
          );
          setTimeout(() => tryOperation(), autoRetryDelay);
          return;
        }

        // Échec définitif après tous les essais
        console.error(
          `[RetryUtils] ${operationName} - Échec après ${attempt} tentatives`,
        );
        options.onError?.(error);
        reject(error);
      }
    };

    tryOperation();
  });
}
