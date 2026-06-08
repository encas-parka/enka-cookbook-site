/**
 * Palier 1b — ProductsStore purchase soft-delete & update
 *
 * Complements palier 1 (purchase-effect.test.ts) which tests ADDING a purchase.
 * This file tests two additional paths through the reconciler (#onDataChange):
 *
 * A1 — Soft-deleting a purchase (status → "deleted"):
 *   db.purchases.put({ ...existing, status: "deleted", $updatedAt: newer })
 *     → liveQuery re-fires → #onDataChange skips "deleted" purchases
 *     → product's purchases array shrinks
 *
 * A2 — Updating a purchase's quantity:
 *   db.purchases.put({ ...existing, quantity: newValue, $updatedAt: newer })
 *     → liveQuery re-fires → #onDataChange detects fingerprint change
 *     → product's purchases reflect the new quantity
 *
 * Uses the same harness pattern as palier 1 (mocked eventsStore, no real
 * eventsStore bridge needed — these tests don't involve $effect recalculation).
 */

// Mocks MUST be declared before importing the store under test
vi.mock("$lib/stores/EventsStore.svelte", () => ({
  eventsStore: {
    getEventById: vi.fn(),
    initialize: vi.fn(),
  },
}));

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {
    syncReady: Promise.resolve(),
    // FIXED value — prevents mealsHash mismatch on first $effect run
    getRecipeUpdatedAt: vi.fn(() => "2026-06-06T00:00:00.000Z"),
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
import fixture from "./fixtures/realistic/event-test-1.json";

const EVENT_ID = "6a23d13b0018fba53d3d";
const WATER_PRODUCT_ID = "eau_18fba53d3d";
// The single pre-existing purchase for the water product in the fixture
const WATER_PURCHASE_ID = "6a23d1c00007c646855f";

describe("ProductsStore — purchase soft-delete & update (palier 1b)", () => {
  beforeEach(async () => {
    productsStore.reset();
    installStubAppwrite();
    await clearDexie();
    const { event } = await seedDexie(fixture);
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === EVENT_ID ? event : null),
    );
    await productsStore.initialize(EVENT_ID);
  });

  it("A1 — soft-deleting a purchase removes it from the product's stats", async () => {
    await waitForTick(5);

    // Sanity: the water product has exactly 1 purchase from the fixture
    const before = productsStore.getEnrichedProductById(WATER_PRODUCT_ID);
    expect(before).not.toBeNull();
    expect(before!.purchases.length).toBe(1);
    expect(before!.purchases[0].$id).toBe(WATER_PURCHASE_ID);

    // Soft-delete: update status to "deleted" (what the UI does via deletePurchase)
    const rawPurchase = await db.purchases.get(WATER_PURCHASE_ID);
    expect(rawPurchase).not.toBeNull();
    await db.purchases.put({
      ...rawPurchase!,
      status: "deleted",
      $updatedAt: new Date().toISOString(),
    });

    await waitForTick(5);

    // The purchase should no longer appear in the product's purchases array
    const after = productsStore.getEnrichedProductById(WATER_PRODUCT_ID);
    expect(after).not.toBeNull();
    expect(after!.purchases.length).toBe(0);
  });

  it("A2 — updating a purchase's quantity reflects in the product's stats", async () => {
    await waitForTick(5);

    // Sanity: fixture purchase has quantity=960 for the water product
    const before = productsStore.getEnrichedProductById(WATER_PRODUCT_ID);
    expect(before).not.toBeNull();
    expect(before!.purchases.length).toBe(1);
    expect(before!.purchases[0].quantity).toBe(960);

    // Update quantity (simulates what updatePurchase does)
    const rawPurchase = await db.purchases.get(WATER_PURCHASE_ID);
    expect(rawPurchase).not.toBeNull();
    await db.purchases.put({
      ...rawPurchase!,
      quantity: 2000,
      $updatedAt: new Date().toISOString(),
    });

    await waitForTick(5);

    // The purchase should reflect the new quantity
    const after = productsStore.getEnrichedProductById(WATER_PRODUCT_ID);
    expect(after).not.toBeNull();
    expect(after!.purchases.length).toBe(1);
    expect(after!.purchases[0].quantity).toBe(2000);
  });

  it("A1+A2 combined — soft-delete then re-add a different purchase for the same product", async () => {
    await waitForTick(5);

    // Step 1: Soft-delete the fixture purchase
    const rawPurchase = await db.purchases.get(WATER_PURCHASE_ID);
    await db.purchases.put({
      ...rawPurchase!,
      status: "deleted",
      $updatedAt: new Date().toISOString(),
    });
    await waitForTick(5);

    const afterDelete = productsStore.getEnrichedProductById(WATER_PRODUCT_ID);
    expect(afterDelete!.purchases.length).toBe(0);

    // Step 2: Add a brand-new purchase (same product, different quantity)
    await db.purchases.put({
      $id: "test-purchase-replacement",
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
    });
    await waitForTick(5);

    const afterReAdd = productsStore.getEnrichedProductById(WATER_PRODUCT_ID);
    expect(afterReAdd).not.toBeNull();
    expect(afterReAdd!.purchases.length).toBe(1);
    expect(afterReAdd!.purchases[0].$id).toBe("test-purchase-replacement");
    expect(afterReAdd!.purchases[0].quantity).toBe(500);
  });
});
