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

/**
 * Classe B de l'audit delta-sync : le « curseur empoisonné ». Un `updated`
 * futur (dérive d'horloge serveur, puis correction NTP) hisse le curseur
 * au-dessus du présent — tous les records écrits après correction passent
 * sous le curseur : trou permanent. Le garde `capToClientClock` plafonne le
 * curseur à l'horloge client (moins 5 min) : min() ne peut qu'abaisser le
 * curseur — au pire on re-fetch (upserts idempotents), jamais on ne saute.
 */
describe("pb-sync cap curseur — anti « curseur empoisonné »", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("un `updated` futur n'hisse pas le curseur au-dessus du plafond client", async () => {
    const fakePb = currentFakePb();
    // Dérive serveur : le record est estampillé 1 h dans le futur
    const T_FUTURE = pbDate(new Date(Date.now() + 60 * 60 * 1000));
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000004", updated: T_FUTURE }),
    ]);
    await products.initialFetch();

    const cursor = (await db.syncMeta.get("products"))?.lastSync ?? "";
    // Le curseur reste au format PB (espace, ms, Z — pas le `T` d'ISO)
    expect(cursor).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Plafonné strictement sous le futur, et pas absurde : dans la fenêtre
    // [horloge client − 6 min, horloge client] (marge 5 min + tolérance)
    expect(cursor < T_FUTURE).toBe(true);
    expect(cursor >= pbDate(new Date(Date.now() - 6 * 60 * 1000))).toBe(true);
  });

  it("les records écrits après correction serveur ne passent pas sous le curseur", async () => {
    const fakePb = currentFakePb();
    // Le serveur dérive, écrit un record futur, puis se corrige
    const T_FUTURE = pbDate(new Date(Date.now() + 60 * 60 * 1000));
    fakePb.seed("products", [
      makeProductRecord({ id: "t13prod00000005", updated: T_FUTURE }),
    ]);
    await products.initialFetch();

    // Record écrit APRÈS correction : `updated` ~ maintenant. Sans plafond,
    // le curseur vaudrait T_FUTURE > now : ce record serait invisible pour
    // toujours (le trou de classe B)
    fakePb.putRecord(
      "products",
      makeProductRecord({
        id: "t13prod00000006",
        updated: pbDate(new Date()),
      }),
    );
    await products.initialFetch();

    expect(await db.products.get("t13prod00000006")).toBeDefined();
  });
});
