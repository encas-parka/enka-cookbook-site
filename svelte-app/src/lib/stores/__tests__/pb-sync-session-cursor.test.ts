/**
 * @vitest-environment jsdom
 */

/**
 * pb-sync — contrat de la politique « curseurs de session » (ADR 0001),
 * niveau couche de sync : l'epochFilter borne le fetch complet (curseur
 * absent), JAMAIS le delta (curseur posé) — les mutations des records hors
 * fenêtre restent rattrapées, seule la population initiale est bornée.
 * `dateEnd = ''` inclut les records sans date (champ non requis au schéma) :
 * une borne ne doit jamais rendre un record invisible.
 */

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { makeEvent } from "./harness/fixtures";
import { createSyncCollection, db, pb } from "$lib/db-sync/pb-sync";

const events = createSyncCollection(pb, db.events, "events");

// Fixed PB datetimes — lexical comparison is the whole contract.
const U0 = pbDate(new Date("2026-04-01T10:00:00.000Z"));
const U1 = pbDate(new Date("2026-05-01T10:00:00.000Z"));
const U2 = pbDate(new Date("2026-05-02T10:00:00.000Z"));
const FLOOR = pbDate(new Date("2026-07-01T00:00:00.000Z"));

const dateEndFloor = [
  "dateEnd >= {:floor} || dateEnd = ''",
  { floor: FLOOR },
] as [string, Record<string, unknown>];

describe("pb-sync epochFilter — borne du fetch complet, pas du delta", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("borne la population initiale, rattrape les mutations hors fenêtre", async () => {
    const fakePb = currentFakePb();
    // Trois events au même `updated` pour isoler l'effet de la borne :
    // futur (dans la fenêtre), passé lointain (hors fenêtre), sans date
    // (inclus — une borne ne rend jamais un record invisible)
    fakePb.seed("events", [
      makeEvent({ id: "sessevent000001", dateEnd: "2026-12-19", updated: U1 }),
      makeEvent({ id: "sessevent000002", dateEnd: "2026-02-01", updated: U1 }),
      makeEvent({ id: "sessevent000003", dateEnd: null, updated: U1 }),
    ]);

    // Curseur absent → fetch complet borné
    await events.initialFetch({ epochFilter: dateEndFloor });
    expect(await db.events.get("sessevent000001")).toBeTruthy();
    expect(await db.events.get("sessevent000002")).toBeUndefined();
    expect(await db.events.get("sessevent000003")).toBeTruthy();

    // Curseur posé → delta : la mutation d'un event hors fenêtre est
    // rattrapée (l'epochFilter ne s'applique plus)
    fakePb.putRecord(
      "events",
      makeEvent({ id: "sessevent000002", dateEnd: "2026-02-01", updated: U2 }),
    );
    await events.initialFetch({ epochFilter: dateEndFloor });
    expect(await db.events.get("sessevent000002")).toBeTruthy();
  });
});

describe("pb-sync sessionCursor — la politique de session vit dans la collection", () => {
  // L'option est par collection : une collection dédiée isole le contrat.
  const sessionEvents = createSyncCollection(pb, db.events, "events", {
    sessionCursor: true,
  });

  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
  });

  it("initialFetch ignore un curseur persisté — full de session inconditionnel", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("events", [makeEvent({ id: "sessframe00001", updated: U1 })]);
    // Curseur hérité d'une session précédente, AU-DESSUS des records : le
    // delta le respecterait (trou), le fetch de session non
    await db.syncMeta.put({
      collectionId: "events",
      lastSync: pbDate(new Date("2027-01-01T00:00:00.000Z")),
    });

    await sessionEvents.initialFetch();
    expect(await db.events.get("sessframe00001")).toBeTruthy();
    // Le curseur repart du réel (max updated du fetch), pas du futur hérité
    expect((await db.syncMeta.get("events"))?.lastSync).toBe(U1);
  });

  it("revalidate reste delta quand le full de session est frais", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("events", [makeEvent({ id: "sessframe00002", updated: U1 })]);
    await sessionEvents.initialFetch();

    // Record élargi STRICTEMENT sous le curseur (join manqué pendant la
    // déconnexion) : le delta intra-session ne le ramène pas — un record
    // à l'`updated` exact du curseur serait rejoué par `>=` (frontière)
    fakePb.putRecord(
      "events",
      makeEvent({ id: "sessframe00003", updated: U0 }),
    );
    await sessionEvents.revalidate();
    expect(await db.events.get("sessframe00003")).toBeUndefined();
  });

  it("revalidate repasse full au-delà du TTL par défaut", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("events", [makeEvent({ id: "sessframe00004", updated: U1 })]);
    await sessionEvents.initialFetch();
    fakePb.putRecord(
      "events",
      makeEvent({ id: "sessframe00005", updated: U0 }),
    );

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(vi.getRealSystemTime() + 25 * 60 * 60 * 1000);
    await sessionEvents.revalidate();
    vi.useRealTimers();

    expect(await db.events.get("sessframe00005")).toBeTruthy();
  });

  it("ttlMs est paramétrable par collection", async () => {
    const shortTtl = createSyncCollection(pb, db.events, "events", {
      sessionCursor: { ttlMs: 1_000 },
    });
    const fakePb = currentFakePb();
    fakePb.seed("events", [makeEvent({ id: "sessframe00006", updated: U1 })]);
    await shortTtl.initialFetch();
    fakePb.putRecord(
      "events",
      makeEvent({ id: "sessframe00007", updated: U0 }),
    );

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(vi.getRealSystemTime() + 2_000);
    await shortTtl.revalidate();
    vi.useRealTimers();

    expect(await db.events.get("sessframe00007")).toBeTruthy();
  });
});
