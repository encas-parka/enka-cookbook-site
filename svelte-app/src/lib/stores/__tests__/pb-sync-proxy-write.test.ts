/**
 * @vitest-environment jsdom
 */

/**
 * Boucle de diagnostic P2 (handoff click-through 26-10-07) — DataCloneError
 * à la sauvegarde d'un event.
 *
 * Chaîne du bug : EventEditPage passe son shadow draft réactif (`meals`,
 * proxy $state) à `eventsStore.updateEvent()` → `#collection.update()` →
 * écriture optimiste Dexie (`table.update`) → structured clone IndexedDB →
 * `DataCloneError: Proxy object could not be cloned`.
 *
 * Le test reproduit la chaîne au seam exact : `createSyncCollection().update()`
 * alimenté par un VRAI proxy $state (faux PB + vrai Dexie/fake-indexeddb).
 * Contrat cible : la frontière pb-sync normalise les payloads en objets
 * plain — aucun proxy ne doit atteindre Dexie, quel que soit l'appelant.
 */

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate, type PbRecord } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { makeReactiveMeals } from "./harness/reactive-fixtures.svelte";
import { createSyncCollection, db, pb } from "$lib/db-sync/pb-sync";
import type { Products } from "$lib/types/pb";

const PRODUCT_ID = "proxytest0000001";

function makeProductRecord(overrides: Partial<Products> = {}): Products {
  return {
    id: PRODUCT_ID,
    created: pbDate(new Date("2026-06-08T10:00:00.000Z")),
    updated: pbDate(new Date("2026-06-08T10:00:00.000Z")),
    eventId: "proxyevent0000001",
    ingredientRef: "eau",
    productName: "Eau",
    productType: "boissons",
    pF: false,
    pS: false,
    store: null,
    specs: null,
    status: "active",
    deleted: false,
    stockReel: null,
    who: null,
    previousNames: null,
    isMerged: false,
    mergedFrom: null,
    mergeDate: null,
    mergeReason: null,
    isSynced: true,
    mergedInto: null,
    totalNeededOverride: null,
    updatedBy: null,
    ...overrides,
  };
}

describe("pb-sync update — payload réactif ($state proxy) → Dexie", () => {
  beforeEach(async () => {
    // Seed du serveur PB fake (l'update distant doit réussir — on isole le
    // clone Dexie du reste de la chaîne) + Dexie (pré-requis de l'optimiste)
    currentFakePb().seed("products", [makeProductRecord()]);
    await clearDexie();
    await db.products.put(makeProductRecord());
  });

  it("contrôle : update avec payload plain passe", async () => {
    const collection = createSyncCollection<Products>(
      pb,
      db.products,
      "products",
    );
    const confirmed = await collection.update(PRODUCT_ID, {
      productName: "Eau plate",
    } as Partial<Products>);
    expect(confirmed.productName).toBe("Eau plate");
    const local = await db.products.get(PRODUCT_ID);
    expect(local?.productName).toBe("Eau plate");
  });

  it("update avec un payload contenant un proxy $state ne lève pas", async () => {
    const collection = createSyncCollection<Products>(
      pb,
      db.products,
      "products",
    );
    const reactiveMeals = makeReactiveMeals(); // proxy $state profond

    // Avant fix : DataCloneError "Proxy object could not be cloned"
    const confirmed = await collection.update(PRODUCT_ID, {
      specs: reactiveMeals,
    } as unknown as Partial<Products>);

    // Le payload persisté est plain (clone stable, plus de proxy)
    expect(() => structuredClone(confirmed)).not.toThrow();
    const local: PbRecord | undefined = await db.products.get(PRODUCT_ID);
    expect(local?.specs).toEqual([
      {
        id: "meal1",
        date: "2026-10-14T20:00:00.000Z",
        guests: 100,
        recipes: [{ recipeUuid: "rec1", plates: 100 }],
      },
    ]);
  });

  it("create avec un payload contenant un proxy $state ne lève pas", async () => {
    const collection = createSyncCollection<Products>(
      pb,
      db.products,
      "products",
    );
    const reactiveMeals = makeReactiveMeals();

    const created = await collection.create({
      id: "proxycreate0000001",
      ...makeProductRecord({ id: "proxycreate0000001" }),
      specs: reactiveMeals,
    } as unknown as Partial<Products> & { id: string });

    expect(() => structuredClone(created)).not.toThrow();
  });
});
