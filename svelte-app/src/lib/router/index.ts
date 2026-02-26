/**
 * Point d'entrée principal du routeur sv-router
 *
 * Ce fichier initialise le routeur et exporte une API unifiée pour toute l'application.
 *
 * Fonctionnalités :
 * - Configuration du mode hash avec base="#"
 * - Export des fonctions de navigation (navigate, p, isActive, preload)
 * - Export de l'objet route pour accéder aux params/query actuels
 * - Export du composant Router pour App.svelte
 *
 * Migration depuis simple-router :
 * - navigate() → Même API, fonctionne identiquement
 * - getParam('x') → route.params.x
 * - getQuery('x') → route.search.x
 * - router.path → route.pathname
 * - preloadRoute() → preload()
 * */

import { createRouter, Router as SvRouter, searchParams } from "sv-router";
import { routes } from "./routes";

/**
 * Création du routeur avec toutes les routes
 * sv-router génère automatiquement le typage des params
 */
export const { p, navigate, isActive, preload, route } = createRouter(routes);

/**
 * Composant Router à utiliser dans App.svelte
 *
 * IMPORTANT: Utiliser <Router base="#"> pour activer le mode hash
 * Cela permet à l'application de fonctionner avec des URLs like #/recipe/123
 *
 * Exemple dans App.svelte :
 * <Router base="#">
 *   <!-- Les routes sont rendues ici automatiquement -->
 * </Router>
 */
export const Router = SvRouter;

/**
 * searchParams - Manipulation réactive des query params
 *
 * Importé depuis sv-router, permet de lire et modifier les query params
 * de manière réactive avec automatique mise à jour de l'URL.
 *
 * @example
 * import { searchParams } from '$lib/router';
 *
 * // Lire
 * const tab = searchParams.get('tab');
 *
 * // Écrire
 * searchParams.set('tab', 'info');
 *
 * // Supprimer
 * searchParams.delete('tab');
 *
 * // Écouter les changements
 * $effect(() => {
 *   console.log('Tab changed:', searchParams.get('tab'));
 * });
 */
export { searchParams };

/**
 * isActiveLink - Utilitaire pour vérifier si un lien est actif
 *
 * Permet de styliser différemment les liens actifs dans la navigation.
 *
 * @example
 * import { isActiveLink } from '$lib/router';
 *
 * <a class:active={isActiveLink('/recipes')}>Recettes</a>
 */
export { isActiveLink } from "sv-router";

/**
 * blockNavigation - Fonction pour bloquer la navigation
 *
 * Utilisé dans UnsavedChangesGuard pour prévenir la perte de données.
 *
 * @example
 * import { blockNavigation } from '$lib/router';
 *
 * blockNavigation(() => {
 *   if (hasUnsavedChanges) {
 *     showWarning();
 *     return false; // Bloque la navigation
 *   }
 *   return true; // Autorise la navigation
 * });
 */
export { blockNavigation } from "sv-router";
