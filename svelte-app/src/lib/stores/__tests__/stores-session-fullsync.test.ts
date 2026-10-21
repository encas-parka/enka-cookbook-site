/**
 * @vitest-environment jsdom
 */

/**
 * Stores — contrat « sync de session » (ADR 0001 « curseurs de session »)
 * au niveau des stores à grant dynamique.
 *
 * Le contrat : `syncInitial` reset le curseur AVANT le fetch — le fetch
 * complet qui suit rattrape tout ce qui a été manqué pendant l'absence,
 * y compris les records devenus visibles par élargissement d'autorisation
 * sans être modifiés (`updated` ancien, invisible au delta comme au SSE).
 * `syncRevalidate` reste un delta — sauf au-delà du TTL de session (24 h),
 * où un filet repasse par le full.
 *
 * Seam : vrais stores + vrai pb-sync + transport PB factice + fake-indexeddb
 * (même machinerie que events-store-create / materiel-store-loan-sync).
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

import { describe, it, expect, beforeEach, vi } from "vitest";
import { currentFakePb, pbDate } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import {
  makeEvent,
  makeMaterielRecord,
  makeLoanRecord,
} from "./harness/fixtures";
import { eventsStore } from "$lib/stores/EventsStore.svelte";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import { db } from "$lib/db-sync/pb-sync";

// Curseur établi par les données fraîches ; les records "grant élargi"
// portent un updated strictement antérieur — invisibles au delta comme au SSE.
const T_CACHE = pbDate(new Date("2026-06-08T11:30:00.000Z"));
const T_OLD = pbDate(new Date("2026-01-10T09:00:00.000Z"));

describe("EventsStore — sync de session", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
    await waitForTick(1);
  });

  it("syncInitial reset le curseur : un record ancien post-curseur est ramené", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("events", [
      makeEvent({
        id: "sessdev00000001",
        createdBy: "testuser12345678",
        updated: T_CACHE,
      }),
    ]);
    await eventsStore.syncInitial();
    expect(await db.events.get("sessdev00000001")).toBeTruthy();

    // Grant élargi pendant l'absence : record ancien, jamais modifié
    fakePb.putRecord(
      "events",
      makeEvent({ id: "sessdev00000002", updated: T_OLD }),
    );

    // La revalidation est un delta : muet (curseur postérieur)
    await eventsStore.syncRevalidate();
    expect(await db.events.get("sessdev00000002")).toBeUndefined();

    // La sync de session reset le curseur : full fetch → ramené
    await eventsStore.syncInitial();
    expect(await db.events.get("sessdev00000002")).toBeTruthy();
  });

  it("TTL 24h : une revalidation au-delà repasse par un full de session", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("events", [
      makeEvent({ id: "sessdev00000003", updated: T_CACHE }),
    ]);
    await eventsStore.syncInitial();

    fakePb.putRecord(
      "events",
      makeEvent({ id: "sessdev00000004", updated: T_OLD }),
    );

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      // +25 h depuis le dernier full de session (fake Date initialisé à
      // l'horloge réelle) : le filet TTL doit déclencher le reset
      vi.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000));
      await eventsStore.syncRevalidate();
      expect(await db.events.get("sessdev00000004")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MaterielStore — sync de session (deux curseurs)", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    await clearDexie();
    await waitForTick(1);
  });

  it("syncInitial reset materiel ET materiel_loan : les deux collections rattrapent", async () => {
    const fakePb = currentFakePb();
    fakePb.seed("materiel", [
      makeMaterielRecord({ id: "sessmat00000001", updated: T_CACHE }),
    ]);
    fakePb.seed("materiel_loan", [
      makeLoanRecord({ id: "sessloan0000001", updated: T_CACHE }),
    ]);
    await materielStore.syncInitial();
    expect(await db.materiels.get("sessmat00000001")).toBeTruthy();
    expect(await db.materielLoans.get("sessloan0000001")).toBeTruthy();

    // Grants élargis pendant l'absence : records anciens, non modifiés
    fakePb.putRecord(
      "materiel",
      makeMaterielRecord({ id: "sessmat00000002", updated: T_OLD }),
    );
    fakePb.putRecord(
      "materiel_loan",
      makeLoanRecord({ id: "sessloan0000002", updated: T_OLD }),
    );

    // Delta : muet sur les deux tables
    await materielStore.syncRevalidate();
    expect(await db.materiels.get("sessmat00000002")).toBeUndefined();
    expect(await db.materielLoans.get("sessloan0000002")).toBeUndefined();

    // Sync de session : les DEUX curseurs sont resetés
    await materielStore.syncInitial();
    expect(await db.materiels.get("sessmat00000002")).toBeTruthy();
    expect(await db.materielLoans.get("sessloan0000002")).toBeTruthy();
  });
});
