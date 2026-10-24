/**
 * Stub partagé de `toastService` pour les tests composants — surface
 * calquée sur l'API réellement appelée par les composants (grep 24-10 :
 * success, error, warning, info, loading, track, update, dismiss,
 * dismissAll ; `create` et le getter `toasts` ne sont pas consommés
 * hors du service et de Toast.svelte).
 *
 * Contrainte de hoisting : `vi.mock` est hoisté avant les imports, le
 * factory doit donc importer le stub dynamiquement. Coût par fichier de
 * test : un factory + ses assertions.
 *
 * ```ts
 * vi.mock("$lib/services/toast.service.svelte", async () => {
 *   const { mockToastService } = await import("$lib/test/toast-stub");
 *   return mockToastService();
 * });
 * import { toastStub } from "$lib/test/toast-stub"; // même instance
 * ```
 *
 * Vitest isole les modules par fichier de test : le singleton ci-dessous
 * est propre à chaque fichier ; `toastStub.reset()` en beforeEach.
 */
import { vi, type Mock } from "vitest";
import type { ToastTrackOptions } from "$lib/services/toast.service.svelte";

/** Options des méthodes simples (calque des signatures du service). */
interface SimpleToastOptions {
  details?: unknown;
  autoCloseDelay?: number;
  position?: unknown;
  source?: unknown;
  actions?: unknown;
}

export interface ToastStub {
  /** Journalise et retourne un id factice — la promesse du vrai service n'existe pas ici. */
  success: Mock<(message: string, options?: SimpleToastOptions) => string>;
  error: Mock<(message: string, options?: SimpleToastOptions) => string>;
  warning: Mock<(message: string, options?: SimpleToastOptions) => string>;
  info: Mock<(message: string, options?: SimpleToastOptions) => string>;
  loading: Mock<(message: string, options?: SimpleToastOptions) => string>;
  /** Transparent : résout/rejette comme la promesse passée (le vrai service re-throw). */
  track: Mock<
    (promise: Promise<unknown>, options: ToastTrackOptions) => Promise<unknown>
  >;
  update: Mock<(id: string, updates: Record<string, unknown>) => void>;
  dismiss: Mock<(id: string) => void>;
  dismissAll: Mock<() => void>;
  /** Vide les journaux d'appels (beforeEach). */
  reset: () => void;
}

let toastSeq = 0;
const nextToastId = () => `toast-${++toastSeq}`;

function simpleFn(): Mock<
  (message: string, options?: SimpleToastOptions) => string
> {
  return vi.fn((_message: string, _options?: SimpleToastOptions) =>
    nextToastId(),
  );
}

export const toastStub: ToastStub = {
  success: simpleFn(),
  error: simpleFn(),
  warning: simpleFn(),
  info: simpleFn(),
  loading: simpleFn(),
  track: vi.fn(
    async (
      promise: Promise<unknown>,
      _options: ToastTrackOptions,
    ): Promise<unknown> => promise,
  ),
  update: vi.fn((_id: string, _updates: Record<string, unknown>) => {}),
  dismiss: vi.fn((_id: string) => {}),
  dismissAll: vi.fn(() => {}),
  reset: () => {
    for (const fn of [
      toastStub.success,
      toastStub.error,
      toastStub.warning,
      toastStub.info,
      toastStub.loading,
      toastStub.track,
      toastStub.update,
      toastStub.dismiss,
      toastStub.dismissAll,
    ]) {
      fn.mockClear();
    }
  },
};

/** Valeur exacte à retourner depuis le factory `vi.mock`. */
export function mockToastService(): { toastService: ToastStub } {
  return { toastService: toastStub };
}
