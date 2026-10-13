/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore — achats orphelins (achat sans produit actif).
 *
 * Un achat est orphelin quand son productId n'atterrit dans aucun modèle
 * affiché après la passe du reconciler (#onDataChange) : besoin recalculé
 * qui a disparu, produit supprimé... Calculé APRÈS le remappage merge :
 * les achats d'une source fusionnée vivent sous la cible, jamais orphelins.
 *
 * Le nom affiché vient du cache de noms (dernier modèle connu) avec
 * fallback `extractNameFromProductId` (id sémantique "slug_eventId").
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
import { currentFakePb } from "./harness/stub-pb";
import { clearDexie, seedProductNeeds } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import {
  makeEvent,
  makeNeedRow,
  makeProductRecord,
  makePurchaseRecord,
  TEST_EVENT_ID,
  TEST_PRODUCT_ID,
} from "./harness/fixtures";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { db } from "$lib/db-sync/pb-sync";

const GHOST_ID = "jus-de-citron_t12event0";

describe("ProductsStore — achats orphelins (sans produit actif)", () => {
  beforeEach(async () => {
    const fakePb = currentFakePb();
    fakePb.reset();
    await productsStore.softReset();
    await clearDexie();

    const event = makeEvent();
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === TEST_EVENT_ID ? event : null),
    );
  });

  async function initializeSeeded() {
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);
  }

  it("expose un achat dont le produit n'existe plus, nommé depuis l'id sémantique", async () => {
    // Aucun produit ni besoin pour GHOST_ID : l'achat n'atterrit dans
    // aucune map affichée.
    await db.purchases.put(
      makePurchaseRecord({
        id: "t12ghostpurch001",
        products: [GHOST_ID],
        quantity: 2,
        unit: "l.",
      }),
    );

    await initializeSeeded();

    const orphans = productsStore.orphanedPurchases;
    expect(orphans).toHaveLength(1);
    expect(orphans[0].productId).toBe(GHOST_ID);
    // extractNameFromProductId("jus-de-citron_t12event0") → "Jus De Citron"
    expect(orphans[0].productName).toBe("Jus De Citron");
    // Montant d'information : les achats complets sont exposés
    expect(orphans[0].purchases.map((p) => p.id)).toEqual([
      "t12ghostpurch001",
    ]);
    expect(orphans[0].purchases[0].quantity).toBe(2);
    expect(orphans[0].purchases[0].unit).toBe("l.");
  });

  it("ne liste pas les achats rattachés à un produit affiché", async () => {
    await db.products.put(makeProductRecord());
    await seedProductNeeds([makeNeedRow()]);
    await db.purchases.put(makePurchaseRecord());

    await initializeSeeded();

    expect(productsStore.getEnrichedProductById(TEST_PRODUCT_ID)).not.toBeNull();
    expect(productsStore.orphanedPurchases).toEqual([]);
  });

  it("ne liste pas les achats d'une source fusionnée (remappés vers la cible)", async () => {
    const TARGET_ID = "lait_t12test0001";
    const SOURCE_ID = "lsoja_t12test001";
    await db.products.bulkPut([
      makeProductRecord({ id: TARGET_ID, ingredientRef: "lait", productName: "Lait" }),
      makeProductRecord({
        id: SOURCE_ID,
        ingredientRef: "lait-de-soja",
        productName: "Lait de soja",
        mergedInto: TARGET_ID,
      }),
    ]);
    await seedProductNeeds([
      makeNeedRow({ id: TARGET_ID, ingredientRef: "lait", productName: "Lait" }),
      makeNeedRow({
        id: SOURCE_ID,
        ingredientRef: "lait-de-soja",
        productName: "Lait de soja",
      }),
    ]);
    await db.purchases.put(
      makePurchaseRecord({ id: "t12srcpurch0001", products: [SOURCE_ID] }),
    );

    await initializeSeeded();

    // La source est masquée et ses achats vivent sous la cible
    expect(productsStore.getEnrichedProductById(SOURCE_ID)).toBeNull();
    const target = productsStore.getEnrichedProductById(TARGET_ID);
    expect(target!.purchases.map((p) => p.id)).toEqual(["t12srcpurch0001"]);
    expect(productsStore.orphanedPurchases).toEqual([]);
  });

  it("ignore les achats au statut expense (finances)", async () => {
    await db.purchases.put(
      makePurchaseRecord({
        id: "t12expense0001",
        products: [GHOST_ID],
        status: "expense",
      }),
    );

    await initializeSeeded();

    expect(productsStore.orphanedPurchases).toEqual([]);
  });

  it("nomme depuis le cache un produit devenu orphelin entre deux passes", async () => {
    // Passe 1 : le produit existe (nom « Eau » mis en cache)
    await db.products.put(makeProductRecord());
    await seedProductNeeds([makeNeedRow()]);
    await db.purchases.put(makePurchaseRecord());

    await initializeSeeded();
    expect(productsStore.orphanedPurchases).toEqual([]);

    // Passe 2 : produit + besoin supprimés de Dexie (écriture brute → liveQuery)
    await db.products.delete(TEST_PRODUCT_ID);
    await db.productNeeds.delete(TEST_PRODUCT_ID);
    await waitForTick(5);

    const orphans = productsStore.orphanedPurchases;
    expect(orphans).toHaveLength(1);
    expect(orphans[0].productId).toBe(TEST_PRODUCT_ID);
    // Nom issu du cache (dernier modèle connu), pas de l'id
    expect(orphans[0].productName).toBe("Eau");
    expect(orphans[0].productType).toBe("boissons");
  });
});
