/**
 * @vitest-environment jsdom
 */

/**
 * pb-collection — bulk* découpés à la limite batch PocketBase.
 *
 * Le serveur rejette un batch portant plus de sous-requêtes que son setting
 * `batch.maxRequests` (défaut 100). Les bulk* de pb-sync découpent donc en
 * lots — transparent pour l'appelant — et le rollback optimiste reste PAR
 * LOT : les lots déjà envoyés avant un lot qui échoue restent committés
 * (côté serveur comme au miroir Dexie).
 */

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("../../stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb } from "../../stores/__tests__/harness/stub-pb";
import { clearDexie } from "../../stores/__tests__/harness/seed-dexie";
import {
  makeProductRecord,
  TEST_PRODUCT_ID,
} from "../../stores/__tests__/harness/fixtures";
import {
  createSyncCollection,
  db,
  pb,
  PB_BATCH_MAX_REQUESTS,
} from "$lib/db-sync/pb-sync";
import type { Products } from "$lib/types/pb";

/** 15 chars, PB-id shaped, unique par index. */
const bulkId = (i: number) => `bulk${String(i).padStart(12, "0")}`;

function productsCollection() {
  return createSyncCollection<Products>(pb, db.products, "products");
}

/** Payload create (champs système retirés) pour l'index i. */
function bulkPayload(i: number) {
  const { id: _id, created: _c, updated: _u, ...payload } = makeProductRecord({
    id: bulkId(i),
    productName: `Bulk ${i}`,
  });
  return payload;
}

describe("pb-collection — bulk* découpés à la limite batch PB", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("bulkCreate au-delà de la limite : découpage en lots, serveur et miroir complets", async () => {
    const col = productsCollection();
    const spy = vi.spyOn(currentFakePb(), "createBatch");
    const items = Array.from({ length: PB_BATCH_MAX_REQUESTS + 5 }, (_, i) =>
      bulkPayload(i),
    );

    const records = await col.bulkCreate(items);

    expect(spy).toHaveBeenCalledTimes(2); // 100 + 5
    expect(records).toHaveLength(PB_BATCH_MAX_REQUESTS + 5);
    expect((await pb.collection("products").getFullList()).length).toBe(
      PB_BATCH_MAX_REQUESTS + 5,
    );
    expect(await db.products.count()).toBe(PB_BATCH_MAX_REQUESTS + 5);
    spy.mockRestore();
  });

  it("option batchSize : découpage plus fin que la limite serveur", async () => {
    const col = productsCollection();
    const spy = vi.spyOn(currentFakePb(), "createBatch");
    const items = Array.from({ length: 10 }, (_, i) => bulkPayload(i));

    const records = await col.bulkCreate(items, { batchSize: 3 });

    expect(spy).toHaveBeenCalledTimes(4); // 3 + 3 + 3 + 1
    expect(records).toHaveLength(10);
    spy.mockRestore();
  });

  it("rollback PAR LOT : un lot qui échoue préserve les lots déjà envoyés (serveur + miroir)", async () => {
    currentFakePb().seed("products", [
      makeProductRecord(),
      makeProductRecord({ id: bulkId(1), productName: "Bulk 1" }),
    ]);
    const col = productsCollection();
    await col.initialFetch();

    // Lot 1 = 2 updates valides, lot 2 = un id absent du serveur (404 transactionnel)
    const items = [
      { id: TEST_PRODUCT_ID, data: { productName: "Eau gazeuse" } },
      { id: bulkId(1), data: { productName: "Bulk 1 modifié" } },
      { id: "absent000000001", data: { productName: "X" } },
    ];

    await expect(col.bulkUpdate(items, { batchSize: 2 })).rejects.toMatchObject(
      { status: 404 },
    );

    // Lot 1 committé des deux côtés ; lot 2 absent des deux côtés
    const server = await pb.collection("products").getFullList();
    const names = Object.fromEntries(
      server.map((r) => [r.id, r.productName]),
    );
    expect(names[TEST_PRODUCT_ID]).toBe("Eau gazeuse");
    expect(names[bulkId(1)]).toBe("Bulk 1 modifié");
    expect(names["absent000000001"]).toBeUndefined();

    const local1 = await db.products.get(TEST_PRODUCT_ID);
    expect(local1?.productName).toBe("Eau gazeuse");
    const local2 = await db.products.get(bulkId(1));
    expect(local2?.productName).toBe("Bulk 1 modifié");
    expect(await db.products.get("absent000000001")).toBeUndefined();
  });

  it("bulkUpsert et bulkDelete partagent le même découpage", async () => {
    const col = productsCollection();
    const spy = vi.spyOn(currentFakePb(), "createBatch");
    const total = 2 * PB_BATCH_MAX_REQUESTS + 1;

    const items = Array.from({ length: total }, (_, i) => ({
      ...bulkPayload(i),
      id: bulkId(i),
    }));
    const records = await col.bulkUpsert(items);
    expect(spy).toHaveBeenCalledTimes(3); // 100 + 100 + 1
    expect(records).toHaveLength(total);

    await col.bulkDelete(items.map((item) => item.id));
    expect(spy).toHaveBeenCalledTimes(6); // 100 + 100 + 1
    expect(await pb.collection("products").getFullList()).toHaveLength(0);
    spy.mockRestore();
  });
});
