/**
 * @vitest-environment jsdom
 */

/**
 * pb-sync scoped cursor + atomicity — Étape 3 du portage (scopeKey + syncMeta).
 *
 * Pins the cursor contract that kills the multi-scope silent data loss:
 *  - the delta cursor is PERSISTED per scope in `db.syncMeta`
 *    (`${collection}:${scopeKey}`), never derived from the table max
 *    (the old behavior missed every record whose `updated` predates the
 *    newest record of ANOTHER scope);
 *  - the delta filter is `updated >= {:since}` — boundary records replay,
 *    the by-id upsert makes it idempotent;
 *  - upserts + cursor advance live in ONE Dexie transaction — a failed
 *    upsert must leave the cursor untouched;
 *  - clearLocal() removes the collection's scoped cursors by prefix
 *    (`materiel:` must not match `materiel_loan:x`);
 *  - the "delta empty + empty table → full fetch" fallback is preserved.
 *
 * Targets `createSyncCollection` directly (the sync layer under test),
 * with the fake PB serving records through the REAL initialFetch.
 */

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { makeProductRecord } from "./harness/fixtures";
import { createSyncCollection, db, pb } from "$lib/db-sync/pb-sync";

// 15-char PB-shaped ids.
const E1 = "t13event00000e1";
const E2 = "t13event00000e2";

// Fixed PB datetimes — lexical comparison is the whole contract.
const T_OLD = pbDate(new Date("2026-01-10T09:00:00.000Z"));
const T_MID = pbDate(new Date("2026-02-10T09:00:00.000Z"));
const T_OLD2 = pbDate(new Date("2026-01-20T09:00:00.000Z"));
const T_RECENT = pbDate(new Date("2026-03-10T09:00:00.000Z"));

/** Standard per-event fetch options — filter + scoped cursor key. */
const eventFilter = (eventId: string) => ({
  filter: ["eventId = {:eventId}", { eventId }] as [
    string,
    Record<string, unknown>,
  ],
  scopeKey: eventId,
});

const products = createSyncCollection(pb, db.products, "products");

describe("pb-sync curseur scopé — scénario multi-événements", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("event1 sync → event2 sync → retour event1 : la mutation e1 intervenue entre-temps est fetchée", async () => {
    const fakePb = currentFakePb();

    // 1. Sync event 1 (ancien)
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000001", eventId: E1, updated: T_OLD }),
    ]);
    await products.initialFetch(eventFilter(E1));

    // 2. Sync event 2 (récent) — pousse le max local à T_RECENT
    fakePb.putRecord(
      "products",
      makeProductRecord({
        id: "t13prod00000002",
        eventId: E2,
        updated: T_RECENT,
      }),
    );
    await products.initialFetch(eventFilter(E2));

    // 3. Mutation côté serveur sur l'event 1 pendant la fenêtre event 2
    //    (updated entre les deux curseurs)
    fakePb.putRecord(
      "products",
      makeProductRecord({
        id: "t13prod00000003",
        eventId: E1,
        updated: T_MID,
        productName: "Ajouté pendant event2",
      }),
    );

    // 4. Retour à l'event 1 — la mutation doit arriver
    await products.initialFetch(eventFilter(E1));

    const ids = (await db.products.toArray()).map((p) => p.id).sort();
    expect(ids).toEqual([
      "t13prod00000001",
      "t13prod00000002",
      "t13prod00000003",
    ]);
  });

  it("première ouverture d'un event ancien après un event récent → ses records sont fetchés (pas de trou silencieux)", async () => {
    const fakePb = currentFakePb();

    // Event récent d'abord
    fakePb.seed("products", [
      makeProductRecord({
        id: "t13prod00000002",
        eventId: E2,
        updated: T_RECENT,
      }),
    ]);
    await products.initialFetch(eventFilter(E2));

    // Event ancien jamais ouvert : ses records ont un updated ANTIÉRIEUR au max local
    fakePb.putRecord(
      "products",
      makeProductRecord({ id: "t13prod00000001", eventId: E1, updated: T_OLD }),
    );
    await products.initialFetch(eventFilter(E1));

    const local = await db.products.get("t13prod00000001");
    expect(local).toBeDefined();
  });

  it("2e sync identique → contenu et curseur stables (idempotence, frontière >=)", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000001", eventId: E1, updated: T_OLD }),
      makeProductRecord({
        id: "t13prod00000004",
        eventId: E1,
        updated: T_OLD2,
      }),
    ]);
    await products.initialFetch(eventFilter(E1));
    const before = await db.products.toArray();

    // Mutation SANS bump updated : jamais ramenée par le delta lexical
    fakePb.putRecord(
      "products",
      makeProductRecord({
        id: "t13prod00000001",
        eventId: E1,
        updated: T_OLD,
        productName: "Hors curseur",
      }),
    );

    await products.initialFetch(eventFilter(E1));
    const after = await db.products.toArray();

    expect(after.map((p) => [p.id, p.updated, p.productName])).toEqual(
      before.map((p) => [p.id, p.updated, p.productName]),
    );
    // Le curseur du scope est posé au max observé et ne recule pas
    expect((await db.syncMeta.get(`products:${E1}`))!.lastSync).toBe(T_OLD2);
  });

  it("mutation à l'updated EXACT du curseur → ramenée par >= (sémantique frontière)", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000001", eventId: E1, updated: T_OLD }),
    ]);
    await products.initialFetch(eventFilter(E1));

    // Remote edit keeping the SAME updated as the persisted cursor: a `>`
    // filter would silently drop it, `>=` replays it (idempotent upsert).
    fakePb.putRecord(
      "products",
      makeProductRecord({
        id: "t13prod00000001",
        eventId: E1,
        updated: T_OLD,
        productName: "Muté même timestamp",
      }),
    );

    await products.initialFetch(eventFilter(E1));

    const local = await db.products.get("t13prod00000001");
    expect(local!.productName).toBe("Muté même timestamp");
  });
});

describe("pb-sync curseur syncMeta — atomicité", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("sync réussie → syncMeta porte le curseur du scope (max lexical, par scope)", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000001", eventId: E1, updated: T_OLD }),
      makeProductRecord({ id: "t13prod00000003", eventId: E1, updated: T_MID }),
    ]);
    await products.initialFetch(eventFilter(E1));

    const meta = await db.syncMeta.get(`products:${E1}`);
    expect(meta).toBeDefined();
    expect(meta!.lastSync).toBe(T_MID);

    // Un autre scope écrit sa propre ligne — les curseurs sont indépendants
    fakePb.putRecord(
      "products",
      makeProductRecord({
        id: "t13prod00000002",
        eventId: E2,
        updated: T_RECENT,
      }),
    );
    await products.initialFetch(eventFilter(E2));

    expect((await db.syncMeta.get(`products:${E2}`))!.lastSync).toBe(T_RECENT);
    expect((await db.syncMeta.get(`products:${E1}`))!.lastSync).toBe(T_MID);
  });

  it("échec d'upsert → transaction avortée : ni records, ni curseur avancé", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000001", eventId: E1, updated: T_OLD }),
      makeProductRecord({ id: "t13prod00000003", eventId: E1, updated: T_MID }),
    ]);

    // 2e upsert (le 2e record trié par updated) échoue — le 1er doit être
    // rollbacké avec le curseur.
    const originalPut = db.products.put.bind(db.products);
    let putCalls = 0;
    const spy = vi.spyOn(db.products, "put").mockImplementation((item) => {
      putCalls += 1;
      if (putCalls === 2) throw new Error("simulated upsert failure");
      return originalPut(item);
    });

    try {
      await expect(products.initialFetch(eventFilter(E1))).rejects.toThrow(
        "simulated upsert failure",
      );
      // Rollback : le 1er upsert n'a pas survécu à l'abort
      expect(await db.products.get("t13prod00000001")).toBeUndefined();
      // Le curseur n'a pas avancé
      expect(await db.syncMeta.get(`products:${E1}`)).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("pb-sync clearLocal — purge des curseurs scopés par préfixe", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("clearLocal() vide la table ET les curseurs de la collection, préserve les autres", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000001", eventId: E1, updated: T_OLD }),
    ]);
    await products.initialFetch(eventFilter(E1));
    await db.syncMeta.bulkPut([
      { collectionId: "products", lastSync: T_OLD },
      { collectionId: "materiel", lastSync: T_OLD },
      { collectionId: "materiel:x", lastSync: T_OLD },
      { collectionId: "events", lastSync: T_OLD },
    ]);

    await products.clearLocal();

    expect(await db.products.count()).toBe(0);
    const keys = (await db.syncMeta.toArray())
      .map((m) => m.collectionId)
      .sort();
    expect(keys).toEqual(["events", "materiel", "materiel:x"]);
  });

  it("collision de préfixe : clearLocal(materiel) ne touche pas materiel_loan:*", async () => {
    await db.syncMeta.bulkPut([
      { collectionId: "materiel", lastSync: T_OLD },
      { collectionId: "materiel:x", lastSync: T_OLD },
      { collectionId: "materiel_loan:x", lastSync: T_OLD },
    ]);
    const materiel = createSyncCollection(pb, db.materiels, "materiel");

    await materiel.clearLocal();

    const keys = (await db.syncMeta.toArray())
      .map((m) => m.collectionId)
      .sort();
    expect(keys).toEqual(["materiel_loan:x"]);
  });
});

describe("pb-sync initialFetch — fallback table vide conservé", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("delta vide + table vide → full fetch (records sans updated, import legacy)", async () => {
    const fakePb = currentFakePb();
    // `updated: ""` ne franchit jamais le filtre delta lexical (epoch)
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000009", eventId: E1, updated: "" }),
    ]);

    await products.initialFetch(eventFilter(E1));

    expect(await db.products.get("t13prod00000009")).toBeDefined();
  });
});
