/**
 * ProductsStore — Meal removal → stale productNeeds cleanup (scenario A3)
 *
 * Validates that when a meal is removed from the event, the stale
 * productNeeds for ingredients that only appeared in that meal are deleted:
 *   db.events.put(event without meal[1])
 *     → eventsStore bridge liveQuery → SvelteMap → getEventById updated
 *     → ProductsStore $effect detects mealsHash change → #syncWithEventMeals
 *     → createEnrichedProductsFromEvent (fewer recipes) → stale cleanup
 *     → productNeeds for meal[1]-only ingredients are deleted
 *
 * Uses REAL eventsStore (reactive bridge) + mocked recipesStore.
 * Same pattern as palier 2 (meals-plates-recalc.test.ts).
 */

// Mocks MUST be declared before importing stores
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

describe("ProductsStore — meal removal → stale productNeeds cleanup (A3)", () => {
  beforeEach(async () => {
    // Bootstrap real eventsStore (reactive) + seed Dexie
    await bootstrapEventsStore(fixture);

    // Reset and initialize ProductsStore
    await productsStore.softReset();
    await productsStore.initialize(EVENT_ID);

    // Wait for liveQuery to populate #productModels + first $effect to settle
    await waitForTick(8);
  });

  it("removing a meal deletes productNeeds for its unique ingredients", async () => {
    // Sanity: event has 2 meals
    const eventBefore = eventsStore.getEventById(EVENT_ID);
    expect(eventBefore).not.toBeNull();
    expect(eventBefore!.meals.length).toBe(2);

    // Capture initial productNeeds
    const needsBefore = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();
    const countBefore = needsBefore.length;
    expect(countBefore).toBeGreaterThan(0);

    // Ingredients unique to meal[1] recipes (Salade Fatouche + Lasagnes De Pois Cassés)
    // that do NOT appear in meal[0] recipes (Chorizo Vegan + Moussaka Végé).
    // Use exact names to avoid false positives (e.g., "Beurre demi-sel" contains "sel").
    const meal1OnlyNames = [
      "Concombre",
      "Laitue romaine",
      "Lasagnes",
      "Menthe fraîche",
      "Persil frais",
      "Pois cassés",
      "Radis",
      "Sel",
      "Poivre",
      "Lait écrémé",
      "Graine de tournesol",
      "Graines de courge",
    ];
    const meal1OnlyNeeds = needsBefore.filter((n) =>
      meal1OnlyNames.includes(n.productName),
    );
    expect(meal1OnlyNeeds.length).toBeGreaterThan(0);

    // ACTION: Remove meal[1] (matin, 90 guests) from the event via Dexie write
    const rawEvent = await db.events.get(EVENT_ID);
    expect(rawEvent).not.toBeNull();

    // Meals are stored as JSON strings (Appwrite format)
    const parsedMeals = (rawEvent!.meals as string[]).map((m: string) =>
      JSON.parse(m),
    );
    // Keep only meal[0] (soir, 120 guests with Chorizo Vegan + Moussaka Végé)
    const reducedMeals = [JSON.stringify(parsedMeals[0])];

    await db.events.put({
      ...rawEvent!,
      meals: reducedMeals,
      $updatedAt: new Date().toISOString(),
    });

    // Wait for the full reactive chain:
    // liveQuery → eventsStore SvelteMap → getEventById → $effect → #syncWithEventMeals → stale cleanup
    await waitForTick(12);

    // ASSERT: eventsStore reflects the change
    const eventAfter = eventsStore.getEventById(EVENT_ID);
    expect(eventAfter).not.toBeNull();
    expect(eventAfter!.meals.length).toBe(1);
    expect(eventAfter!.meals[0].id).toBe("RFRjp_");

    // ASSERT: productNeeds count decreased
    const needsAfter = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();
    expect(needsAfter.length).toBeLessThan(countBefore);

    // ASSERT: meal[1]-only productNeeds have been deleted (stale cleanup)
    for (const name of meal1OnlyNames) {
      const found = needsAfter.find((n) => n.productName === name);
      expect(
        found,
        `Expected "${name}" to be deleted but it still exists`,
      ).toBeUndefined();
    }

    // ASSERT: products from meal[0] (shared across both meals) are preserved
    // e.g., "ail" (garlic) appears in recipes from both meals
    const garlicNeed = needsAfter.find((n) => n.productName === "Ail");
    expect(garlicNeed).toBeDefined();
  });

  it("removing a meal preserves products shared across meals", async () => {
    const needsBefore = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();

    // "Ail" (garlic) appears in 3 recipes across both meals → should survive
    const garlicBefore = needsBefore.find((n) => n.productName === "Ail");
    expect(garlicBefore).toBeDefined();

    // "huile d'olive" (lowercase h in fixture) appears in 4 recipes → should survive
    const oilBefore = needsBefore.find(
      (n) => n.productName.toLowerCase() === "huile d'olive",
    );
    expect(oilBefore).toBeDefined();

    // Remove meal[1]
    const rawEvent = await db.events.get(EVENT_ID);
    const parsedMeals = (rawEvent!.meals as string[]).map((m: string) =>
      JSON.parse(m),
    );
    const reducedMeals = [JSON.stringify(parsedMeals[0])];
    await db.events.put({
      ...rawEvent!,
      meals: reducedMeals,
      $updatedAt: new Date().toISOString(),
    });
    await waitForTick(12);

    const needsAfter = await db.productNeeds
      .where("mainId")
      .equals(EVENT_ID)
      .toArray();

    // Shared products survive (but their quantities decrease since meal[1] is gone)
    const garlicAfter = needsAfter.find((n) => n.productName === "Ail");
    expect(garlicAfter).toBeDefined();

    const oilAfter = needsAfter.find(
      (n) => n.productName.toLowerCase() === "huile d'olive",
    );
    expect(oilAfter).toBeDefined();

    // Quantities should be lower (fewer meals = less total needed)
    const sumQ = (n: any) => {
      const arr =
        typeof n.totalNeededArray === "string"
          ? JSON.parse(n.totalNeededArray)
          : n.totalNeededArray;
      return arr.reduce((s: number, e: any) => s + e.q, 0);
    };

    expect(sumQ(garlicAfter!)).toBeLessThan(sumQ(garlicBefore!));
    expect(sumQ(oilAfter!)).toBeLessThan(sumQ(oilBefore!));
  });
});
