/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore reactivity — sync initiale → mutation réactive (port adapté pb-sync).
 *
 * Validates the basic reactive chain against the FAKE PocketBase transport:
 * a real `initialFetch` (delta cursor over PB-format dates) fills Dexie,
 * then a Dexie write propagates through `liveQuery` → `#onDataChange` →
 * `#productModels` → `getEnrichedProductById()`.
 *
 * Exercises:
 *  - fake-indexeddb (real Dexie) + real Svelte 5 reactivity (no mocking of
 *    the reactive layer — requires `conditions: ["browser"]` in vitest.config)
 *  - the fake PocketBase SDK (no network) with contract-faithful records
 *    (`PbDoc { id, created, updated }`, PB datetime `YYYY-MM-DD HH:mm:ss.SSSZ`)
 *  - mocked singleton stores (eventsStore, recipesStore, globalState)
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
    // Fixed value: a fresh timestamp per call would flip the meals hash
    // between initialize() and the first $effect run, triggering an
    // unwanted needs recalc that would overwrite the seeded productNeeds.
    getRecipeUpdatedAt: vi.fn(),
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

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate } from "./harness/stub-pb";
import { clearDexie, seedProductNeeds } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import {
  makeEvent,
  makeNeedRow,
  makeProductRecord,
  makePurchaseRecord,
  TEST_EVENT_ID,
  TEST_PRODUCT_ID,
  T1,
} from "./harness/fixtures";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { db } from "$lib/db-sync/pb-sync";

describe("ProductsStore — sync initiale + réactivité (pb-sync)", () => {
  beforeEach(async () => {
    const fakePb = currentFakePb();
    fakePb.reset();
    // softReset: in-memory store state + Dexie tables (products/purchases/productNeeds)
    await productsStore.softReset();
    await clearDexie();

    // Server-side data — flows into Dexie through the REAL initialFetch
    fakePb.seed("products", [makeProductRecord()]);
    fakePb.seed("purchases", [makePurchaseRecord()]);
    // Locally-computed needs — seeded so initialize() skips recalculation
    await seedProductNeeds([makeNeedRow()]);

    const event = makeEvent();
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === TEST_EVENT_ID ? event : null),
    );

    await productsStore.initialize(TEST_EVENT_ID);
    // Let the liveQuery fire and #onDataChange build the models
    await waitForTick(5);
  });

  it("initialFetch peuplé depuis le serveur PB → modèles enrichis réactifs", () => {
    const model = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(model).not.toBeNull();
    // Product record (PB) merged over the seeded need row → isSynced
    expect(model!.isSynced).toBe(true);
    expect(model!.productName).toBe("Eau");
    // The purchase synced from the fake PB server is attached
    expect(model!.purchases).toHaveLength(1);
    expect(model!.purchases[0].id).toBe("t12purchase0001");
  });

  it("écriture Dexie brute → liveQuery → modèle mis à jour (réactivité pure)", async () => {
    const before = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(before).not.toBeNull();
    expect(before!.purchases).toHaveLength(1);

    const newPurchase = makePurchaseRecord({
      id: "t12purchase0002",
      updated: pbDate(T1),
    });
    await db.purchases.put(newPurchase);
    await waitForTick(5);

    const after = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(after!.purchases).toHaveLength(2);
    expect(after!.purchases.map((p) => p.id)).toContain("t12purchase0002");
  });
});
