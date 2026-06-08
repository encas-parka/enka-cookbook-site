/**
 * Palier 2 — ProductsStore recipe.plates change → productNeeds recalculation
 *
 * Validates the full reactive chain when a meal's recipe.plates changes:
 *   db.events.put(changed event)
 *     → eventsStore bridge liveQuery → SvelteMap → $derived enrichedMap
 *     → ProductsStore $effect detects mealsHash change → #syncWithEventMeals
 *     → createEnrichedProductsFromEvent (scales by plates) → db.productNeeds.bulkPut
 *
 * WHY plates and not guests?
 *   In production, changing meal.guests triggers a $effect in EventMealCard.svelte
 *   that syncs recipe.plates = meal.guests for all recipes where hasOwnPlatesNb === false.
 *   The component THEN calls eventsStore.updateEvent() with plates already updated.
 *   So when Dexie receives the updated event, plates already reflect the new guests.
 *   The calculation engine (processMeal) uses recipe.plates, not meal.guests.
 *
 * This test simulates the post-component-write state: plates are doubled directly
 * in Dexie, which is what the store would see after a real UI guests change.
 *
 * Uses a REAL eventsStore (bootstrapped via bootstrapEventsStore) so that the
 * reactivity chain works end-to-end. Only recipesStore and toastService are mocked.
 */

// Mocks MUST be declared before importing stores
// recipesStore — mocked because its reactivity is not under test
vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    syncReady: Promise.resolve(),
    // FIXED value — prevents mealsHash from differing between initialize()
    // and the first $effect run (which would trigger an unwanted recalc)
    getRecipeUpdatedAt: vi.fn(() => "2026-06-06T00:00:00.000Z"),
    getRecipesByUuidsBulk: vi.fn(async (uuids: string[]) => {
      const { db } = await import("$lib/db-sync/aw-sync");
      const map = new Map();
      for (const uuid of uuids) {
        const row = await db.recipeData.get(`detail:${uuid}`);
        if (row?.data) map.set(uuid, row.data);
      }
      return map;
    }),
    getRecipeByUuid: vi.fn(async (uuid: string) => {
      const { db } = await import("$lib/db-sync/aw-sync");
      const row = await db.recipeData.get(`detail:${uuid}`);
      return (row?.data as any) ?? null;
    }),
  },
}));

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
import { db } from "$lib/db-sync/aw-sync";
import { bootstrapEventsStore } from "./harness/bootstrap-events-store";
import { waitForTick } from "./harness/wait-for-tick";
import fixture from "./fixtures/realistic/event-test-1.json";

const EVENT_ID = "6a23d13b0018fba53d3d";

describe("ProductsStore — recipe.plates change → productNeeds recalc (palier 2)", () => {
  beforeEach(async () => {
    // Bootstrap real eventsStore (reactive) + seed Dexie
    await bootstrapEventsStore(fixture);

    // Reset and initialize ProductsStore
    await productsStore.softReset();
    await productsStore.initialize(EVENT_ID);

    // Wait for liveQuery to populate #productModels + first $effect to settle
    await waitForTick(8);
  });

  it("doubling recipe.plates recalculates productNeeds with higher quantities", async () => {
    // Verify eventsStore is reactive — it should return our event
    const eventBefore = eventsStore.getEventById(EVENT_ID);
    expect(eventBefore).not.toBeNull();
    expect(eventBefore!.meals.length).toBeGreaterThan(0);

    // Capture initial productNeeds state
    const needsBefore = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();
    expect(needsBefore.length).toBeGreaterThan(0);

    // Record original plates — processMeal scales by recipe.plates / recipeBasePlates
    const originalPlates = eventBefore!.meals[0].recipes[0].plates;

    // ACTION: Double plates for all recipes in meal[0] via Dexie write.
    // This simulates what EventsStore would see after EventMealCard's $effect
    // synced plates = new guests value for hasOwnPlatesNb === false recipes.
    const rawEvent = await db.events.get(EVENT_ID);
    expect(rawEvent).not.toBeNull();

    // Meals are stored as JSON strings (Appwrite format) — parse, modify, re-serialize
    const parsedMeals = (rawEvent!.meals as string[]).map((m: string) => JSON.parse(m));
    // Double the plates for ALL recipes in meal[0]
    const modifiedRecipes = parsedMeals[0].recipes.map((r: any) => ({
      ...r,
      plates: r.plates * 2,
    }));
    parsedMeals[0] = { ...parsedMeals[0], recipes: modifiedRecipes };
    const updatedMeals = parsedMeals.map((m: any) => JSON.stringify(m));

    // Write to Dexie — bumps $updatedAt so bridgeToMap detects the change
    // (bridgeToMap compares $updatedAt to skip unchanged entries)
    await db.events.put({
      ...rawEvent!,
      meals: updatedMeals,
      $updatedAt: new Date().toISOString(),
    });

    // Wait for the full reactive chain to settle:
    // liveQuery → eventsStore SvelteMap → $derived → getEventById → $effect → recalc
    await waitForTick(10);

    // ASSERT: eventsStore picked up the Dexie change through the bridge
    const eventAfter = eventsStore.getEventById(EVENT_ID);
    expect(eventAfter).not.toBeNull();
    expect(eventAfter!.meals[0].recipes[0].plates).toBe(originalPlates * 2);

    // ASSERT: productNeeds were recalculated by ProductsStore $effect
    const needsAfter = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();
    expect(needsAfter.length).toBeGreaterThan(0);

    // Sum total quantities across ALL needs — doubling meal[0].plates must
    // increase the grand total (products from meal[0] get scaled up).
    // Comparing a single need is fragile: it may only appear in meal[1] (unchanged).
    const sumQ = (needs: any[]) =>
      needs.reduce((sum, n) => {
        const arr =
          typeof n.totalNeededArray === "string"
            ? JSON.parse(n.totalNeededArray)
            : n.totalNeededArray;
        return (
          sum + arr.reduce((s: number, e: any) => s + e.q, 0)
        );
      }, 0);

    const totalBefore = sumQ(needsBefore);
    const totalAfter = sumQ(needsAfter);
    expect(totalAfter).toBeGreaterThan(totalBefore);
  });
});
