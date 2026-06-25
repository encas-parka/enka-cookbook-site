/**
 * Filet anti-cassure lors d'une transition de Service Worker.
 *
 * Contexte : pendant un déploiement, l'ancienne page peut référencer un chunk
 * JS absent du nouveau precache et du serveur → `Failed to fetch dynamically
 * imported module`. Sans intervention, la route reste blanche. Ce filet tente
 * un reload de réparation : au reload, le SW actif sert les bons chunks.
 *
 * Anti-boucle : un flag binaire reset au `load` event ne fonctionne PAS (le
 * `load` vide le flag à chaque chargement, donc toute erreur persistante
 * devient une boucle infinie de reloads). On borne donc à MAX_RELOADS
 * tentatives consécutives via un compteur en sessionStorage, puis on abandonne.
 *
 * Réarmement : sessionStorage persiste à travers les reloads d'un même onglet
 * (voulu) mais est vidé à la fermeture de l'onglet (réarmement naturel). En
 * complément, `markBootSuccess()` réarme plus tôt : à appeler quand l'app a
 * démarré avec succès (`appState === "READY"` dans App.svelte), preuve que la
 * transition SW a réussi et que les chunks critiques sont valides.
 */

const MAX_RELOADS = 2;
const STORAGE_KEY = "sw-reload-count";

/**
 * Détecte une erreur de chargement de chunk (import dynamique échoué).
 * Couvre Chrome, Firefox et Safari.
 */
export function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /dynamically imported module|importing.*module.*script/i.test(
      error.message ?? "",
    )
  );
}

/**
 * Appelé sur `unhandledrejection` quand un chunk échoue à charger.
 * Déclenche au plus MAX_RELOADS reloads consécutifs, puis abandonne pour
 * éviter une boucle infinie. Le compteur est réarmé par `markBootSuccess()`.
 */
export function handleChunkError(): void {
  const count = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
  if (count >= MAX_RELOADS) {
    console.warn(
      `[SW] Chunk load error — ${MAX_RELOADS} tentatives épuisées, abandon (boucle évitée)`,
    );
    return;
  }
  console.warn(
    `[SW] Chunk load error — rechargement (tentative ${count + 1}/${MAX_RELOADS})`,
  );
  sessionStorage.setItem(STORAGE_KEY, String(count + 1));
  window.location.reload();
}

/**
 * À appeler quand l'app a démarré avec succès (appState READY).
 * Réarme le garde-fou pour les transitions SW futures.
 */
export function markBootSuccess(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
