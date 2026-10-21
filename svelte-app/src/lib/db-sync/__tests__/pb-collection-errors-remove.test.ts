/**
 * @vitest-environment jsdom
 */

/**
 * pb-collection — erreurs typées et remove (soft/hard).
 *
 * Filet de régression sur des chemins absents des autres fichiers :
 * - attach serveur impossible (id absent du cache ET du serveur) →
 *   RecordNotFoundError (et non l'erreur générique Dexie) ;
 * - record hard-deleted côté serveur pendant qu'il est au cache →
 *   RecordDeletedError + miroir marqué `deleted` ;
 * - remove hard (défaut) / soft / idempotent sur 404 serveur.
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
  RecordDeletedError,
  RecordNotFoundError,
} from "$lib/db-sync/pb-sync";
import type { Products } from "$lib/types/pb";

/** 15 chars, PB-id shaped — id absent du serveur ET du cache. */
const MISSING_ID = "absent000000001";

function productsCollection(options?: { softDelete?: boolean }) {
  return createSyncCollection<Products>(pb, db.products, "products", options);
}

describe("pb-collection — erreurs typées", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("update d'un id absent du cache ET du serveur → RecordNotFoundError", async () => {
    const col = productsCollection();

    await expect(
      col.update(MISSING_ID, { productName: "X" }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
  });

  it("update d'un id hard-deleted côté serveur → RecordDeletedError + miroir marqué deleted", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    const col = productsCollection();
    await col.initialFetch();

    // Hard-delete côté serveur sans passer par la collection (autre device)
    currentFakePb().seed("products", []);

    await expect(
      col.update(TEST_PRODUCT_ID, { productName: "X" }),
    ).rejects.toBeInstanceOf(RecordDeletedError);

    const local = await db.products.get(TEST_PRODUCT_ID);
    expect(local?.deleted).toBe(true);
  });
});

describe("pb-collection — remove", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("hard-delete (défaut) : absent du serveur et du cache", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    const col = productsCollection();
    await col.initialFetch();

    await col.remove(TEST_PRODUCT_ID);

    expect(await pb.collection("products").getFullList()).toHaveLength(0);
    expect(await db.products.get(TEST_PRODUCT_ID)).toBeUndefined();
  });

  it("soft-delete : serveur vidé, miroir local porte deleted", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    const col = productsCollection({ softDelete: true });
    await col.initialFetch();

    await col.remove(TEST_PRODUCT_ID);

    expect(await pb.collection("products").getFullList()).toHaveLength(0);
    const local = await db.products.get(TEST_PRODUCT_ID);
    expect(local?.deleted).toBe(true);
  });

  it("remove d'un id déjà supprimé côté serveur (404) → idempotent", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    const col = productsCollection();
    await col.initialFetch();

    // Retirer côté serveur sans passer par la collection
    currentFakePb().seed("products", []);

    await expect(col.remove(TEST_PRODUCT_ID)).resolves.toBeUndefined();
    expect(await db.products.get(TEST_PRODUCT_ID)).toBeUndefined();
  });
});
