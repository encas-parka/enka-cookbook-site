/**
 * ProductsStore — Product merge + purchase remapping (scenario C1)
 *
 * Validates the reconciler's merge logic:
 *   db.products.put({ ...source, mergedInto: targetId })
 *     → liveQuery re-fires → #onDataChange remaps source purchases to target
 *     → source disappears from productModels
 *     → target aggregates source data (mergedFrom, purchases)
 *
 * Uses mock stores (palier 1 pattern) — no cross-store reactivity needed.
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
const SOURCE_PRODUCT_ID = "source-merge-test_18fba53d3d";
const TARGET_PRODUCT_ID = "target-merge-test_18fba53d3d";

const now = new Date().toISOString();

describe("ProductsStore — product merge + purchase remapping (C1)", () => {
  beforeEach(async () => {
    productsStore.reset();
    installStubAppwrite();
    await clearDexie();
    const { event } = await seedDexie(fixture);
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === EVENT_ID ? event : null),
    );

    // Create two products in db.products for the merge test
    await db.products.bulkPut([
      {
        $id: SOURCE_PRODUCT_ID,
        $createdAt: now,
        $updatedAt: now,
        mainId: EVENT_ID,
        productName: "Source Product",
        productType: "test",
        productHugoUuid: "source-merge-test",
        pF: false,
        pS: false,
        mergedInto: null,
        store: "store-a",
        status: "active",
        stockReel: null,
        who: null,
        previousNames: null,
        mergeDate: null,
        isSynced: true,
        totalNeededOverride: null,
        updatedBy: null,
        specs: null,
      },
      {
        $id: TARGET_PRODUCT_ID,
        $createdAt: now,
        $updatedAt: now,
        mainId: EVENT_ID,
        productName: "Target Product",
        productType: "test",
        productHugoUuid: "target-merge-test",
        pF: false,
        pS: false,
        mergedInto: null,
        store: "store-b",
        status: "active",
        stockReel: null,
        who: null,
        previousNames: null,
        mergeDate: null,
        isSynced: true,
        totalNeededOverride: null,
        updatedBy: null,
        specs: null,
      },
    ]);

    // Create one purchase for each product
    await db.purchases.bulkPut([
      {
        $id: "purchase-source-merge",
        $createdAt: now,
        $updatedAt: now,
        mainId: EVENT_ID,
        products: [SOURCE_PRODUCT_ID],
        quantity: 100,
        unit: "gr.",
        store: "store-a",
        status: "ordered",
        notes: "",
        price: 10,
        who: "alice",
        createdBy: null,
        orderDate: null,
        deliveryDate: null,
        invoiceId: null,
        invoiceTotal: null,
      },
      {
        $id: "purchase-target-merge",
        $createdAt: now,
        $updatedAt: now,
        mainId: EVENT_ID,
        products: [TARGET_PRODUCT_ID],
        quantity: 200,
        unit: "gr.",
        store: "store-b",
        status: "ordered",
        notes: "",
        price: 20,
        who: "bob",
        createdBy: null,
        orderDate: null,
        deliveryDate: null,
        invoiceId: null,
        invoiceTotal: null,
      },
    ]);

    // Also create productNeeds for both so they show up in reconciler
    await db.productNeeds.bulkPut([
      {
        $id: SOURCE_PRODUCT_ID,
        mainId: EVENT_ID,
        productHugoUuid: "source-merge-test",
        productName: "Source Product",
        productType: "test",
        pF: false,
        pS: false,
        byDate: "{}",
        totalNeededArray: JSON.stringify([{ q: 100, u: "gr." }]),
        nbRecipes: 1,
        totalAssiettes: 10,
        dateDisplayInfo: "{}",
        $createdAt: now,
        $updatedAt: now,
      },
      {
        $id: TARGET_PRODUCT_ID,
        mainId: EVENT_ID,
        productHugoUuid: "target-merge-test",
        productName: "Target Product",
        productType: "test",
        pF: false,
        pS: false,
        byDate: "{}",
        totalNeededArray: JSON.stringify([{ q: 200, u: "gr." }]),
        nbRecipes: 1,
        totalAssiettes: 20,
        dateDisplayInfo: "{}",
        $createdAt: now,
        $updatedAt: now,
      },
    ]);

    await productsStore.initialize(EVENT_ID);
    await waitForTick(5);
  });

  it("merging source into target remaps purchases and hides source", async () => {
    // Sanity: both products exist with 1 purchase each
    const sourceBefore = productsStore.getEnrichedProductById(SOURCE_PRODUCT_ID);
    const targetBefore = productsStore.getEnrichedProductById(TARGET_PRODUCT_ID);
    expect(sourceBefore).not.toBeNull();
    expect(targetBefore).not.toBeNull();
    expect(sourceBefore!.purchases.length).toBe(1);
    expect(targetBefore!.purchases.length).toBe(1);
    expect(sourceBefore!.purchases[0].$id).toBe("purchase-source-merge");
    expect(targetBefore!.purchases[0].$id).toBe("purchase-target-merge");

    // ACTION: Merge source → target by setting mergedInto on source
    const sourceProduct = await db.products.get(SOURCE_PRODUCT_ID);
    expect(sourceProduct).not.toBeNull();
    await db.products.put({
      ...sourceProduct!,
      mergedInto: TARGET_PRODUCT_ID,
      $updatedAt: new Date().toISOString(),
    });

    await waitForTick(8);

    // ASSERT: Source has disappeared from productModels
    const sourceAfter = productsStore.getEnrichedProductById(SOURCE_PRODUCT_ID);
    expect(sourceAfter).toBeNull();

    // ASSERT: Target now has 2 purchases (remapped)
    const targetAfter = productsStore.getEnrichedProductById(TARGET_PRODUCT_ID);
    expect(targetAfter).not.toBeNull();
    expect(targetAfter!.purchases.length).toBe(2);

    // ASSERT: Purchase IDs are correct
    const purchaseIds = targetAfter!.purchases.map((p) => p.$id).sort();
    expect(purchaseIds).toEqual([
      "purchase-source-merge",
      "purchase-target-merge",
    ]);

    // ASSERT: Target has mergedFrom info
    expect(targetAfter!.mergedFrom).toBeDefined();
    expect(targetAfter!.mergedFrom.length).toBe(1);
    expect(targetAfter!.mergedFrom[0].id).toBe(SOURCE_PRODUCT_ID);
    expect(targetAfter!.mergedFrom[0].name).toBe("Source Product");
  });

  it("merged source purchase details are preserved in target", async () => {
    // Merge first
    const sourceProduct = await db.products.get(SOURCE_PRODUCT_ID);
    await db.products.put({
      ...sourceProduct!,
      mergedInto: TARGET_PRODUCT_ID,
      $updatedAt: new Date().toISOString(),
    });
    await waitForTick(8);

    const target = productsStore.getEnrichedProductById(TARGET_PRODUCT_ID);
    expect(target).not.toBeNull();

    // Find the remapped source purchase
    const sourcePurchase = target!.purchases.find(
      (p) => p.$id === "purchase-source-merge",
    );
    expect(sourcePurchase).toBeDefined();
    expect(sourcePurchase!.quantity).toBe(100);
    expect(sourcePurchase!.price).toBe(10);
    expect(sourcePurchase!.who).toBe("alice");

    // Find the original target purchase
    const targetPurchase = target!.purchases.find(
      (p) => p.$id === "purchase-target-merge",
    );
    expect(targetPurchase).toBeDefined();
    expect(targetPurchase!.quantity).toBe(200);
    expect(targetPurchase!.price).toBe(20);
    expect(targetPurchase!.who).toBe("bob");
  });
});
