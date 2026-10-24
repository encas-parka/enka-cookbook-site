/**
 * Attend qu'une condition devienne vraie, en pollant par ticks.
 *
 * Pattern canonique (ADR 0004) pour toute chaîne async dont la durée n'est
 * pas bornée par un nombre de ticks connu — update optimiste + liveQuery +
 * propagation bridge (Dexie → SvelteMap → $derived). Sous charge (suite
 * complète en parallèle, un worker par fichier), cette propagation peut
 * dépasser n'importe quel budget de ticks figé : attendre la condition
 * observée plutôt qu'un compte rend le scénario déterministe.
 *
 * Échoue avec `description` en message si `maxTicks` est dépassé.
 *
 * @param flush appelé après chaque tick — les tests composants passent
 *   `flushSync` (Svelte) pour vider les effets de rendu ; les tests store
 *   n'en ont pas besoin.
 */
import { waitForTick } from "./wait-for-tick";

export async function waitForCondition(
  condition: () => boolean,
  description: string,
  maxTicks = 100,
  flush?: () => void,
): Promise<void> {
  for (let i = 0; i < maxTicks; i++) {
    if (condition()) return;
    await waitForTick(1);
    flush?.();
  }
  throw new Error(`Timeout : ${description}`);
}
