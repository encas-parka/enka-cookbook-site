/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore — chemins d'écriture produit au contrat d'identité stable.
 *
 * Seam : vrai store + vrai pb-sync + transport PB factice (sans réseau),
 * fake-indexeddb pour le vrai Dexie. Même machinerie que
 * products-store-create.test.ts.
 *
 * Contrat : le premier enregistrement d'un produit garde SON id sémantique
 * (`${slug}_${eventShort}`, admissible depuis la relaxation products.id) —
 * la primitive upsert (pb-collection) crée si le serveur ignore l'id, met à
 * jour sinon. Needs et produits portent le même id dès la création : la
 * fusion (#onDataChange, égalité d'id) ne voit jamais d'entrée disparaître,
 * plus de re-key ni de carte qui clignote.
 *
 * Couvre :
 *  - updateProductBatch sur produit VIRTUEL PUR (ligne needs, jamais poussé
 *    au serveur) : upsert à l'id sémantique, updates appliqués dessus,
 *    ligne needs intacte, re-rendu enrichi synchronisé
 *  - conversion storeInfo (objet enrichi) → champ json natif `store` —
 *    parité ère-Appwrite (upsertProductBatch la faisait ; perdue à la migration)
 *  - batchUpdateProducts sur sélection mixte (synchronisé + virtuel) :
 *    patch pur côté miroité, upsert côté virtuel, compteur sur les
 *    confirmations serveur (plus la taille de la sélection)
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

describe("ProductsStore — update produit (contrat identité stable, upsert même id)", () => {
  beforeEach(async () => {
    const fakePb = currentFakePb();
    fakePb.reset();
    await productsStore.softReset();
    await clearDexie();

    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === TEST_EVENT_ID ? makeEvent() : null),
    );
  });

  it("updateProductBatch sur produit virtuel pur → upsert à l'id sémantique (pas de re-key), json natif rendu", async () => {
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

    // Le produit existe côté serveur sous SON id sémantique, updates appliqués
    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(1);
    const materialized = products[0];
    expect(materialized.id).toBe(VIRTUAL_ID);
    expect(materialized.productName).toBe("Cannelle");
    expect(materialized.eventId).toBe(TEST_EVENT_ID);
    expect(materialized.isSynced).toBe(true);
    expect(materialized.store).toEqual({ storeName: "Épicerie du coin" });
    expect(materialized.who).toEqual(["Geo"]);

    // L'id résolu retourné au caller est l'entrée elle-même (identité stable)
    expect(resolvedId).toBe(VIRTUAL_ID);

    // Miroir Dexie et ligne needs restent à la même adresse (pas de re-key)
    expect(await db.products.get(VIRTUAL_ID)).toBeDefined();
    expect(await db.productNeeds.get(VIRTUAL_ID)).toBeDefined();

    // Re-rendu enrichi : la MÊME entrée, désormais synchronisée, porte les
    // updates (json natif parsé) — aucune carte qui disparaît/réapparaît
    const merged = productsStore.getEnrichedProductById(VIRTUAL_ID);
    expect(merged).not.toBeNull();
    expect(merged!.isSynced).toBe(true);
    expect(merged!.storeInfo?.storeName).toBe("Épicerie du coin");
    expect(merged!.who).toEqual(["Geo"]);
  });

  it("batchUpdateProducts sur sélection mixte (synchronisé + virtuel) → upsert de lot, compteur réel", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    await seedProductNeeds([VIRTUAL_NEED]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    const result = await productsStore.batchUpdateProducts(
      [TEST_PRODUCT_ID, VIRTUAL_ID],
      [],
      "who",
      { names: ["Geo"] },
    );
    await waitForTick(5);

    expect(result.success).toBe(true);
    // Le compteur reflète les confirmations serveur (2 records), pas la
    // taille de la sélection postulée
    expect(result.updatedCount).toBe(2);

    const products = await pb.collection("products").getFullList();
    expect(products).toHaveLength(2);
    const byId = new Map(products.map((p) => [p.id as string, p]));
    // Le synchronisé est patché sans matérialisation parasite
    expect(byId.get(TEST_PRODUCT_ID)?.who).toEqual(["Geo"]);
    // Le virtuel est matérialisé à son id sémantique, patch inclus
    const virtual = byId.get(VIRTUAL_ID);
    expect(virtual?.productName).toBe("Cannelle");
    expect(virtual?.eventId).toBe(TEST_EVENT_ID);
    expect(virtual?.isSynced).toBe(true);
    expect(virtual?.who).toEqual(["Geo"]);
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
