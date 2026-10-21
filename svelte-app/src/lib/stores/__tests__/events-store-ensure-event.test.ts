/**
 * @vitest-environment jsdom
 */

/**
 * EventsStore — contrat `ensureEvent` : matérialisation ciblée d'un event
 * absent du cache local, le point d'attente que `eventGuard` consomme.
 *
 * Cause racine : une page qui monte sur `getEventById(id) === null` sort
 * silencieusement — le store confond « pas encore chargé » et « absent »
 * (bug meals/produits après login, cache froid). `ensureEvent` donne aux
 * guards un point d'attente borné, sans attendre la sync complète.
 *
 * Contrats épinglés :
 *  - cache froid : `view` ciblé + écriture Dexie (le bridge propage) ;
 *  - cache chaud : aucun appel réseau ;
 *  - 404 / indisponible : `null`, jamais un throw (un guard ne doit pas
 *    bloquer la navigation sur une absence) ;
 *  - deux appels concurrents pour le même id : un seul fetch ;
 *  - attente bornée par timeout : la navigation rend la main.
 */

vi.mock("$lib/services/pb-users", () => ({
  lookupUsersByEmails: vi.fn(),
}));

vi.mock("$lib/services/pb-invitations", () => ({
  getEventShareLinks: vi.fn(async () => {
    throw new Error("no share links in unit test");
  }),
  createShareLink: vi.fn(),
}));

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "testuser12345678",
    isAuthenticated: true,
  },
}));

vi.mock("pocketbase", async () => {
  const { FakePocketBase } = await import("./harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { currentFakePb } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import { makeEvent } from "./harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { db } from "$lib/db-sync/pb-sync";

describe("EventsStore — ensureEvent", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
    await waitForTick(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cache froid : matérialise l'event dans Dexie et le retourne enrichi", async () => {
    currentFakePb().seed("events", [
      makeEvent({
        id: "ensure0000000001",
        createdBy: "testuser12345678",
        meals: [],
      }),
    ]);

    const event = await eventsStore.ensureEvent("ensure0000000001");

    expect(event?.id).toBe("ensure0000000001");
    expect(event?.meals).toEqual([]);
    // La source de vérité UI reste le bridge : l'écriture Dexie est posée.
    expect(await db.events.get("ensure0000000001")).toBeTruthy();
  });

  it("cache chaud : aucun appel réseau", async () => {
    const fake = currentFakePb();
    fake.seed("events", [
      makeEvent({ id: "ensure0000000002", createdBy: "testuser12345678" }),
    ]);
    await eventsStore.syncInitial();
    await waitForTick(1);

    const collectionSpy = vi.spyOn(fake, "collection");
    const event = await eventsStore.ensureEvent("ensure0000000002");

    expect(event?.id).toBe("ensure0000000002");
    expect(collectionSpy).not.toHaveBeenCalled();
  });

  it("event absent (404) : null, sans jeter", async () => {
    await expect(
      eventsStore.ensureEvent("missing000000001"),
    ).resolves.toBeNull();
    expect(await db.events.get("missing000000001")).toBeUndefined();
  });

  it("deux appels concurrents pour le même id : un seul fetch", async () => {
    const fake = currentFakePb();
    fake.seed("events", [
      makeEvent({ id: "ensure0000000003", createdBy: "testuser12345678" }),
    ]);

    let getOneCalls = 0;
    const original = fake.collection.bind(fake);
    vi.spyOn(fake, "collection").mockImplementation(((name: string) => {
      const collection = original(name);
      const getOne = collection.getOne.bind(collection);
      collection.getOne = ((...args: unknown[]) => {
        getOneCalls++;
        return getOne(...(args as [string]));
      }) as typeof collection.getOne;
      return collection;
    }) as typeof fake.collection);

    const [a, b] = await Promise.all([
      eventsStore.ensureEvent("ensure0000000003"),
      eventsStore.ensureEvent("ensure0000000003"),
    ]);

    expect(a?.id).toBe("ensure0000000003");
    expect(b?.id).toBe("ensure0000000003");
    expect(getOneCalls).toBe(1);
  });

  it("attente bornée : un serveur muet rend la main après timeoutMs", async () => {
    const fake = currentFakePb();
    vi.spyOn(fake, "collection").mockImplementation((() => ({
      getOne: () => new Promise(() => {}),
    })) as typeof fake.collection);

    const event = await eventsStore.ensureEvent("slow000000000001", 20);

    expect(event).toBeNull();
  });
});
