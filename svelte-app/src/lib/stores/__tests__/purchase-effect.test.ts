/**
 * Palier 1 — ProductsStore purchase effect
 *
 * Validates the basic reactive chain: a Dexie purchase write propagates
 * through `liveQuery` → `#onDataChange` → `#productModels` → public
 * `getEnrichedProductById()` getter.
 *
 * This is the simplest possible integration scenario. It exercises:
 *  - Fake-indexeddb (real Dexie)
 *  - Real `SvelteMap` and `$derived` (no mocking of the reactive layer)
 *  - Stubbed Appwrite SDK (no network)
 *  - Mocked singleton stores (eventsStore, recipesStore, globalState)
 *
 * The fixture contains an `eau_*` product with 1 pre-existing purchase
 * (and 0 missing quantity). Adding a second purchase should expand the
 * `purchases` array and update `totalPurchasesArray`.
 */

// Mocks MUST be declared before importing the store under test
// (Vitest hoists `vi.mock` calls to the top of the file).
vi.mock("$lib/stores/EventsStore.svelte", () => ({
  eventsStore: {
    getEventById: vi.fn(),
    initialize: vi.fn(),
  },
}));

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    syncReady: Promise.resolve(),
    // MUST return a FIXED value: a fresh `new Date()` per call would make
    // `#lastMealsHash` differ between `initialize()` and the first $effect run,
    // triggering an unwanted recalc that bulkPuts an empty array over our
    // seeded productNeeds.
    getRecipeUpdatedAt: vi.fn(() => "2026-06-06T00:00:00.000Z"),
    // Used by #syncWithEventMeals (would be triggered by $effect if hash mismatched)
    getRecipesByUuidsBulk: vi.fn(async () => new Map()),
    getRecipeByUuid: vi.fn(async () => null),
  },
}));

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "test-user",
    isAuthenticated: true,
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

import { describe, it, expect, beforeEach, vi } from "vitest";
import { installStubAppwrite } from "./harness/stub-appwrite";
import { seedDexie, clearDexie } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { db } from "$lib/db-sync/aw-sync";
import type { Purchases } from "$lib/types/appwrite.d";
import fixture from "./fixtures/realistic/event-test-1.json";

const EVENT_ID = "6a23d13b0018fba53d3d";
// Composite productId: `{productNameSlug}_{eventIdShort}`
// (eventIdShort = first chars of $id, see ProductsStore enrichment logic)
const WATER_PRODUCT_ID = "eau_18fba53d3d";

describe("ProductsStore — purchase effect (palier 1)", () => {
  beforeEach(async () => {
    // Reset the singleton store so each test starts clean
    productsStore.reset();
    // Install fresh Appwrite stubs (returns new stubs object)
    installStubAppwrite();
    // Clear Dexie and seed with the fixture
    await clearDexie();
    const { event } = await seedDexie(fixture);
    // Wire the eventsStore mock to return the parsed seeded event
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === EVENT_ID ? event : null),
    );
    // Initialize the store — this:
    //  1. Reads the event via eventsStore.getEventById
    //  2. Calls initialFetch on both collections (stubbed, returns empty)
    //  3. Awaits recipesStore.syncReady (resolves immediately)
    //  4. Skips needs recalc (we already seeded 35 needs)
    //  5. Starts the liveQuery (fires async, populates #productModels)
    //  6. Subscribes to realtime (stubbed, no-op)
    await productsStore.initialize(EVENT_ID);
  });

  it("adding a purchase updates ProductModel stats for the linked product", async () => {
    // Wait for the liveQuery's initial fire to populate #productModels
    await waitForTick(5);

    const before = productsStore.getEnrichedProductById(WATER_PRODUCT_ID);
    expect(before).not.toBeNull();
    const beforePurchaseCount = before!.purchases.length;
    // Sanity check: the fixture has 1 purchase for the water product
    expect(beforePurchaseCount).toBeGreaterThan(0);

    // Add a new purchase linked to the water product
    const newPurchase: Purchases = {
      $id: "test-purchase-new",
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      mainId: EVENT_ID,
      products: [WATER_PRODUCT_ID],
      quantity: 500,
      unit: "gr.",
      store: null,
      status: "ordered",
      notes: "",
      price: null,
      who: null,
      createdBy: null,
      orderDate: null,
      deliveryDate: null,
      invoiceId: null,
      invoiceTotal: null,
    };

    await db.purchases.put(newPurchase);
    // Wait for the liveQuery to re-fire and #onDataChange to rebuild the model
    await waitForTick(5);

    const after = productsStore.getEnrichedProductById(WATER_PRODUCT_ID);
    expect(after).not.toBeNull();
    expect(after!.purchases.length).toBe(beforePurchaseCount + 1);
    expect(after!.purchases).toContainEqual(
      expect.objectContaining({ $id: "test-purchase-new" }),
    );
  });
});
