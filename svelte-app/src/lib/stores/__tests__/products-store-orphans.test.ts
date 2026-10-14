/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore — achats orphelins (produit plus affiché).
 *
 * Un achat est orphelin quand son productId n'a plus de carte affichée après
 * la passe du reconciler (#onDataChange), discriminé par `kind` :
 * - "product-removed" : aucun record produit (garde-fou — cas 1).
 * - "need-removed" : produit réel (ingredientRef non null) dont les recettes
 *   ne déclarent plus le besoin — carte masquée par le filtre date-range
 *   (byDate vide), l'achat reste tracé (cas 2). Dérivé à chaque passe :
 *   ré-ajouter la recette recrée la ligne need → l'orphelin s'efface.
 *   L'override (totalNeededOverride) ne rescuent pas ; les produits manuels
 *   (ingredientRef null) ne sont jamais éligibles.
 *
 * Calculé APRÈS le remappage merge : les achats d'une source fusionnée
 * vivent sous la cible, jamais orphelins.
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
  TEST_PURCHASE_ID,
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
    // Cas 1 : aucun record produit → garde-fou
    expect(orphans[0].kind).toBe("product-removed");
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

  it("flagge need-removed un produit réel dont la ligne need a disparu (cas 2)", async () => {
    await db.products.put(makeProductRecord());
    await seedProductNeeds([makeNeedRow()]);
    await db.purchases.put(makePurchaseRecord());

    await initializeSeeded();
    expect(productsStore.orphanedPurchases).toEqual([]);

    // La recette ne déclare plus le besoin → ligne need supprimée
    await db.productNeeds.delete(TEST_PRODUCT_ID);
    await waitForTick(5);

    const orphans = productsStore.orphanedPurchases;
    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toMatchObject({
      productId: TEST_PRODUCT_ID,
      kind: "need-removed",
      productName: "Eau",
      productType: "boissons",
    });
    // L'achat reste tracé avec son montant
    expect(orphans[0].purchases.map((p) => p.id)).toEqual([TEST_PURCHASE_ID]);
  });

  it("efface l'orphelin cas 2 au retour de la recette (ligne need recréée)", async () => {
    await db.products.put(makeProductRecord());
    await db.purchases.put(makePurchaseRecord());
    // Aucune need row → orphelin cas 2 dès la première passe
    await initializeSeeded();
    expect(productsStore.orphanedPurchases).toHaveLength(1);
    expect(productsStore.orphanedPurchases[0].kind).toBe("need-removed");

    // La recette revient → ligne need recréée → besoin actif, l'orphelin
    // s'efface naturellement (dérivation pure, aucun marquage)
    await seedProductNeeds([makeNeedRow()]);
    await waitForTick(5);

    expect(productsStore.orphanedPurchases).toEqual([]);
    expect(productsStore.getEnrichedProductById(TEST_PRODUCT_ID)).not.toBeNull();
  });

  it("ne rescuent pas un produit portant un totalNeededOverride sans besoin (cas 2)", async () => {
    // L'override est un ajustement lié aux recettes : recettes parties =
    // besoin parti — il ne maintient pas le produit affiché.
    await db.products.put(
      makeProductRecord({
        totalNeededOverride: JSON.stringify({
          totalOverride: { q: 3, u: "l" },
          comment: "ajustement manuel",
          totalComputedWhenOverride: [{ q: 2, u: "l" }],
          platesNbWhenOverride: 10,
          recipesNbWhenOverride: 1,
        }),
      }),
    );
    await db.purchases.put(makePurchaseRecord());

    await initializeSeeded();

    const orphans = productsStore.orphanedPurchases;
    expect(orphans).toHaveLength(1);
    expect(orphans[0].kind).toBe("need-removed");
  });

  it("n'orphanise jamais un produit manuel sans besoin (ingredientRef null)", async () => {
    // Produit manuel : indépendant des recettes, carte toujours affichée
    await db.products.put(makeProductRecord({ ingredientRef: null }));
    await db.purchases.put(makePurchaseRecord());

    await initializeSeeded();

    expect(productsStore.orphanedPurchases).toEqual([]);
    expect(productsStore.getEnrichedProductById(TEST_PRODUCT_ID)).not.toBeNull();
  });

  it("ne liste jamais une source mergée sans besoin : achats remappés, cible seule en cas 2", async () => {
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
    // Aucune need row : les deux produits sont hors recettes actives
    await db.purchases.put(
      makePurchaseRecord({ id: "t12srcpurch0001", products: [SOURCE_ID] }),
    );

    await initializeSeeded();

    // La source n'est jamais orpheline — son achat vit sous la cible
    // (remappage 1b), laquelle devient le cas 2 (besoin retiré)
    const orphans = productsStore.orphanedPurchases;
    expect(orphans).toHaveLength(1);
    expect(orphans[0].productId).toBe(TARGET_ID);
    expect(orphans[0].kind).toBe("need-removed");
    expect(orphans[0].purchases.map((p) => p.id)).toEqual(["t12srcpurch0001"]);
  });

  it("ne liste jamais une source mergée à cible introuvable (reste visible)", async () => {
    const SOURCE_ID = "lsoja_t12test001";
    await db.products.put(
      makeProductRecord({
        id: SOURCE_ID,
        ingredientRef: "lait-de-soja",
        productName: "Lait de soja",
        mergedInto: "cible_absente_t12e0",
      }),
    );
    await db.purchases.put(
      makePurchaseRecord({ products: [SOURCE_ID] }),
    );

    await initializeSeeded();

    // Garde 3b : la source reste affichée (modèle conservé) — et jamais
    // orpheline, même sans ligne need (guard mergedInto de la dérivation)
    expect(productsStore.getEnrichedProductById(SOURCE_ID)).not.toBeNull();
    expect(productsStore.orphanedPurchases).toEqual([]);
  });
});
