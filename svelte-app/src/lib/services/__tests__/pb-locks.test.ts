/**
 * @vitest-environment jsdom
 */

/**
 * locksService — contrat du socle de verrouillage (collection `locks`).
 *
 * La migration du lock recette (ex-champ `recipes.lockedBy`) repose sur ce
 * contrat : TTL via `expiresAt`, refus du lock actif d'autrui, takeover du
 * lock expiré, heartbeat = ré-acquisition, release idempotent (404 → no-op).
 * Le fake PB transporte les mêmes sémantiques 404/CRUD que le serveur.
 */

vi.mock("pocketbase", async () => {
  const { FakePocketBase } =
    await import("../../stores/__tests__/harness/stub-pb");
  return { default: FakePocketBase };
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate } from "../../stores/__tests__/harness/stub-pb";
import { locksService } from "$lib/services/pb-locks";

const T0 = new Date("2026-06-01T12:00:00.000Z");
const future = () => pbDate(new Date(Date.now() + 7 * 60 * 1000));
const past = () => pbDate(new Date(Date.now() - 60 * 1000));

function lockRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "recipe_r1",
    userId: "user_a",
    userName: "alice",
    expiresAt: future(),
    created: pbDate(T0),
    updated: pbDate(T0),
    ...overrides,
  };
}

describe("locksService — contrat du verrou", () => {
  beforeEach(() => {
    currentFakePb().reset();
    // L'instance fake est un singleton : restaurer les propriétés espionnées
    // par les tests précédents (sinon le bind capture le mock voisin).
    vi.restoreAllMocks();
  });

  it("getLock : 404 → null", async () => {
    expect(await locksService.getLock("recipe_absent")).toBeNull();
  });

  it("getLock : actif → Lock normalisé", async () => {
    currentFakePb().seed("locks", [lockRecord()]);
    const lock = await locksService.getLock("recipe_r1");
    expect(lock).toMatchObject({ id: "recipe_r1", userId: "user_a" });
  });

  it("getLock : expiré → null", async () => {
    currentFakePb().seed("locks", [lockRecord({ expiresAt: past() })]);
    expect(await locksService.getLock("recipe_r1")).toBeNull();
  });

  it("acquireLock : sans document → crée et renvoie le verrou créé", async () => {
    const lock = await locksService.acquireLock("recipe_r1", "user_b", "bob");
    expect(lock).toMatchObject({
      id: "recipe_r1",
      userId: "user_b",
      userName: "bob",
    });
    const stored = await locksService.getLock("recipe_r1");
    expect(stored).toMatchObject({ userId: "user_b", userName: "bob" });
  });

  it("acquireLock : actif d'autrui → renvoie le verrou détenu, sans écriture", async () => {
    currentFakePb().seed("locks", [lockRecord()]);
    const lock = await locksService.acquireLock("recipe_r1", "user_b", "bob");
    // Le refus transporte l'état : l'appelant verrouille la page immédiatement
    expect(lock.userId).toBe("user_a");
    expect(await locksService.getLock("recipe_r1")).toMatchObject({
      userId: "user_a",
    });
  });

  it("acquireLock : même utilisateur → heartbeat (refresh du TTL)", async () => {
    currentFakePb().seed("locks", [lockRecord({ expiresAt: future() })]);
    const lock = await locksService.acquireLock("recipe_r1", "user_a", "alice");
    expect(lock.userId).toBe("user_a");
    expect(new Date(lock.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 6 * 60 * 1000,
    );
  });

  it("acquireLock : expiré d'autrui → takeover", async () => {
    currentFakePb().seed("locks", [lockRecord({ expiresAt: past() })]);
    const lock = await locksService.acquireLock("recipe_r1", "user_b", "bob");
    expect(lock).toMatchObject({ userId: "user_b" });
    expect(await locksService.getLock("recipe_r1")).toMatchObject({
      userId: "user_b",
    });
  });

  it("acquireLock : erreur serveur au getOne (non 404) → lève (panne ≠ refus)", async () => {
    const fakePb = currentFakePb();
    const original = fakePb.collection.bind(fakePb);
    vi.spyOn(fakePb, "collection").mockImplementation((name: string) => {
      const api = original(name);
      if (name === "locks") {
        return {
          ...api,
          getOne: async () => {
            throw { status: 500, message: "boom" };
          },
        };
      }
      return api;
    });

    await expect(
      locksService.acquireLock("recipe_r1", "user_b", "bob"),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("acquireLock : course de création (400 not_unique) → lève", async () => {
    const fakePb = currentFakePb();
    const original = fakePb.collection.bind(fakePb);
    vi.spyOn(fakePb, "collection").mockImplementation((name: string) => {
      const api = original(name);
      if (name === "locks") {
        return {
          ...api,
          create: async () => {
            throw { status: 400, message: "Failed to create record." };
          },
        };
      }
      return api;
    });

    await expect(
      locksService.acquireLock("recipe_r1", "user_b", "bob"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("releaseLock : réinitialise le verrou", async () => {
    currentFakePb().seed("locks", [lockRecord()]);
    await locksService.releaseLock("recipe_r1", "user_a");
    expect(await locksService.getLock("recipe_r1")).toBeNull();
  });

  it("releaseLock : verrou absent → no-op sans erreur", async () => {
    await expect(
      locksService.releaseLock("recipe_absent", "user_a"),
    ).resolves.toBeUndefined();
  });
});
