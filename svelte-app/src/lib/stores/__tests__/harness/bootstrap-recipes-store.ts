/**
 * Bootstrap a real RecipesStore for integration tests.
 *
 * Why a real store (not mocked):
 * - ProductsStore's $effect reads `recipesStore.getRecipeUpdatedAt()` which returns
 *   from a SvelteMap (#appwriteRecipes) populated by a liveQuery on db.recipes.
 *   A mocked function is NOT reactive — changing its return value does NOT re-fire
 *   the $effect. Only the real bridge (Dexie liveQuery → SvelteMap) makes
 *   getRecipeUpdatedAt reactive.
 *
 * After this:
 * - `getRecipeUpdatedAt(uuid)` returns `$updatedAt` from the SvelteMap (reactive)
 * - `getRecipeByUuid(uuid)` finds Appwrite recipes via bridge, else Hugo from db.recipeData
 *
 * IMPORTANT: To trigger a recalculation in ProductsStore, you must update `db.recipes`
 * (not just `db.recipeData`), because `getRecipeUpdatedAt` only reads from the
 * Appwrite bridge (db.recipes → liveQuery → SvelteMap).
 */
import { vi } from "vitest";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import { globalState } from "$lib/stores/GlobalState.svelte";
import { installStubAppwrite } from "./stub-appwrite";
import { seedDexie, type Fixture, type SeedResult } from "./seed-dexie";
import { waitForTick } from "./wait-for-tick";

export interface BootRecipesResult extends SeedResult {
  /** The recipesStore bridge is live and reactive. */
}

/**
 * Bootstrap a real RecipesStore with Dexie seeded from a fixture.
 *
 * Steps:
 * 1. Install fresh Appwrite stubs
 * 2. Ensure globalState.isAuthenticated
 * 3. softReset() — clears in-memory + Dexie, keeps bridge alive
 * 4. Seed Dexie with fixture data
 * 5. Wait for bridge liveQuery to propagate
 * 6. loadCache() — sets isInitialized=true
 */
export async function bootstrapRecipesStore(
  fixture: Fixture,
): Promise<BootRecipesResult> {
  // 1. Fresh Appwrite stubs
  installStubAppwrite();

  // 2. Ensure globalState.isAuthenticated
  try {
    vi.spyOn(globalState, "isAuthenticated", "get").mockReturnValue(true);
  } catch {
    vi.restoreAllMocks();
    vi.spyOn(globalState, "isAuthenticated", "get").mockReturnValue(true);
  }

  // 3. Soft reset — clears state + Dexie, keeps bridge alive
  await recipesStore.softReset();

  // 4. Seed Dexie
  const seed = await seedDexie(fixture);

  // 5. Wait for bridge liveQuery to propagate db.recipes → SvelteMap
  await waitForTick(5);

  // 6. loadCache — loads Hugo recipes from db.recipeData + sets isInitialized
  await recipesStore.loadCache();

  return { eventId: seed.eventId, event: seed.event };
}
