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
 * Ce guard initialise seulement le store selon le mode :
 * - Utilisateur authentifié → mode normal
 * - Non authentifié → mode public (pour l'event démo)
 *
 * La sécurité (permissions, accès) est gérée par Appwrite au niveau backend.
 * Ce guard évite juste d'initialiser le store plusieurs fois.
 *
 * Utilisation :
 * '/event/:id': {
 *   hooks: eventGuard,
 *   '/': EventEditPage
 * }
 */
export const eventGuard: Hooks = {
  async beforeLoad() {
    // Initialiser le store une seule fois
    if (!eventsStore.isInitialized) {
      if (globalState.isAuthenticated) {
        // Mode normal : utilisateur connecté
        console.log("[EventGuard] Mode normal > initialize");
        await eventsStore.initialize();
      } else {
        // Mode public : pour l'event démo
        console.log("[EventGuard] Mode public > initializeForPublic");
        await eventsStore.initializeForPublic();
      }
    }

    console.log("[EventGuard] ✅ Store initialisé");
  },
};
