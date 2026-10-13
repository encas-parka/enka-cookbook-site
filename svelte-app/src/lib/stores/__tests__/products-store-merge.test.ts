/**
 * @vitest-environment jsdom
 */

/**
 * ProductsStore — fusion de produits (dérivation client, modèle sœur).
 *
 * Le record PocketBase ne porte que `mergedInto` + `mergeDate` sur la SOURCE
 * (un seul write serveur) ; tout le reste est dérivé à chaque passe du
 * reconciler (#onDataChange) :
 *  - étape 1b : les achats des sources sont remappés dans la map de la cible ;
 *  - étape 3  : les cibles de merge sont TOUJOURS reconstruites (jamais
 *    skippées par le fingerprint) pour que `mergedFrom` reparte de [] ;
 *  - étape 3b : agrégation byDate + `mergedFrom.push({id, name})` + masquage
 *    des modèles sources.
 *
 * Couvre : dérivation au chargement (données importées), absence
 * d'accumulation de `mergedFrom` sur les passes multiples du liveQuery,
 * format legacy `mergedFrom` brut (array de strings importé d'Appwrite),
 * cible introuvable, merge/unmerge par le store (état serveur + dérivation),
 * validations (auto-fusion, chaînage), recherche de cible.
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
  TEST_DATE,
  TEST_EVENT_ID,
  T0,
  T1,
} from "./harness/fixtures";
import { productsStore } from "$lib/stores/ProductsStore.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { db } from "$lib/db-sync/pb-sync";

const TARGET_ID = "lait_t12test0001";
const SOURCE_ID = "lsoja_t12test001";
const OTHER_ID = "pain_t12test0001";

/** Cible de fusion — produit normal. */
function makeTargetRecord(overrides = {}) {
  return makeProductRecord({
    id: TARGET_ID,
    ingredientRef: "lait",
    productName: "Lait",
    ...overrides,
  });
}

/** Source de fusion — produit qui sera absorbé par la cible. */
function makeSourceRecord(overrides = {}) {
  return makeProductRecord({
    id: SOURCE_ID,
    ingredientRef: "lait-de-soja",
    productName: "Lait de soja",
    ...overrides,
  });
}

/** Troisième produit (ni source, ni cible). */
function makeOtherRecord(overrides = {}) {
  return makeProductRecord({
    id: OTHER_ID,
    ingredientRef: null,
    productName: "Pain complet",
    productType: "boulangerie",
    ...overrides,
  });
}

function makeTargetNeed() {
  return makeNeedRow({
    id: TARGET_ID,
    ingredientRef: "lait",
    productName: "Lait",
    byDate: JSON.stringify({
      [TEST_DATE]: {
        totalConsolidated: [{ q: 2, u: "l" }],
        recipes: [],
        totalAssiettes: 10,
        recipeCount: 1,
      },
    }),
    totalNeededArray: JSON.stringify([{ q: 2, u: "l" }]),
  });
}

function makeSourceNeed() {
  return makeNeedRow({
    id: SOURCE_ID,
    ingredientRef: "lait-de-soja",
    productName: "Lait de soja",
    byDate: JSON.stringify({
      [TEST_DATE]: {
        totalConsolidated: [{ q: 1, u: "l" }],
        recipes: [],
        totalAssiettes: 5,
        recipeCount: 1,
      },
    }),
    totalNeededArray: JSON.stringify([{ q: 1, u: "l" }]),
  });
}

describe("ProductsStore — fusion de produits (dérivation client)", () => {
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

  /**
   * Seed un état mergé côté serveur (forme « données importées ») :
   * source avec mergedInto posé, cible normale, un achat chacun.
   */
  async function setupMergedState(
    sourceOverrides: Record<string, unknown> = {},
    seedTarget = true,
  ) {
    const fakePb = currentFakePb();
    const products = [
      makeSourceRecord({
        mergedInto: TARGET_ID,
        mergeDate: pbDate(T1),
        ...sourceOverrides,
      }),
      makeOtherRecord(),
    ];
    if (seedTarget) products.push(makeTargetRecord());
    fakePb.seed("products", products);
    fakePb.seed("purchases", [
      makePurchaseRecord({ id: "t12purchtgt0001", products: [TARGET_ID] }),
      makePurchaseRecord({ id: "t12purchsrc0001", products: [SOURCE_ID] }),
    ]);
    await seedProductNeeds([makeTargetNeed(), makeSourceNeed()]);

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);
  }

  it("masque les sources au chargement et agrège achats + besoins dans la cible", async () => {
    await setupMergedState();

    // La source a disparu de la vue
    expect(productsStore.getEnrichedProductById(SOURCE_ID)).toBeNull();

    const target = productsStore.getEnrichedProductById(TARGET_ID);
    expect(target).not.toBeNull();
    // mergedFrom dérivé : une entrée {id, name} par source
    expect(target!.mergedFrom).toEqual([
      { id: SOURCE_ID, name: "Lait de soja" },
    ]);
    // Les achats des deux produits sont rattachés à la cible
    expect(target!.purchases.map((p) => p.id).sort()).toEqual([
      "t12purchsrc0001",
      "t12purchtgt0001",
    ]);
    // Besoins agrégés : 2 l (cible) + 1 l (source) = 3 l
    expect(target!.totalNeededArray).toEqual([{ q: 3, u: "l" }]);
  });

  it("ne ré-accumule pas mergedFrom sur les passes multiples du reconciler", async () => {
    await setupMergedState();

    // Une écriture sans rapport avec la cible déclenche une nouvelle passe :
    // la cible est reconstruite (isMergeTarget contourne le fingerprint),
    // mergedFrom repart de [] puis repousse exactement une entrée.
    await db.purchases.put(
      makePurchaseRecord({
        id: "t12purchextra01",
        products: [TARGET_ID],
        updated: pbDate(T1),
      }),
    );
    await waitForTick(5);

    const target = productsStore.getEnrichedProductById(TARGET_ID);
    expect(target!.mergedFrom).toHaveLength(1);

    // Une passe de plus (bump du besoin cible) — toujours une seule entrée
    await db.productNeeds.put({
      ...makeTargetNeed(),
      updated: pbDate(T1),
    });
    await waitForTick(5);

    expect(
      productsStore.getEnrichedProductById(TARGET_ID)!.mergedFrom,
    ).toHaveLength(1);
  });

  it("ignore le mergedFrom brut legacy (array de strings importé)", async () => {
    await setupMergedState({ mergedFrom: ["ancien-nom-importe"] });

    const target = productsStore.getEnrichedProductById(TARGET_ID);
    // La dérivation ne lit jamais le brut : exactement l'entrée runtime
    expect(target!.mergedFrom).toEqual([
      { id: SOURCE_ID, name: "Lait de soja" },
    ]);
  });

  it("garde la source visible quand la cible est introuvable", async () => {
    await setupMergedState({ mergedInto: "cible_absente_0001" });

    const source = productsStore.getEnrichedProductById(SOURCE_ID);
    expect(source).not.toBeNull();
    // Ses achats ne sont pas remappés (garde de l'étape 1b)
    expect(source!.purchases.map((p) => p.id)).toEqual(["t12purchsrc0001"]);
  });

  it("mergeProducts écrit mergedInto+mergeDate sur la source seule et dérive l'affichage", async () => {
    const fakePb = currentFakePb();
    // État NON mergé : deux produits normaux
    fakePb.seed("products", [
      makeSourceRecord(),
      makeTargetRecord(),
      makeOtherRecord(),
    ]);
    fakePb.seed("purchases", [
      makePurchaseRecord({ id: "t12purchtgt0001", products: [TARGET_ID] }),
      makePurchaseRecord({ id: "t12purchsrc0001", products: [SOURCE_ID] }),
    ]);
    await seedProductNeeds([makeTargetNeed(), makeSourceNeed()]);
    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);

    await productsStore.mergeProducts(SOURCE_ID, TARGET_ID);
    await waitForTick(5);

    // Un seul write serveur : mergedInto + mergeDate sur la source, la cible
    // n'est jamais modifiée
    const serverSource = fakePb
      .records("products")
      .find((r) => r.id === SOURCE_ID);
    const serverTarget = fakePb
      .records("products")
      .find((r) => r.id === TARGET_ID);
    expect(serverSource!.mergedInto).toBe(TARGET_ID);
    expect(serverSource!.mergeDate).toBeTruthy();
    expect(serverTarget!.mergedInto).toBeNull();

    // Dérivation : source masquée, cible agrégée
    expect(productsStore.getEnrichedProductById(SOURCE_ID)).toBeNull();
    const target = productsStore.getEnrichedProductById(TARGET_ID);
    expect(target!.mergedFrom).toEqual([
      { id: SOURCE_ID, name: "Lait de soja" },
    ]);
    expect(target!.purchases).toHaveLength(2);
  });

  it("refuse l'auto-fusion, les ids inconnus et le chaînage (aucune écriture)", async () => {
    const fakePb = currentFakePb();
    // Chaîne existante : SOURCE mergée vers TARGET
    await setupMergedState();
    const before = fakePb
      .records("products")
      .map((r) => ({ id: r.id, mergedInto: r.mergedInto }));

    // Auto-fusion
    await productsStore.mergeProducts(SOURCE_ID, SOURCE_ID);
    // Source inconnue
    await productsStore.mergeProducts("inconnu_00000001", TARGET_ID);
    // Chaînage : fusionner un produit vers une source déjà mergée
    await productsStore.mergeProducts(OTHER_ID, SOURCE_ID);
    // Re-fusion d'une source déjà mergée
    await productsStore.mergeProducts(SOURCE_ID, OTHER_ID);

    const after = fakePb
      .records("products")
      .map((r) => ({ id: r.id, mergedInto: r.mergedInto }));
    expect(after).toEqual(before);
  });

  it("unmergeProduct rend la source visible et vide mergedFrom de la cible", async () => {
    const fakePb = currentFakePb();
    await setupMergedState();

    await productsStore.unmergeProduct(SOURCE_ID, TARGET_ID);
    await waitForTick(5);

    // État serveur : la source est relâchée
    const serverSource = fakePb
      .records("products")
      .find((r) => r.id === SOURCE_ID);
    expect(serverSource!.mergedInto).toBeNull();
    expect(serverSource!.mergeDate).toBeNull();

    // La source redevient visible avec SES achats
    const source = productsStore.getEnrichedProductById(SOURCE_ID);
    expect(source).not.toBeNull();
    expect(source!.purchases.map((p) => p.id)).toEqual(["t12purchsrc0001"]);

    // La cible est reconstruite sans mergedFrom et garde ses achats seuls
    const target = productsStore.getEnrichedProductById(TARGET_ID);
    expect(target!.mergedFrom).toEqual([]);
    expect(target!.purchases.map((p) => p.id)).toEqual(["t12purchtgt0001"]);
    // Les besoins ne sont plus agrégés
    expect(target!.totalNeededArray).toEqual([{ q: 2, u: "l" }]);
  });

  it("searchProducts exclut le courant et les sources mergées, matche nom et type", async () => {
    await setupMergedState();

    // Le courant est exclu
    expect(productsStore.searchProducts("lait", TARGET_ID)).toEqual([]);
    // La source mergée est exclue même si le nom matche
    expect(
      productsStore.searchProducts("lait", OTHER_ID).map((p) => p.id),
    ).toEqual([TARGET_ID]);
    // Match par nom depuis la cible
    expect(
      productsStore.searchProducts("pain", TARGET_ID).map((p) => p.id),
    ).toEqual([OTHER_ID]);
    // Match par type
    expect(
      productsStore.searchProducts("boulang", TARGET_ID).map((p) => p.id),
    ).toEqual([OTHER_ID]);
    // Requête vide
    expect(productsStore.searchProducts("  ", TARGET_ID)).toEqual([]);
  });
});
