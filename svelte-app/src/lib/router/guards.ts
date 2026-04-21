/**
 * Guards de route pour sv-router
 *
 * Ce fichier contient le guard unifié qui protège les routes events :
 * - authGuard : Vérifie l'authentification et redirige vers /
 * - eventGuard : Initialise le cache EventsStore
 *
 * Le guard utilise le hook beforeLoad de sv-router.
 * Pour bloquer l'accès, on utilise throw navigate('/path').
 */

import type { Hooks } from "sv-router";
import { navigate } from "$lib/router";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";

/**
 * Guard pour les routes nécessitant une authentification
 */
export const authGuard: Hooks = {
  async beforeLoad({ pathname }) {
    if (!globalState.isAuthenticated) {
      console.log(`[AuthGuard] Accès refusé à ${pathname} > Redirection /`);
      throw navigate("/", { replace: true });
    }
  },
};

/**
 * Guard pour les routes events
 *
 * Ce guard initialise uniquement le cache IndexedDB (~10ms).
 * La synchronisation Appwrite (syncFromRemote + setupRealtime) est gérée
 * en arrière-plan par App.svelte, avec un toast "Mise à jour en cours...".
 *
 * L'UI s'affiche immédiatement avec les données du cache.
 *
 * La sécurité (permissions, accès) est gérée par Appwrite au niveau backend.
 */
export const eventGuard: Hooks = {
  async beforeLoad() {
    if (eventsStore.isInitialized) {
      console.log("[EventGuard] ✅ Store déjà initialisé");
      return;
    }

    console.log("[EventGuard] Mode normal > loadCache (rapide)");
    await eventsStore.loadCache();

    console.log("[EventGuard] ✅ Store prêt (cache chargé)");
  },
};
