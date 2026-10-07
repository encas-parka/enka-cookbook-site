/**
 * Fixtures réactives pour les tests pb-sync — compilées par le plugin Svelte
 * (extension .svelte.ts) pour produire de VRAIS proxies $state.
 *
 * Svelte 5 enveloppe toute lecture d'état `$state` dans un Proxy. Ce proxy
 * ne survit pas à un structured clone (IndexedDB) : `DataCloneError:
 * Proxy object could not be cloned`. C'est exactement le mécanisme du bug
 * P2 du handoff click-through 26-10-07 (EventEditPage passe son shadow
 * draft réactif à `collection.update()`).
 */

export interface ReactiveMeal {
  id: string;
  date: string;
  guests: number;
  recipes: { recipeUuid: string; plates: number }[];
}

/**
 * Retourne un tableau de meals sous proxy $state — la même référence
 * proxifiée que lirait `sortedMeals` dans EventEditPage.
 */
export function makeReactiveMeals(): ReactiveMeal[] {
  const meals = $state<ReactiveMeal[]>([
    {
      id: "meal1",
      date: "2026-10-14T20:00:00.000Z",
      guests: 100,
      recipes: [{ recipeUuid: "rec1", plates: 100 }],
    },
  ]);
  return meals;
}
