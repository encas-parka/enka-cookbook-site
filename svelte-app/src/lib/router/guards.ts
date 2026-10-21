/**
 * Guards de route pour sv-router
 *
 * Ce fichier contient les guards qui protègent les routes auth-requises :
 * - authGuard : vérifie l'authentification (routes /dashboard, /recipe/*…)
 * - eventGuard : vérifie l'authentification puis initialise le cache EventsStore
 *
 * Invariant : la résolution du guard (redirect + feedback) précède TOUT accès
 * aux données — aucun store ne charge un cache pour un visiteur. Le feedback
 * est la modale de connexion elle-même (ouverte avec la cible mémorisée) :
 * un renvoi muet laisserait l'utilisateur sans explication sur l'accueil.
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

/**
 * Résout l'exigence d'authentification : si visiteur, ouvre la modale de
 * connexion en mémorisant la cible (elle sera rejouée après login) puis
 * déclenche la redirection vers l'accueil (via throw navigate, convention
 * sv-router beforeLoad). Ne retourne jamais si l'utilisateur n'est pas
 * connecté — le code qui suit est donc garanti post-auth.
 *
 * La modale porte le message : pas de toast d'erreur, il ne resterait qu'un
 * aller-retour sur `/` sans explication utile.
 */
function requireAuth(pathname: string): void {
  if (globalState.isAuthenticated) return;
  console.log(`[AuthGuard] Accès refusé à ${pathname} > Redirection /`);
  globalState.requestAuth(pathname);
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
 * Initialise ensuite le cache IndexedDB (~10ms), puis **matérialise l'event
 * ciblé** (`ensureEvent`) : le cache Dexie peut être vide (login après purge,
 * deep link), et une page qui monte sur `null` ne se rattrape pas toute seule
 * — `getEventById` confond « pas encore chargé » et « absent ». Cette attente
 * est bornée : au-delà, la navigation continue et la réactivité de la page
 * prend le relais.
 *
 * La synchronisation complète (syncInitial + setupRealtime) reste gérée en
 * arrière-plan par App.svelte / GlobalState.
 */
export const eventGuard: Hooks = {
  async beforeLoad({ pathname, params }) {
    requireAuth(pathname);

    if (eventsStore.isInitialized) {
      console.log("[EventGuard] ✅ Store déjà initialisé");
    } else {
      console.log("[EventGuard] Mode normal > loadCache (rapide)");
      await eventsStore.loadCache();
    }

    const eventId = params?.id;
    if (eventId) await eventsStore.ensureEvent(eventId);

    console.log("[EventGuard] ✅ Event prêt");
  },
};
