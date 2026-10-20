/**
 * @vitest-environment jsdom
 */

/**
 * pb-collection — primitive upsert (créer-ou-mettre-à-jour à id stable).
 *
 * Seam : vraie pb-collection + vrai Dexie (fake-indexeddb) + transport PB
 * factice dont le batch natif respecte le wire contract (PUT /records :
 * update si l'id existe, create sinon ; exécution transactionnelle).
 *
 * Contrat : l'appelant ne sait pas si le record existe déjà côté serveur —
 * la primitive tranche dans les deux sens, avec miroir Dexie après send et
 * annulation optimiste sur échec du lot (instantanés restaurés, lignes
 * neuves orphelines supprimées).
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
  TEST_EVENT_ID,
  TEST_PRODUCT_ID,
} from "../../stores/__tests__/harness/fixtures";
import { createSyncCollection, db, pb } from "$lib/db-sync/pb-sync";
import type { Products } from "$lib/types/pb";

/** 15 chars, PB-id shaped — id inexistant côté serveur au départ. */
const NEW_ID = "poivre000000001";
/** 15 chars, PB-id shape — id client porté par un create de lot. */
const CLIENT_ID = "selclientid001";
/** 15 chars, PB-id shaped — id absent du serveur ET du cache. */
const MISSING_ID = "absent000000001";

function productsCollection() {
  return createSyncCollection<Products>(pb, db.products, "products");
}

describe("pb-collection — primitive upsert", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("upsert sur id inexistant → create sous cet id, miroir Dexie confirmé", async () => {
    const col = productsCollection();
    const payload: Products = makeProductRecord({
      id: NEW_ID,
      productName: "Poivre",
      ingredientRef: "poivre",
    });

    const records = await col.bulkUpsert([payload]);

    // Serveur : créé verbatim sous l'id fourni, timestamps serveur
    expect(records).toHaveLength(1);
    const server = await pb.collection("products").getFullList();
    expect(server).toHaveLength(1);
    expect(server[0].id).toBe(NEW_ID);
    expect(server[0].productName).toBe("Poivre");
    expect(server[0].created).toBe(pbDateOf(server[0].created));

    // Miroir local : la ligne optimistic (sans timestamps) est remplacée
    // par le record confirmé (created/updated serveur présents)
    const local = await db.products.get(NEW_ID);
    expect(local?.productName).toBe("Poivre");
    expect(local?.created).toBe(server[0].created);
    expect(local?.updated).toBe(server[0].updated);
  });

  it("upsert sans id → create (id serveur généré), sucre unitaire", async () => {
    const col = productsCollection();
    const full = makeProductRecord({ productName: "Muscade" });
    const {
      id: _dropId,
      created: _dropCreated,
      updated: _dropUpdated,
      ...payload
    } = full;

    const confirmed = await col.upsert(payload);

    expect(confirmed.id).toMatch(/^[a-z0-9]{15}$/);
    const server = await pb.collection("products").getFullList();
    expect(server).toHaveLength(1);
    expect(server[0].productName).toBe("Muscade");
    const local = await db.products.get(confirmed.id);
    expect(local?.productName).toBe("Muscade");
  });

  it("upsert sur id existant → update : champs posés, created préservé, updated bumpé", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    const col = productsCollection();
    await col.initialFetch();

    const mutated: Products = makeProductRecord({ productName: "Eau gazeuse" });
    const batch = col.createBatch();
    batch.upsert(mutated);
    const { records } = await batch.send();

    // Serveur : mise à jour (pas de doublon), created d'origine conservé
    // (le strip keepId retire created/updated du body), updated bumpé
    expect(records).toHaveLength(1);
    const server = await pb.collection("products").getFullList();
    expect(server).toHaveLength(1);
    expect(server[0].productName).toBe("Eau gazeuse");
    expect(server[0].created).toBe(createDate());
    expect(server[0].updated).not.toBe(createDate());

    // Miroir local aligné sur le confirmé
    const local = await db.products.get(TEST_PRODUCT_ID);
    expect(local?.productName).toBe("Eau gazeuse");
    expect(local?.updated).toBe(server[0].updated);
  });

  it("rollback sur échec du lot : instantanés restaurés, lignes neuves orphelines supprimées, serveur intact", async () => {
    currentFakePb().seed("products", [makeProductRecord()]);
    const col = productsCollection();
    await col.initialFetch();

    const mutated: Products = makeProductRecord({ productName: "Eau gazeuse" });
    const fresh: Products = makeProductRecord({
      id: NEW_ID,
      productName: "Poivre",
    });

    const batch = col.createBatch();
    batch.upsert(mutated);
    batch.upsert(fresh);
    batch.update(MISSING_ID, { productName: "X" });

    // Le update d'un id inexistant avorte le lot entier (transactionnel)
    await expect(batch.send()).rejects.toMatchObject({ status: 404 });

    // Serveur : RIEN n'a été appliqué, même les requêtes qui précédaient l'échec
    const server = await pb.collection("products").getFullList();
    expect(server).toHaveLength(1);
    expect(server[0].productName).toBe("Eau");
    expect(server[0].updated).toBe(createDate());

    // Local : instantané de A restauré, ligne neuve Poivre supprimée,
    // aucune ligne fantôme pour l'id manquant
    const restored = await db.products.get(TEST_PRODUCT_ID);
    expect(restored?.productName).toBe("Eau");
    expect(restored?.updated).toBe(createDate());
    expect(await db.products.get(NEW_ID)).toBeUndefined();
    expect(await db.products.get(MISSING_ID)).toBeUndefined();
  });

  it("id client sur create de lot : accepté au typage, stocké verbatim, miroir local", async () => {
    const col = productsCollection();

    const batch = col.createBatch();
    batch.create({
      eventId: TEST_EVENT_ID,
      ingredientRef: "sel",
      productName: "Sel fin",
      productType: "épices",
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
      id: CLIENT_ID,
    });
    const { records } = await batch.send();

    expect(records[0].id).toBe(CLIENT_ID);
    const server = await pb.collection("products").getFullList();
    expect(server).toHaveLength(1);
    expect(server[0].id).toBe(CLIENT_ID);
    const local = await db.products.get(CLIENT_ID);
    expect(local?.productName).toBe("Sel fin");
  });
});

/** created fixé par les fixtures (T0) — lisible dans les assertions. */
function createDate(): string {
  return makeProductRecord().created;
}

/** Garde-fou de forme PB sur un timestamp renvoyé par le fake. */
function pbDateOf(value: unknown): string {
  expect(typeof value).toBe("string");
  expect(value as string).toMatch(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
  return value as string;
}
