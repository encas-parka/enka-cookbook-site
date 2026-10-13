/**
 * Guards de route pour sv-router
 *
 * Ce fichier contient les guards qui protègent les routes auth-requises :
 * - authGuard : vérifie l'authentification (routes /dashboard, /recipe/*…)
 * - eventGuard : vérifie l'authentification puis initialise le cache EventsStore
 *
 * Invariant : la résolution du guard (redirect + feedback) précède TOUT accès
 * aux données — aucun store ne charge un cache pour un visiteur. Le redirect
 * est TOUJOURS accompagné d'un toast : un renvoi muet laisse l'utilisateur sans
 * explication sur la page d'accueil.
 *
 * Les hooks se déclarent sur un objet de route (`{ hooks, "/" }`) — jamais
 * attachés à la fonction composant : `matchRoute` de sv-router ne lit `hooks`
 * que sur les objets de route, la seconde forme est silencieusement ignorée.
 * Le test guards.test.ts épingle cette contrainte.
 */

import type { Hooks } from "sv-router";
import { navigate } from "$lib/router";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { toastService } from "$lib/services/toast.service.svelte";

/**
 * Résout l'exigence d'authentification : si visiteur, émet le feedback puis
 * déclenche la redirection vers l'accueil (via throw navigate, convention
 * sv-router beforeLoad). Ne retourne jamais si l'utilisateur n'est pas
 * connecté — le code qui suit est donc garanti post-auth.
 */
function requireAuth(pathname: string): void {
  if (globalState.isAuthenticated) return;
  console.log(`[AuthGuard] Accès refusé à ${pathname} > Redirection /`);
  toastService.error("Vous devez être connecté pour accéder à cette page.");
  throw navigate("/", { replace: true });
}

/**
 * Guard pour les routes nécessitant une authentification
 */
export const authGuard: Hooks = {
  async beforeLoad({ pathname }) {
    requireAuth(pathname);
  },
};

/**
 * Guard pour les routes events
 *
 * Vérifie d'abord l'authentification (sinon loadCache rejetterait
 * « Utilisateur non connecté » dans beforeLoad : sv-router quitte sans changer
 * l'arbre de composants → page vide sans feedback).
 *
 * Ce guard initialise ensuite uniquement le cache IndexedDB (~10ms).
 * La synchronisation (syncInitial + setupRealtime) est gérée
 * en arrière-plan par App.svelte, avec un toast "Mise à jour en cours...".
 *
 * L'UI s'affiche immédiatement avec les données du cache.
 */
export const eventGuard: Hooks = {
  async beforeLoad({ pathname }) {
    requireAuth(pathname);

    if (eventsStore.isInitialized) {
      console.log("[EventGuard] ✅ Store déjà initialisé");
      return;
    }

    console.log("[EventGuard] Mode normal > loadCache (rapide)");
    await eventsStore.loadCache();

    console.log("[EventGuard] ✅ Store prêt (cache chargé)");
  },
};
