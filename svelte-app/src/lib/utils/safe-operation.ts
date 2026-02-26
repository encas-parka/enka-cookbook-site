/**
 * Utilitaires d'opération sûre avec retry, timeout et parsing JSON sécurisé
 *
 * Ce module fournit des fonctions pour exécuter des opérations réseau de manière
 * fiable avec retry automatique, timeout configurable, et parsing JSON sécurisé.
 *
 * @module safe-operation
 */

import { toastService } from "../services/toast.service.svelte";

/**
 * Options pour safeOperation
 */
export interface SafeOperationOptions {
  /** Nombre maximum de tentatives (défaut: 3) */
  maxAttempts?: number;
  /** Timeout en ms (défaut: 10000 = 10s) */
  timeout?: number;
  /** Contexte pour les logs (ex: "EventsStore.createEvent") */
  context?: string;
  /** Message de succès pour l'utilisateur */
  successMessage?: string;
  /** Message d'erreur pour l'utilisateur */
  errorMessage?: string;
  /** Délai entre tentatives en ms (défaut: 1000) */
  retryDelay?: number;
  /** Mode silencieux (pas de toast) - utile pour realtime */
  silent?: boolean;
}

/**
 * Exécute une opération de manière sûre avec retry et timeout
 *
 * @example
 * ```typescript
 * const event = await safeOperation(
 *   () => createEventAppwrite(data),
 *   {
 *     context: "EventsStore.create",
 *     timeout: 5000,
 *     successMessage: "Événement créé !"
 *   }
 * );
 * ```
 */
export async function safeOperation<T>(
  operation: () => Promise<T>,
  options: SafeOperationOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    timeout = 10000,
    context = "Operation",
    successMessage,
    errorMessage,
    retryDelay = 1000,
    silent = false,
  } = options;

  let lastError: Error | null = null;

  // Retry avec exponential backoff simple
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[${context}] Tentative ${attempt}/${maxAttempts}`);

      // Timeout avec Promise.race
      const result = await Promise.race<T>([
        operation(),
        createTimeout(timeout),
      ]);

      // Succès
      if (attempt > 1) {
        console.log(`[${context}] ✓ Succès après ${attempt} tentatives`);
      }

      if (successMessage && !silent) {
        toastService.success(successMessage);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.error(
        `[${context}] ✗ Tentative ${attempt}/${maxAttempts} échouée:`,
        lastError.message,
      );

      // Dernière tentative → échec définitif
      if (attempt === maxAttempts) {
        console.error(`[${context}] ✗ Échec après ${maxAttempts} tentatives`);

        if (errorMessage && !silent) {
          toastService.error(errorMessage);
        }

        throw lastError;
      }

      // Attendre avant de réessayer (exponential backoff)
      const delay = retryDelay * attempt;
      console.log(`[${context}] Nouvelle tentative dans ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError || new Error(`${context}: Échec inconnu`);
}

/**
 * Crée un timeout qui rejette après le délai spécifié
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Timeout après ${ms}ms`));
    }, ms);
  });
}

/**
 * Attend un délai en millisecondes
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse du JSON de manière sécurisée avec fallback
 *
 * @example
 * ```typescript
 * const data = safeJsonParse(rawJson, { fallback: null });
 * if (data === null) {
 *   console.error("JSON invalide");
 * }
 * ```
 */
export function safeJsonParse<T = any>(
  json: string,
  options: {
    fallback?: T;
    context?: string;
  } = {},
): T | null {
  const { fallback = null, context = "JSON.parse" } = options;

  try {
    return JSON.parse(json);
  } catch (error) {
    console.error(
      `[${context}] ✗ JSON invalide:`,
      error instanceof Error ? error.message : error,
    );
    return fallback as T;
  }
}

/**
 * Parse un tableau de JSON stringifiés de manière sécurisée
 *
 * @example
 * ```typescript
 * const meals = safeJsonArrayParse(rawMeals, {
 *   context: "EventsStore.parseMeals",
 *   itemFallback: (item, index) => ({ id: `unknown-${index}`, name: "Inconnu" })
 * });
 * ```
 */
export function safeJsonArrayParse<T>(
  jsonArray: string[] | null | undefined,
  options: {
    context?: string;
    itemFallback?: (item: string, index: number) => T;
  } = {},
): T[] {
  const { context = "JSON.parseArray", itemFallback } = options;

  if (!jsonArray || !Array.isArray(jsonArray)) {
    console.warn(`[${context}] Tableau vide ou invalide`);
    return [];
  }

  return jsonArray
    .map((itemStr, index) => {
      const parsed = safeJsonParse<T>(itemStr, {
        context: `${context}[${index}]`,
        fallback: undefined,
      });

      if (parsed === undefined && itemFallback) {
        return itemFallback(itemStr, index);
      }

      return parsed;
    })
    .filter((item): item is T => item !== null);
}
