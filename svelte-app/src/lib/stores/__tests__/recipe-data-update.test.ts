/**
 * Palier 3 — ProductsStore recipeData update → productNeeds recalculation
 *
 * Validates the full reactive chain when an Appwrite recipe is updated:
 *   db.recipes.put(updated recipe)
 *     → bridge liveQuery → #appwriteRecipes SvelteMap → getRecipeUpdatedAt() changes
 *     → ProductsStore $effect detects mealsHash change → #syncWithEventMeals
 *     → createEnrichedProductsFromEvent (with new ingredients) → db.productNeeds.bulkPut
 *
 * Production flow being tested:
 *   When a user edits a Hugo recipe, an Appwrite version is created/updated
 *   (via updateRecipeAppwrite). The Appwrite version takes priority over Hugo.
 *   The realtime sync updates db.recipes → bridge detects change → getRecipeUpdatedAt
 *   returns a new timestamp → ProductsStore $effect triggers recalculation.
 *
 * This test simulates the post-realtime-write state: the updated recipe is written
 * directly to db.recipes, which is what the store sees after a real Appwrite update.
 *
 * Uses REAL recipesStore (bridge is reactive) and REAL eventsStore (from palier 2).
 * Only toastService is mocked.
 */

vi.mock("$lib/services/toast.service.svelte", () => ({
  toastService: {
    track: vi.fn(async (promise: Promise<unknown>) => promise),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "test-user",
    isAuthenticated: true,
    userTeams: [] as string[],
  },
}));

import { describe, it, expect, beforeEach, vi } from "vitest";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import { db } from "$lib/db-sync/aw-sync";
import { bootstrapEventsStore } from "./harness/bootstrap-events-store";
import { waitForTick } from "./harness/wait-for-tick";
import {
  hugoToAppwriteRecipe,
  doubleIngredientQuantities,
} from "./harness/hugo-to-appwrite-recipe";
import fixture from "./fixtures/realistic/event-test-1.json";

const EVENT_ID = "6a23d13b0018fba53d3d";
// Recipe UUID used in meal[0] of the fixture event
const RECIPE_UUID = "chorizo-vegan_gqf4yi01uime";
const INITIAL_UPDATED_AT = "2026-06-06T00:00:00.000Z";
const MODIFIED_UPDATED_AT = "2026-06-07T00:00:00.000Z";

/**
 * Sum all totalNeededArray quantities across all needs for comparison.
 * Reused from palier 2.
 */
function sumTotalNeeded(needs: any[]): number {
  return needs.reduce((sum, n) => {
    const arr =
      typeof n.totalNeededArray === "string"
        ? JSON.parse(n.totalNeededArray)
        : n.totalNeededArray;
    return sum + arr.reduce((s: number, e: any) => s + e.q, 0);
  }, 0);
}

describe("ProductsStore — recipeData update → productNeeds recalc (palier 3)", () => {
  beforeEach(async () => {
    // 1. Bootstrap real eventsStore (installs stubs, seeds Dexie, loadCache)
    await bootstrapEventsStore(fixture);

    // 2. Prepare recipesStore — reset in-memory state, bridge stays alive
    recipesStore.reset();
    await waitForTick(3);

    // 3. Clear leftover Appwrite recipes from previous test runs
    await db.recipes.clear();

    // 4. Load cache (reads Hugo recipes from db.recipeData → #hugoRecipes)
    await recipesStore.loadCache();

    // 5. Verify bridge is empty (no Appwrite recipe yet — fixture has 0 in db.recipes)
    expect(recipesStore.getRecipeUpdatedAt(RECIPE_UUID)).toBeUndefined();

    // 6. Inject Appwrite recipe derived from the Hugo detail
    //    This simulates what happens when a user edits a Hugo recipe:
    //    the Appwrite version is created and takes priority.
    const hugoRow = await db.recipeData.get(`detail:${RECIPE_UUID}`);
    expect(hugoRow).not.toBeNull();

    const initialAppwriteRecipe = hugoToAppwriteRecipe(hugoRow!.data, {
      $updatedAt: INITIAL_UPDATED_AT,
    });
    await db.recipes.put(initialAppwriteRecipe);

    // Wait for bridge to detect → #appwriteRecipes updates
    await waitForTick(5);

    // 7. Verify bridge is now reactive for this recipe
    expect(recipesStore.getRecipeUpdatedAt(RECIPE_UUID)).toBe(
      INITIAL_UPDATED_AT,
    );

    // 8. Initialize ProductsStore
    await productsStore.softReset();
    await productsStore.initialize(EVENT_ID);
    await waitForTick(8);
  });

  it("doubling recipe ingredient quantities recalculates productNeeds with higher totals", async () => {
    // Sanity: eventsStore and recipesStore are reactive
    const event = eventsStore.getEventById(EVENT_ID);
    expect(event).not.toBeNull();
    expect(recipesStore.getRecipeUpdatedAt(RECIPE_UUID)).toBe(
      INITIAL_UPDATED_AT,
    );

    // Capture initial productNeeds
    const needsBefore = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();
    expect(needsBefore.length).toBeGreaterThan(0);
    const totalBefore = sumTotalNeeded(needsBefore);

    // ACTION: Modify the Appwrite recipe — double all ingredient quantities
    // This simulates the post-realtime state after a user edits the recipe.
    const hugoRow = await db.recipeData.get(`detail:${RECIPE_UUID}`);
    const modifiedDetail = doubleIngredientQuantities(hugoRow!.data);
    const modifiedAppwriteRecipe = hugoToAppwriteRecipe(modifiedDetail, {
      $updatedAt: MODIFIED_UPDATED_AT,
    });
    await db.recipes.put(modifiedAppwriteRecipe);

    // Wait for the full reactive chain:
    // bridge liveQuery → #appwriteRecipes → getRecipeUpdatedAt → $effect → recalc
    await waitForTick(15);

    // ASSERT: getRecipeUpdatedAt now returns the new timestamp
    expect(recipesStore.getRecipeUpdatedAt(RECIPE_UUID)).toBe(
      MODIFIED_UPDATED_AT,
    );

    // ASSERT: productNeeds were recalculated with higher quantities
    const needsAfter = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();
    expect(needsAfter.length).toBeGreaterThan(0);
    const totalAfter = sumTotalNeeded(needsAfter);
    expect(totalAfter).toBeGreaterThan(totalBefore);
  });

  it("removing a unique ingredient from recipe deletes the corresponding productNeed", async () => {
    // Capture initial productNeeds for the event
    const needsBefore = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();
    const countBefore = needsBefore.length;

    // Verify "liquid-smoke" need exists before modification
    const liquidSmokeNeed = needsBefore.find((n) =>
      n.productName.toLowerCase().includes("liquid"),
    );
    expect(liquidSmokeNeed).toBeDefined();
    expect(liquidSmokeNeed!.nbRecipes).toBe(1);

    // Get the Hugo recipe detail
    const hugoRow = await db.recipeData.get(`detail:${RECIPE_UUID}`);
    const detail = hugoRow!.data;

    // Remove the "Liquid smoke" ingredient (uuid: effe0c)
    const modifiedDetail = {
      ...detail,
      ingredients: detail.ingredients.filter(
        (ing: any) => ing.name !== "Liquid smoke",
      ),
    };

    const modifiedAppwriteRecipe = hugoToAppwriteRecipe(modifiedDetail, {
      $updatedAt: MODIFIED_UPDATED_AT,
    });
    await db.recipes.put(modifiedAppwriteRecipe);

    // Wait for the full reactive chain:
    // bridge liveQuery → #appwriteRecipes → getRecipeUpdatedAt → $effect → recalc + stale cleanup
    await waitForTick(15);

    // ASSERT: getRecipeUpdatedAt reflects the change
    expect(recipesStore.getRecipeUpdatedAt(RECIPE_UUID)).toBe(
      MODIFIED_UPDATED_AT,
    );

    // ASSERT: liquid smoke productNeed has been deleted by stale cleanup
    const needsAfter = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();

    const liquidSmokeAfter = needsAfter.find((n) =>
      n.productName.toLowerCase().includes("liquid"),
    );
    expect(liquidSmokeAfter).toBeUndefined();

    // ASSERT: total productNeeds count decreased
    expect(needsAfter.length).toBeLessThan(countBefore);
  });
});
