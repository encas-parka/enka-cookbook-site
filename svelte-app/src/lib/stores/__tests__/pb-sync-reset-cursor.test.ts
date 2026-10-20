/**
 * @vitest-environment jsdom
 */

/**
 * pb-sync resetCursor — invalidation du curseur delta.
 *
 * Le trou P12 (click-through 20-10) : quand le périmètre autorisé s'élargit
 * (join d'event par share link, invitation team), des records deviennent
 * visibles côté serveur avec un `updated` ANTÉRIEUR au curseur local —
 * aucun delta ne les ramène jamais. `resetCursor()` supprime la clé
 * `syncMeta` : le prochain `initialFetch` repart de l'époque et rejoue un
 * fetch complet en upserts idempotents, sans vider la table (pas de
 * fenêtre d'état vide).
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

// Fixed PB datetimes — lexical comparison is the whole contract.
const T_GRANTED = pbDate(new Date("2026-01-10T09:00:00.000Z"));
const T_CURSOR = pbDate(new Date("2026-03-10T09:00:00.000Z"));

const products = createSyncCollection(pb, db.products, "products");

describe("pb-sync resetCursor — élargissement de périmètre", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("un record autorisé antérieur au curseur est invisible au delta, visible après resetCursor", async () => {
    const fakePb = currentFakePb();

    // Sync initiale : un produit connu, le curseur monte à T_CURSOR
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000001", updated: T_CURSOR }),
    ]);
    await products.initialFetch();

    // Un second produit devient autorisé (join) SANS être modifié :
    // son `updated` est antérieur au curseur
    fakePb.putRecord(
      "products",
      makeProductRecord({ id: "t13prod00000002", updated: T_GRANTED }),
    );

    // Le delta ne le ramène pas — c'est le trou P12
    await products.initialFetch();
    expect(await db.products.get("t13prod00000002")).toBeUndefined();

    // resetCursor → le prochain fetch repart de l'époque, l'upsert le ramène
    await products.resetCursor();
    await products.initialFetch();
    const restored = await db.products.get("t13prod00000002");
    expect(restored).toBeDefined();

    // Le premier produit est toujours là (upserts idempotents, pas de purge)
    expect(await db.products.get("t13prod00000001")).toBeDefined();
  });

  it("resetCursor sur un scope n'invalide que ce scope", async () => {
    const fakePb = currentFakePb();
    const eventFilter = (eventId: string) => ({
      filter: ["eventId = {:eventId}", { eventId }] as [
        string,
        Record<string, unknown>,
      ],
      scopeKey: eventId,
    });

    fakePb.seed("products", [
      makeProductRecord({
        id: "t13prod00000003",
        eventId: "t13event00000e1",
        updated: T_CURSOR,
      }),
    ]);
    await products.initialFetch(eventFilter("t13event00000e1"));

    // Le curseur non-scopé est posé : resetCursor scopé ne doit pas l'effacer
    await db.syncMeta.put({ collectionId: "products", lastSync: T_CURSOR });
    await products.resetCursor("t13event00000e1");

    expect(await db.syncMeta.get("products:t13event00000e1")).toBeUndefined();
    expect(await db.syncMeta.get("products")).toBeDefined();
  });
});
