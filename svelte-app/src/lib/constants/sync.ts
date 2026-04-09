/**
 * Version du cache de synchronisation
 *
 * Bump cette valeur quand un changement de Query.limit() ou de logique de fetch
 * nécessite un re-chargement complet des données côté client.
 *
 * Mécanisme :
 * - Chaque store compare CACHE_SYNC_VERSION avec le syncVersion stocké dans son cache IDB
 * - Si absent ou inférieur → nullifie lastSync → force un full fetch au prochain syncFromRemote()
 * - Sauvegarde la nouvelle version dans le cache
 *
 * À retirer quand tous les utilisateurs auront eu au moins une session avec la version courante.
 */
export const CACHE_SYNC_VERSION = 2;
