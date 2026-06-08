/**
 * ProductsStore — financialStats with priced purchases (scenario D3)
 *
 * Validates the reactive chain:
 *   db.purchases.put(purchase with price)
 *     → liveQuery → #onDataChange → #purchasesByProductCache update
 *     → financialStats $derived recomputes
 *     → totalGlobal, byStore, byWho update
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
const WATER_PRODUCT_ID = "eau_18fba53d3d";
const GARLIC_PRODUCT_ID = "ail-en-poudre_18fba53d3d";
const WATER_PURCHASE_ID = "6a23d1c00007c646855f";

describe("ProductsStore — financialStats with priced purchases (D3)", () => {
  beforeEach(async () => {
    productsStore.reset();
    installStubAppwrite();
    await clearDexie();
    const { event } = await seedDexie(fixture);
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === EVENT_ID ? event : null),
    );
    await productsStore.initialize(EVENT_ID);
    await waitForTick(5);
  });

  it("starts with zero totalGlobal when all purchases have null price", async () => {
    const stats = productsStore.financialStats;
    expect(stats.totalGlobal).toBe(0);
    expect(stats.allPurchases.length).toBe(0);
  });

  it("adding a priced purchase increases totalGlobal by its price", async () => {
    expect(productsStore.financialStats.totalGlobal).toBe(0);

    // Add a priced purchase for the water product
    await db.purchases.put({
      $id: "test-priced-purchase-1",
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      mainId: EVENT_ID,
      products: [WATER_PRODUCT_ID],
      quantity: 500,
      unit: "ml",
      store: "leclerc",
      status: "ordered",
      notes: "",
      price: 42,
      who: "alice",
      createdBy: null,
      orderDate: null,
      deliveryDate: null,
      invoiceId: null,
      invoiceTotal: null,
    });

    await waitForTick(8);

    const stats = productsStore.financialStats;
    expect(stats.totalGlobal).toBe(42);
    expect(stats.byStore["leclerc"]).toBe(42);
    expect(stats.byWho["alice"]).toBe(42);
    expect(stats.allPurchases.length).toBe(1);
    expect(stats.allPurchases[0]._productName).toBe("Eau");
  });

  it("multiple priced purchases accumulate correctly in totalGlobal", async () => {
    // Add two priced purchases for different products
    await db.purchases.put({
      $id: "test-priced-purchase-2",
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      mainId: EVENT_ID,
      products: [WATER_PRODUCT_ID],
      quantity: 500,
      unit: "ml",
      store: "leclerc",
      status: "ordered",
      notes: "",
      price: 30,
      who: "alice",
      createdBy: null,
      orderDate: null,
      deliveryDate: null,
      invoiceId: null,
      invoiceTotal: null,
    });

    await db.purchases.put({
      $id: "test-priced-purchase-3",
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      mainId: EVENT_ID,
      products: [GARLIC_PRODUCT_ID],
      quantity: 50,
      unit: "gr.",
      store: "carrefour",
      status: "ordered",
      notes: "",
      price: 15,
      who: "bob",
      createdBy: null,
      orderDate: null,
      deliveryDate: null,
      invoiceId: null,
      invoiceTotal: null,
    });

    await waitForTick(8);

    const stats = productsStore.financialStats;
    expect(stats.totalGlobal).toBe(45);
    expect(stats.byStore["leclerc"]).toBe(30);
    expect(stats.byStore["carrefour"]).toBe(15);
    expect(stats.byWho["alice"]).toBe(30);
    expect(stats.byWho["bob"]).toBe(15);
    expect(stats.allPurchases.length).toBe(2);
  });

  it("updating a purchase price reflects in financialStats", async () => {
    // Start with a priced purchase
    await db.purchases.put({
      $id: "test-priced-update",
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      mainId: EVENT_ID,
      products: [WATER_PRODUCT_ID],
      quantity: 500,
      unit: "ml",
      store: "leclerc",
      status: "ordered",
      notes: "",
      price: 50,
      who: "alice",
      createdBy: null,
      orderDate: null,
      deliveryDate: null,
      invoiceId: null,
      invoiceTotal: null,
    });
    await waitForTick(8);

    expect(productsStore.financialStats.totalGlobal).toBe(50);

    // Update the price
    const purchase = await db.purchases.get("test-priced-update");
    await db.purchases.put({
      ...purchase!,
      price: 75,
      $updatedAt: new Date().toISOString(),
    });
    await waitForTick(8);

    expect(productsStore.financialStats.totalGlobal).toBe(75);
  });

  it("soft-deleting a priced purchase removes it from financialStats", async () => {
    // Add a priced purchase
    await db.purchases.put({
      $id: "test-priced-delete",
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      mainId: EVENT_ID,
      products: [WATER_PRODUCT_ID],
      quantity: 500,
      unit: "ml",
      store: "leclerc",
      status: "ordered",
      notes: "",
      price: 60,
      who: "alice",
      createdBy: null,
      orderDate: null,
      deliveryDate: null,
      invoiceId: null,
      invoiceTotal: null,
    });
    await waitForTick(8);

    expect(productsStore.financialStats.totalGlobal).toBe(60);

    // Soft-delete
    const purchase = await db.purchases.get("test-priced-delete");
    await db.purchases.put({
      ...purchase!,
      status: "deleted",
      $updatedAt: new Date().toISOString(),
    });
    await waitForTick(8);

    expect(productsStore.financialStats.totalGlobal).toBe(0);
    expect(productsStore.financialStats.allPurchases.length).toBe(0);
  });
});
