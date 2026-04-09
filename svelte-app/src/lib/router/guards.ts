/**
 * Guards de route pour sv-router
 *
 * Ce fichier contient le guard unifié qui protège les routes events :
 * - eventGuard : Vérifie l'authentification et initialise le store selon le mode (démo vs normal)
 *
 * Le guard utilise le hook beforeLoad de sv-router.
 * Pour bloquer l'accès, on utilise throw navigate('/path').
 */

import type { Hooks } from "sv-router";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { toastService } from "$lib/services/toast.service.svelte";

/**
 * Guard intelligent pour les routes events (mode agnostic)
 *
 * Ce guard initialise le store selon le mode :
 * - Si l'utilisateur est authentifié : initialise en mode normal
 * - Si non authentifié : initialise en mode public (pour la démo)
 *
 * Utilisation :
 * '/dashboard': {
 *   hooks: authGuard,
 *   '/': DashboardPage
 * }
 */
export const authGuard: Hooks = {
  async beforeLoad({ pathname }) {
    if (!globalState.isAuthenticated) {
      console.log(`[AuthGuard] Accès refusé à ${pathname} > Redirection /`);
      // Import dynamique de navigate pour éviter l'erreur d'export
      const { navigate } = await import("$lib/router");
      throw navigate("/", { replace: true });
    }
  },
};

/**
 * Guard pour les routes events (mode agnostic)
 *
 * Ce guard initialise uniquement le cache IndexedDB (~10ms).
 * La synchronisation Appwrite (syncFromRemote + setupRealtime) est gérée
 * en arrière-plan par App.svelte, avec un toast "Mise à jour en cours...".
 *
 * L'UI s'affiche immédiatement avec les données du cache.
 *
 * La sécurité (permissions, accès) est gérée par Appwrite au niveau backend.
 *
 * Utilisation :
 * '/event/:id': {
 *   hooks: eventGuard,
 *   '/': EventEditPage
 * }
 */
export const eventGuard: Hooks = {
  async beforeLoad() {
    if (eventsStore.isInitialized) {
      console.log("[EventGuard] ✅ Store déjà initialisé");
      return;
    }

    if (globalState.isAuthenticated) {
      console.log("[EventGuard] Mode normal > loadCache (rapide)");
      await eventsStore.loadCache();
    } else {
      console.log("[EventGuard] Mode public > initializeForPublic");
      await eventsStore.initializeForPublic();
    }

    console.log("[EventGuard] ✅ Store prêt (cache chargé)");
  },
};
