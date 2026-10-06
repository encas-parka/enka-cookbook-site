/**
 * @vitest-environment jsdom
 */

/**
 * pb-sync delta & realtime — server-driven reactivity through the fake PB.
 *
 * These tests pin the PocketBase wire contract that the scoped cursor
 * (Étape 3 du portage) relies on:
 *  - records are `PbDoc { id, created, updated }`, dates in PB format
 *    `YYYY-MM-DD HH:mm:ss.SSSZ` (space, no `T`)
 *  - the delta filter `updated >= {:since}` is evaluated LEXICALLY
 *    server-side — a mutation only reaches Dexie when its PB datetime
 *    string sorts strictly after the local maximum
 *  - SSE realtime events (`{ action, record }`) land in Dexie through the
 *    real `subscribe()` handler and propagate reactively to the store
 *  - `collection.create()` stamps PB-format datetimes server-side and
 *    mirrors the confirmed record into Dexie
 */

// Mocks MUST be declared before importing the store under test.
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
import type { FakePocketBase, PbRecord } from "./harness/stub-pb";
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
import { globalState } from "$lib/stores/GlobalState.svelte";
import { eventsStore } from "$lib/stores/EventsStore.svelte";

/**
 * The GlobalState mock replaces a getter-only `userId` — the runtime mock is
 * a plain mutable object, only the (real) type is read-only.
 */
const setMockUserId = (id: string) => {
  (globalState as { userId: string }).userId = id;
};
import { db } from "$lib/db-sync/pb-sync";

type FakeCollection = ReturnType<FakePocketBase["collection"]>;
type FullListOptions = Parameters<FakeCollection["getFullList"]>[0];

/**
 * Blocks every `getFullList` behind a manual gate and counts the fetches.
 * Lets a test observe concurrency (revalidate guard) and mid-flight state
 * (loading toggle) deterministically. `restore()` MUST be called before the
 * test ends — the spy would otherwise leak into the other tests of the file.
 */
function gateGetFullList(fakePb: FakePocketBase) {
  const realCollection = fakePb.collection.bind(fakePb);
  let fetchCount = 0;
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const spy = vi
    .spyOn(fakePb, "collection")
    .mockImplementation((name: string): FakeCollection => {
      const coll = realCollection(name);
      return {
        ...coll,
        async getFullList(options?: FullListOptions): Promise<PbRecord[]> {
          fetchCount += 1;
          await gate;
          return coll.getFullList(options);
        },
      };
    });
  return {
    count: () => fetchCount,
    release: () => release?.(),
    restore: () => spy.mockRestore(),
  };
}

describe("pb-sync — delta fetch et realtime via le serveur PB simulé", () => {
  beforeEach(async () => {
    const fakePb = currentFakePb();
    fakePb.reset();
    await productsStore.softReset();
    await clearDexie();

    fakePb.seed("products", [makeProductRecord()]);
    fakePb.seed("purchases", [makePurchaseRecord()]);
    await seedProductNeeds([makeNeedRow()]);

    const event = makeEvent();
    vi.mocked(eventsStore.getEventById).mockImplementation(
      (id: string) => (id === TEST_EVENT_ID ? event : null),
    );

    await productsStore.initialize(TEST_EVENT_ID);
    await waitForTick(5);
  });

  it("mutation serveur (updated bumpé) → delta initialFetch → store mis à jour", async () => {
    // Sanity: pre-sync state
    expect(productsStore.getEnrichedProductById(TEST_PRODUCT_ID)!.productName).toBe("Eau");

    // Server-side mutation with a STRICTLY GREATER PB datetime — the delta
    // cursor (`updated >= since`, lexical) must pick it up.
    currentFakePb().putRecord(
      "products",
      makeProductRecord({ productName: "Eau minérale", updated: pbDate(T1) }),
    );

    await productsStore.syncRevalidate();
    await waitForTick(5);

    const model = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(model!.productName).toBe("Eau minérale");
  });

  it("mutation serveur SANS bump updated → delta ne ramène rien (curseur lexical)", async () => {
    // Remote edit with an updated string STRICTLY BEFORE the local max:
    // a real PB server never returns it for `updated >= since` — the fake
    // must behave the same, otherwise the tests lie about the cursor.
    currentFakePb().putRecord(
      "products",
      makeProductRecord({ productName: "Hors curseur" }),
    );

    await productsStore.syncRevalidate();
    await waitForTick(5);

    expect(productsStore.getEnrichedProductById(TEST_PRODUCT_ID)!.productName).toBe("Eau");
  });

  it("événement realtime (SSE simulé) → Dexie → store réactif", async () => {
    expect(productsStore.getEnrichedProductById(TEST_PRODUCT_ID)!.purchases).toHaveLength(1);

    const emitted = makePurchaseRecord({
      id: "t12purchase0003",
      updated: pbDate(T1),
    });
    currentFakePb().emit("purchases", "create", emitted);
    await waitForTick(5);

    const model = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(model!.purchases).toHaveLength(2);
    expect(model!.purchases.map((p) => p.id)).toContain("t12purchase0003");
    // The realtime handler mirrored the record into Dexie
    expect(await db.purchases.get("t12purchase0003")).not.toBeUndefined();
  });

  it("createPurchase → create() PB → dates système au format PB + miroir Dexie", async () => {
    await productsStore.createPurchase(TEST_PRODUCT_ID, [{ q: 3, u: "l" }], {});
    await waitForTick(5);

    // Server side: the fake stamped native PB system fields
    const serverRecords = currentFakePb().records("purchases");
    const created = serverRecords.find(
      (r) => (r.products as string[] | null)?.includes(TEST_PRODUCT_ID) && r.quantity === 3,
    );
    expect(created).toBeDefined();
    expect(typeof created!.created).toBe("string");
    expect(created!.created).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(created!.updated).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Dexie mirror (optimistic confirm) + reactive propagation
    const local = await db.purchases.get(created!.id);
    expect(local).toBeDefined();
    expect(local!.updated).toBe(created!.updated);
    const model = productsStore.getEnrichedProductById(TEST_PRODUCT_ID);
    expect(model!.purchases.length).toBeGreaterThanOrEqual(2);
  });

  it("syncRevalidate() ne toggle pas #loading (revalidation silencieuse)", async () => {
    currentFakePb().putRecord(
      "products",
      makeProductRecord({ productName: "Silencieux", updated: pbDate(T1) }),
    );

    expect(productsStore.loading).toBe(false);
    const pending = productsStore.syncRevalidate();
    expect(productsStore.loading).toBe(false); // pendant le fetch
    await pending;
    await waitForTick(5);
    expect(productsStore.loading).toBe(false); // après

    // ...et la revalidation a bien livré la donnée
    expect(
      productsStore.getEnrichedProductById(TEST_PRODUCT_ID)!.productName,
    ).toBe("Silencieux");
  });

  it("syncInitial() toggle #loading (premier chargement)", async () => {
    currentFakePb().putRecord(
      "products",
      makeProductRecord({ productName: "Avec loading", updated: pbDate(T1) }),
    );

    const pending = productsStore.syncInitial();
    // runWithLoading pose #loading = true de façon synchrone
    expect(productsStore.loading).toBe(true);
    await pending;
    await waitForTick(5);
    expect(productsStore.loading).toBe(false); // finally
    expect(
      productsStore.getEnrichedProductById(TEST_PRODUCT_ID)!.productName,
    ).toBe("Avec loading");
  });

  it("syncRevalidate() déjà en cours → skip silencieux (pas de second fetch)", async () => {
    currentFakePb().putRecord(
      "products",
      makeProductRecord({ productName: "Garde", updated: pbDate(T1) }),
    );
    const gate = gateGetFullList(currentFakePb());

    const first = productsStore.syncRevalidate();
    const second = productsStore.syncRevalidate(); // doit skipper
    await waitForTick(5); // laisse la 1re passe atteindre getFullList (gated)
    expect(gate.count()).toBe(2); // products + purchases, une seule passe

    gate.release();
    await first;
    await second;
    await waitForTick(5);
    expect(gate.count()).toBe(2); // toujours une seule passe
    gate.restore();

    expect(
      productsStore.getEnrichedProductById(TEST_PRODUCT_ID)!.productName,
    ).toBe("Garde");
  });

  it("logout en vol → résultat discardé (lastSync non avancé)", async () => {
    currentFakePb().putRecord(
      "products",
      makeProductRecord({ productName: "Discard", updated: pbDate(T1) }),
    );
    const gate = gateGetFullList(currentFakePb());
    const lastSyncBefore = productsStore.lastSync;

    const pending = productsStore.syncRevalidate();
    await waitForTick(5); // laisse la passe atteindre getFullList (gated)

    // Un autre utilisateur prend le relais pendant que le fetch est en vol.
    setMockUserId("next-user");
    try {
      gate.release();
      await pending;
      await waitForTick(5);

      // Le résultat de la passe de l'utilisateur précédent est discardé : il
      // ne doit pas marquer la cache fraîche (lastSync inchangé).
      expect(productsStore.lastSync).toBe(lastSyncBefore);

      // La garde #revalidating est bien relâchée : une passe suivante marche.
      await productsStore.syncRevalidate();
      await waitForTick(5);
      expect(productsStore.lastSync).not.toBe(lastSyncBefore);
    } finally {
      setMockUserId("test-user");
      gate.restore();
    }
  });
});
