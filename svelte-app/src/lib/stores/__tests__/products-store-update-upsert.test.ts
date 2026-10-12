/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore — chemins d'update produit (contrat offline-first attach-or-create).
 *
 * Seam : vrai store + vrai pb-sync + transport PB factice (sans réseau),
 * fake-indexeddb pour le vrai Dexie. Même machinerie que
 * products-store-create.test.ts.
 *
 * Couvre (ticket 02 — évidence click-through « Record not found in Dexie ») :
 *  - updateProductBatch sur produit VIRTUEL PUR (ligne needs, jamais poussé
 *    au serveur) : création avant update (#ensureSyncedProduct, id serveur
 *    généré — PB refuse les ids sémantiques), ligne needs re-keyée, updates
 *    appliqués sur le nouveau record, re-rendu enrichi synchronisé
 *  - conversion storeInfo (objet enrichi) → champ json natif `store` —
 *    parité ère-Appwrite (upsertProductBatch la faisait ; perdue à la migration)
 *  - update sur record absent du cache local mais présent côté serveur :
 *    attach par la sync collection (miroir Dexie puis update optimiste),
 *    sans doublon serveur
 *  - id inconnu (ni cache, ni serveur, ni besoin) : erreur légitime,
 *    aucune création silencieuse
 *  - produit synchronisé : chemin optimiste inchangé (garde de régression)
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
import { currentFakePb } from "./harness/stub-pb";
import { clearDexie, seedProductNeeds } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import {
  makeEvent,
  makeNeedRow,
  makeProductRecord,
  TEST_EVENT_ID,
  TEST_PRODUCT_ID,
} from "./harness/fixtures";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { db, pb } from "$lib/db-sync/pb-sync";

/** Produit virtuel echo de l'évidence click-through (`cannelle_qq9ziy9kpw`). */
const VIRTUAL_ID = "cannelle_qq9ziy9kpw";
const VIRTUAL_NEED = makeNeedRow({
  id: VIRTUAL_ID,
  ingredientRef: "cannelle",
  productName: "Cannelle",
  productType: "épices",
});

describe("ProductsStore — update produit (contrat offline-first attach-or-create)", () => {
  beforeEach(async () => {
    const fakePb = currentFakePb();
    fakePb.reset();
    await productsStore.softReset();
    await clearDexie();

    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === TEST_EVENT_ID ? makeEvent() : null),
    );
  });

  it("updateProductBatch sur produit virtuel pur → créé avant update, needs re-keyés, json natif rendu", async () => {
    await seedProductNeeds([VIRTUAL_NEED]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    // État initial : produit virtuel (besoin calculé, aucun record serveur)
    const virtualBefore = productsStore.getEnrichedProductById(VIRTUAL_ID);
    expect(virtualBefore?.isSynced).toBe(false);

    const resolvedId = await productsStore.updateProductBatch(VIRTUAL_ID, {
      storeInfo: { storeName: "Épicerie du coin" },
      who: ["Geo"],
    });
    await waitForTick(5);

    // Le produit existe désormais côté serveur (id PB généré — les ids
    // sémantiques sont refusés), avec les updates appliqués dessus
    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(1);
    const implicit = products[0];
    expect(implicit.productName).toBe("Cannelle");
    expect(implicit.eventId).toBe(TEST_EVENT_ID);
    expect(implicit.isSynced).toBe(true);
    expect(implicit.store).toEqual({ storeName: "Épicerie du coin" });
    expect(implicit.who).toEqual(["Geo"]);

    // L'id résolu retourné au caller est l'id serveur
    expect(resolvedId).toBe(implicit.id);

    // Le miroir Dexie et la ligne needs sont cohérents (re-key)
    expect(await db.products.get(implicit.id as string)).toBeDefined();
    expect(await db.productNeeds.get(VIRTUAL_ID)).toBeUndefined();
    expect(await db.productNeeds.get(implicit.id as string)).toBeDefined();

    // Re-rendu enrichi : l'entrée virtuelle a disparu, l'entrée synchronisée
    // porte les updates (json natif parsé)
    expect(productsStore.getEnrichedProductById(VIRTUAL_ID)).toBeNull();
    const merged = productsStore.getEnrichedProductById(implicit.id as string);
    expect(merged).not.toBeNull();
    expect(merged!.isSynced).toBe(true);
    expect(merged!.storeInfo?.storeName).toBe("Épicerie du coin");
    expect(merged!.who).toEqual(["Geo"]);
  });

  it("updateProductBatch convertit storeInfo → champ json natif store (produit synchronisé)", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    await productsStore.updateProductBatch(TEST_PRODUCT_ID, {
      storeInfo: { storeName: "Marché Plus" },
    });
    await waitForTick(5);

    // Le champ schéma `store` porte l'objet natif — pas de champ junk `storeInfo`
    const server = await pb.collection("products").getOne(TEST_PRODUCT_ID);
    expect(server.store).toEqual({ storeName: "Marché Plus" });
    expect((server as Record<string, unknown>).storeInfo).toBeUndefined();

    const enriched = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(enriched?.storeInfo?.storeName).toBe("Marché Plus");
  });

  it("updateProduct sur record absent du cache mais présent serveur → attach, pas de doublon", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    // Simulation d'un cache en retard : le record serveur existe, Dexie non
    await db.products.clear();
    await waitForTick(3);
    expect(productsStore.getEnrichedProductById(TEST_PRODUCT_ID)).toBeNull();

    // Ne doit pas throw « Record not found in Dexie » : attach puis update
    await productsStore.updateProduct(TEST_PRODUCT_ID, { who: ["Geo"] });
    await waitForTick(5);

    // Aucun doublon créé ; l'update est appliqué côté serveur
    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(1);
    expect(products[0].who).toEqual(["Geo"]);

    // Re-rendu enrichi rattaché
    const enriched = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(enriched).not.toBeNull();
    expect(enriched!.who).toEqual(["Geo"]);
    expect(enriched!.isSynced).toBe(true);
  });

  it("updateProduct sur id inconnu (ni cache, ni serveur, ni besoin) → erreur, aucune création", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    await expect(
      productsStore.updateProduct("zzzunknownid0001", { who: ["Geo"] }),
    ).rejects.toThrow(/not found/i);

    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(1);
  });

  it("updateProduct sur produit synchronisé → chemin optimiste inchangé", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    await productsStore.updateProduct(TEST_PRODUCT_ID, {
      stockReel: JSON.stringify({ quantity: "4", unit: "l" }),
    });
    await waitForTick(5);

    const server = await pb.collection("products").getOne(TEST_PRODUCT_ID);
    expect(server.stockReel).toBe(JSON.stringify({ quantity: "4", unit: "l" }));

    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(1);
  });
});
