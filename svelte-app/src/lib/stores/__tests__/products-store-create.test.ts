/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore — chemins de création produit/achat (write paths).
 *
 * Seam : vrai store + vrai pb-sync + transport PB factice (sans réseau),
 * fake-indexeddb pour le vrai Dexie. Même machinerie que
 * products-store-reactivity.test.ts.
 *
 * Couvre (causes racines mesurées par la sonde HTTP T01) :
 *  - createProduct : record serveur (id PB généré `[a-z0-9]{15}`), miroir
 *    Dexie, produit marqué isSynced (parité ère-Appwrite perdue à la migration)
 *  - createPurchase sur produit synchronisé : achat référençant l'id produit,
 *    sans création implicite
 *  - createPurchase / createGroupPurchase sur produit VIRTUEL (ligne needs
 *    sans record serveur) : matérialisation à SON id sémantique via la
 *    primitive upsert (admissible depuis la relaxation products.id) — achat
 *    référençant ce même id (relation valide dès la création), ligne needs
 *    intacte, fusion needs↔produits (égalité d'id dans #onDataChange) sur
 *    une seule entrée, synchronisée
 *  - recalcul des besoins : chaque ligne est clé sur l'id du produit
 *    synchronisé correspondant (match par ingredientRef, sinon productName) —
 *    les ids PB remappés à l'import ne cassent plus la fusion
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
    // Valeur figée : un timestamp frais par appel ferait basculer le hash
    // repas entre initialize() et le premier $effect.
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
} from "./harness/fixtures";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { recipesStore } from "$lib/stores/RecipesStore.svelte";
import { db, pb } from "$lib/db-sync/pb-sync";
import type { RecipeData } from "$lib/types/recipes.types";

/** Produit virtuel echo de l'évidence click-through (`cannelle_qq9ziy9kpw`). */
const VIRTUAL_ID = "cannelle_qq9ziy9kpw";
const VIRTUAL_NEED = makeNeedRow({
  id: VIRTUAL_ID,
  ingredientRef: "cannelle",
  productName: "Cannelle",
  productType: "épices",
});

describe("ProductsStore — création produit & achat (write paths)", () => {
  beforeEach(async () => {
    const fakePb = currentFakePb();
    fakePb.reset();
    await productsStore.softReset();
    await clearDexie();

    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === TEST_EVENT_ID ? makeEvent() : null),
    );
  });

  it("createProduct → record serveur (id PB généré), miroir Dexie, isSynced", async () => {
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(3);

    const id = await productsStore.createProduct({
      productName: "Huile d'olive",
      productType: "épicerie",
    });

    // L'id renvoyé est celui du serveur (format PB), pas un id client
    expect(id).toMatch(/^[a-z0-9]{15}$/);

    const server = await pb.collection("products").getOne(id);
    expect(server.productName).toBe("Huile d'olive");
    expect(server.eventId).toBe(TEST_EVENT_ID);
    expect(server.isSynced).toBe(true);
    expect(server.specs).toBe(JSON.stringify({ pF: false, pS: false }));

    const mirrored = await db.products.get(id);
    expect(mirrored?.productName).toBe("Huile d'olive");

    await waitForTick(5);
    const model = productsStore.getEnrichedProductById(id);
    expect(model?.productName).toBe("Huile d'olive");
    expect(model?.isSynced).toBe(true);
  });

  it("createProduct avec quantité → specs.quantity normalisé (besoin), aucun achat créé", async () => {
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(3);

    const id = await productsStore.createProduct({
      productName: "Farine",
      productType: "épicerie",
      quantity: 1,
      unit: "kg",
    });

    // La quantité est un besoin : normalisée en unité de base dans specs
    const server = await pb.collection("products").getOne(id);
    expect(JSON.parse(server.specs)).toEqual({
      quantity: { q: 1000, u: "gr." },
      pF: false,
      pS: false,
    });

    // Besoin, pas achat : aucune purchase à la création produit
    const purchases = await pb.collection("purchases").getFullList();
    expect(purchases).toHaveLength(0);

    // Le lecteur existant du besoin affiche la quantité normalisée
    await waitForTick(5);
    const model = productsStore.getEnrichedProductById(id);
    expect(model?.totalNeededArray).toContainEqual({ q: 1000, u: "gr." });
  });

  it("createProduct avec quantité sans unité → fallback 'unité' (parité sœur)", async () => {
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(3);

    const id = await productsStore.createProduct({
      productName: "Sacs poubelle",
      productType: "autre",
      quantity: 3,
    });

    const server = await pb.collection("products").getOne(id);
    expect(JSON.parse(server.specs)).toEqual({
      quantity: { q: 3, u: "unité" },
      pF: false,
      pS: false,
    });
  });

  it("createPurchase sur produit synchronisé → achat référençant l'id produit, pas de création implicite", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    currentFakePb().seed("purchases", []);
    await seedProductNeeds([makeNeedRow()]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    await productsStore.createPurchase(TEST_PRODUCT_ID, [{ q: 500, u: "gr." }], {
      store: "Marché",
      notes: "rapide",
    });
    await waitForTick(5);

    const purchases = await pb.collection("purchases").getFullList();
    expect(purchases).toHaveLength(1);
    expect(purchases[0].products).toEqual([TEST_PRODUCT_ID]);
    expect(purchases[0].quantity).toBe(500);
    expect(purchases[0].eventId).toBe(TEST_EVENT_ID);

    // Le produit existait : aucune création implicite côté serveur
    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(1);
  });

  it("createPurchase sur produit virtuel → matérialisé à l'id sémantique (pas de re-key), achat dessus", async () => {
    await seedProductNeeds([VIRTUAL_NEED]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    // État initial : produit virtuel (besoin calculé, aucun record serveur)
    const virtualBefore = productsStore.getEnrichedProductById(VIRTUAL_ID);
    expect(virtualBefore?.isSynced).toBe(false);

    await productsStore.createPurchase(VIRTUAL_ID, [{ q: 100, u: "gr." }], {
      notes: "",
      invoiceId: "VALID_1",
    });
    await waitForTick(5);

    // Le produit implicite existe côté serveur sous SON id sémantique,
    // marqué synchronisé
    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(1);
    const implicit = products[0];
    expect(implicit.id).toBe(VIRTUAL_ID);
    expect(implicit.productName).toBe("Cannelle");
    expect(implicit.eventId).toBe(TEST_EVENT_ID);
    expect(implicit.isSynced).toBe(true);
    expect(implicit.ingredientRef).toBe("cannelle");

    // L'achat référence ce même id → relation products valide dès la création
    const purchases = await pb.collection("purchases").getFullList();
    expect(purchases).toHaveLength(1);
    expect(purchases[0].products).toEqual([VIRTUAL_ID]);

    // La ligne needs reste à la même adresse (pas de re-key)
    const needRow = await db.productNeeds.get(VIRTUAL_ID);
    expect(needRow).toBeDefined();
    expect(JSON.parse(needRow!.totalNeededArray)).toEqual([{ q: 2, u: "l" }]);

    // Vue enrichie : la MÊME entrée, fusionnée (achat + besoin), synchronisée
    const merged = productsStore.getEnrichedProductById(VIRTUAL_ID);
    expect(merged).not.toBeNull();
    expect(merged!.isSynced).toBe(true);
    expect(merged!.purchases).toHaveLength(1);
  });

  it("createGroupPurchase sur produit virtuel → matérialisé à l'id sémantique, relation purchases valide", async () => {
    await seedProductNeeds([VIRTUAL_NEED]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    const result = await productsStore.createGroupPurchase(
      [
        {
          productId: VIRTUAL_ID,
          isSynced: false,
          missingQuantities: [{ q: 250, u: "gr." }],
        },
      ],
      { invoiceId: "INV_GROUP_1" },
    );
    await waitForTick(5);

    expect(result.success).toBe(true);
    expect(result.totalProductsCreated).toBe(1);
    expect(result.totalPurchasesCreated).toBe(1);

    // Le produit est matérialisé sous son id sémantique
    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe(VIRTUAL_ID);
    expect(products[0].productName).toBe("Cannelle");
    expect(products[0].isSynced).toBe(true);

    // L'achat du lot référence ce même id → relation products valide
    const purchases = await pb.collection("purchases").getFullList();
    expect(purchases).toHaveLength(1);
    expect(purchases[0].products).toEqual([VIRTUAL_ID]);
    expect(purchases[0].quantity).toBe(250);
    expect(purchases[0].invoiceId).toBe("INV_GROUP_1");

    // Vue enrichie fusionnée : besoin + produit matérialisé sur la même
    // entrée. (Les achats du lot passent par le batch PB brut : leur miroir
    // Dexie arrive par realtime SSE, non émulé par le transport factice.)
    const merged = productsStore.getEnrichedProductById(VIRTUAL_ID);
    expect(merged).not.toBeNull();
    expect(merged!.isSynced).toBe(true);
  });

  it("recalcul des besoins : les lignes sont clées sur le produit synchronisé correspondant (match par nom)", async () => {
    const recipe = {
      title: "Punch",
      plate: 10,
      astuces: [],
      ingredients: [
        {
          ref: "eau",
          name: "Eau",
          originalQuantity: 2,
          originalUnit: "l",
          normalizedQuantity: 2,
          normalizedUnit: "l",
          comment: "",
          allergens: [],
          type: "boissons",
        },
        {
          ref: "cannelle",
          name: "Cannelle",
          originalQuantity: 10,
          originalUnit: "gr",
          normalizedQuantity: 10,
          normalizedUnit: "gr",
          comment: "",
          allergens: [],
          type: "épices",
        },
      ],
    } as unknown as RecipeData;

    vi.mocked(recipesStore.getRecipesByUuidsBulk).mockImplementation(
      async () => new Map([["rec1", recipe]]),
    );

    const event = makeEvent({
      meals: [
        {
          date: "2026-12-19T12:00:00.000Z",
          guests: 10,
          recipes: [{ recipeUuid: "rec1", plates: 10, typeR: "plat" }],
        },
      ],
    });
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === TEST_EVENT_ID ? event : null),
    );

    // Produit synchronisé "Eau" (id PB remappé ≠ id sémantique) + son achat.
    // AUCUN need seedé → initialize déclenche le calcul depuis event.meals.
    currentFakePb().seed("products", [makeProductRecord()]);
    currentFakePb().seed("purchases", [makePurchaseRecord()]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    const rows = await db.productNeeds.toArray();
    const byName = new Map(rows.map((r) => [r.productName, r]));

    // Le besoin "Eau" est clé sur l'id du produit synchronisé (match par nom)
    // → la fusion needs↔produits opère malgré le remappage des ids PB
    expect(byName.get("Eau")?.id).toBe(TEST_PRODUCT_ID);

    // Le besoin sans produit correspondant garde l'id sémantique (virtuel)
    expect(byName.get("Cannelle")?.id).toBe(
      `cannelle_${TEST_EVENT_ID.slice(-10)}`,
    );

    await waitForTick(5);
    const eau = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(eau?.isSynced).toBe(true);
    expect(eau?.purchases).toHaveLength(1);
    expect(eau?.totalNeededArray).toContainEqual({ q: 2, u: "l" });
  });
});
