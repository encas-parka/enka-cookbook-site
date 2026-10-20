/**
 * @vitest-environment jsdom
 */

/**
 * MaterielStore — write paths loan ↔ event_materiel (ticket 03).
 *
 * Seam : vrai store + vrai pb-sync + transport PB factice (sans réseau),
 * fake-indexeddb pour le vrai Dexie. Même machinerie que
 * products-store-create.test.ts.
 *
 * Couvre (causes racines mesurées par la sonde HTTP T03) :
 *  - createLoan avec event : le prêt ET ses lignes event_materiel (header +
 *    allocation) sont créés côté serveur et visibles dans le store sans
 *    refresh manuel
 *  - createLoan quand event_materiel est rejeté (rejet de règle 400) :
 *    compensation — aucun prêt fantôme ne survit (ni serveur ni Dexie), et
 *    l'échec ne pollue pas l'erreur globale du store (reste à l'appelant)
 *  - updateLoan quand event_materiel est rejeté : le prêt reste mis à jour
 *    (source de vérité de la disponibilité), erreur typée EventMaterielSyncError
 *    pour que l'appelant distingue l'échec partiel, erreur globale intacte
 *  - conflits de disponibilité : les prêts portant le marqueur local de
 *    suppression (pb-sync pose deleted:true sur un 404 d'update) ne comptent plus
 *  - fraîcheur : syncRevalidate ramène les prêts créés côté serveur dans le
 *    socle du calcul de conflits (le modal le déclenche à l'ouverture)
 */

// Mocks MUST be declared before importing the store under test
// (Vitest hoists `vi.mock` calls to the top of the file).
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
import { currentFakePb, pbDate, type FakePocketBase } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import {
  makeLoanRecord,
  makeMaterielRecord,
  TEST_EVENT_ID,
  TEST_TEAM_ID,
  TEST_MATERIEL_ID,
} from "./harness/fixtures";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
import { db, pb } from "$lib/db-sync/pb-sync";
import type { MaterielLoanItem } from "$lib/types/materiel.types";

const USER_ID = "testuser12345678";

/** Rejet de règle PocketBase tel que mesuré par la sonde T03 (create). */
function ruleRejection(): Error {
  const err = new Error("Failed to create record.") as Error & {
    status: number;
    response: { data: Record<string, never>; status: number };
  };
  err.status = 400;
  err.response = { data: {}, status: 400 };
  return err;
}

/** Fait échouer toute création event_materiel côté transport, comme une règle. */
function rejectEventMaterielWrites(fakePb: FakePocketBase): void {
  const original = fakePb.collection.bind(fakePb);
  vi.spyOn(fakePb, "collection").mockImplementation(((name: string) => {
    const col = original(name);
    if (name === "event_materiel") {
      return {
        ...col,
        create: async () => {
          throw ruleRejection();
        },
      };
    }
    return col;
  }) as typeof fakePb.collection);
}

async function seedAndInitialize(): Promise<void> {
  currentFakePb().seed("materiel", [makeMaterielRecord()]);
  currentFakePb().seed("materiel_loan", []);
  await materielStore.initialize();
  await eventMaterielStore.initializeForEvent(TEST_EVENT_ID);
  await waitForTick(5);
}

const LOAN_PERIOD = {
  startDate: "2026-12-19",
  endDate: "2026-12-21",
};

describe("MaterielStore — loan ↔ event_materiel (write paths)", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    vi.restoreAllMocks();
    await materielStore.destroy();
    await eventMaterielStore.destroy();
    await clearDexie();
  });

  it("createLoan avec event : prêt + lignes event_materiel créés serveur, visibles sans refresh", async () => {
    await seedAndInitialize();

    const materiels: MaterielLoanItem[] = [
      { materielId: TEST_MATERIEL_ID, materielName: "Gastro 1/1", quantity: 2 },
    ];
    const loan = await materielStore.createLoan({
      ...LOAN_PERIOD,
      responsibleId: USER_ID,
      responsibleName: "test-user",
      ownerId: TEST_TEAM_ID,
      ownerName: "Team One",
      materiels,
      status: "accepted",
      eventId: TEST_EVENT_ID,
      eventName: "T12 Harness Event",
    });

    // Le prêt existe côté serveur (id PB natif) et porte l'event
    expect(loan.id).toMatch(/^[a-z0-9]{15}$/);
    const serverLoans = await pb.collection("materiel_loan").getFullList();
    expect(serverLoans).toHaveLength(1);
    expect(serverLoans[0].eventId).toBe(TEST_EVENT_ID);
    expect(serverLoans[0].borrowerUser).toBe(USER_ID);

    // La projection event_materiel est créée (header + allocation) SANS refresh
    const serverItems = await pb.collection("event_materiel").getFullList();
    expect(serverItems).toHaveLength(2);
    const header = serverItems.find((i) => !i.groupId);
    const allocation = serverItems.find((i) => i.groupId);
    expect(header?.status).toBe("to_find");
    expect(allocation?.status).toBe("confirmed");
    expect(allocation?.groupId).toBe(header?.id);
    expect(allocation?.loanId).toBe(loan.id);
    expect(allocation?.sourceMaterielId).toBe(TEST_MATERIEL_ID);

    await waitForTick(5);
    const items = eventMaterielStore.items;
    expect(items).toHaveLength(2);
    const alloc = items.find((i) => i.groupId);
    expect(alloc?.loanId).toBe(loan.id);

    expect(materielStore.error).toBeNull();
  });

  it("createLoan : rejet event_materiel → prêt compensé (pas de fantôme), échec sans pollution globale", async () => {
    await seedAndInitialize();
    rejectEventMaterielWrites(currentFakePb());

    await expect(
      materielStore.createLoan({
        ...LOAN_PERIOD,
        responsibleId: USER_ID,
        responsibleName: "test-user",
        ownerId: TEST_TEAM_ID,
        ownerName: "Team One",
        materiels: [
          {
            materielId: TEST_MATERIEL_ID,
            materielName: "Gastro 1/1",
            quantity: 1,
          },
        ],
        status: "accepted",
        eventId: TEST_EVENT_ID,
        eventName: "T12 Harness Event",
      }),
    ).rejects.toThrow("Failed to create record.");

    await waitForTick(5);

    // Aucun prêt fantôme : ni serveur ni Dexie (la réservation « apparue après
    // refresh » et ses faux conflits de disponibilité sont éliminés)
    const serverLoans = await pb.collection("materiel_loan").getFullList();
    expect(serverLoans).toHaveLength(0);
    expect(await db.materielLoans.toArray()).toHaveLength(0);
    const serverItems = await pb.collection("event_materiel").getFullList();
    expect(serverItems).toHaveLength(0);

    // L'échec reste à l'appelant (modal) — pas d'alerte globale sur les pages
    expect(materielStore.error).toBeNull();
  });

  it("updateLoan : rejet event_materiel → prêt mis à jour (source de vérité), erreur typée, pas de pollution globale", async () => {
    await seedAndInitialize();

    // Prêt créé SANS event (aucune projection au create)
    const loan = await materielStore.createLoan({
      ...LOAN_PERIOD,
      responsibleId: USER_ID,
      responsibleName: "test-user",
      ownerId: TEST_TEAM_ID,
      ownerName: "Team One",
      materiels: [
        {
          materielId: TEST_MATERIEL_ID,
          materielName: "Gastro 1/1",
          quantity: 1,
        },
      ],
      status: "accepted",
      eventId: null,
      eventName: null,
    });
    await waitForTick(5);

    rejectEventMaterielWrites(currentFakePb());

    let thrown: unknown = null;
    try {
      await materielStore.updateLoan(loan.id, {
        eventId: TEST_EVENT_ID,
        eventName: "T12 Harness Event",
        materiels: [
          {
            materielId: TEST_MATERIEL_ID,
            materielName: "Gastro 1/1",
            quantity: 1,
          },
        ],
      });
    } catch (err) {
      thrown = err;
    }

    // Erreur typée : le modal distingue l'échec partiel (prêt modifié, sync KO)
    expect((thrown as Error)?.name).toBe("EventMaterielSyncError");

    await waitForTick(5);

    // Le prêt EST mis à jour côté serveur (la disponibilité reflète la réalité)
    const server = await pb.collection("materiel_loan").getOne(loan.id);
    expect(server.eventId).toBe(TEST_EVENT_ID);

    // Rien de fuyant vers les pages loan/materiel
    expect(materielStore.error).toBeNull();
  });

  it("conflits : les prêts portant le marqueur local de suppression ne comptent plus", async () => {
    await seedAndInitialize();

    const period = { start: "2026-12-18", end: "2026-12-22" };

    // Contrôle positif : un prêt actif de 3 sur un stock de 5 → dispo 2
    currentFakePb().putRecord("materiel_loan", makeLoanRecord());
    await materielStore.syncRevalidate();
    await waitForTick(5);
    let avail = materielStore
      .getAvailableMaterielsForPeriod(TEST_TEAM_ID, period.start, period.end)
      .find((m) => m.id === TEST_MATERIEL_ID);
    expect(avail?.availableForPeriod).toBe(2);

    // Marqueur local de suppression (pb-sync, 404 d'update) → prêts fantômes
    const loan = await db.materielLoans.get("t12loan00000001");
    await db.materielLoans.put({ ...loan!, deleted: true });
    await waitForTick(5);
    avail = materielStore
      .getAvailableMaterielsForPeriod(TEST_TEAM_ID, period.start, period.end)
      .find((m) => m.id === TEST_MATERIEL_ID);
    expect(avail?.availableForPeriod).toBe(5);
  });

  it("fraîcheur : syncRevalidate ramène les prêts serveur dans le socle des conflits", async () => {
    await seedAndInitialize();

    let avail = materielStore
      .getAvailableMaterielsForPeriod(TEST_TEAM_ID, "2026-12-18", "2026-12-22")
      .find((m) => m.id === TEST_MATERIEL_ID);
    expect(avail?.availableForPeriod).toBe(5);

    // Un autre user réserve 3 pièces côté serveur (autre device) — updated
    // frais pour franchir le curseur delta
    currentFakePb().putRecord(
      "materiel_loan",
      makeLoanRecord({ updated: pbDate(new Date(Date.now() + 60_000)) }),
    );

    // Stale tant que pas de resync — c'est le modal qui le déclenche à l'ouverture
    avail = materielStore
      .getAvailableMaterielsForPeriod(TEST_TEAM_ID, "2026-12-18", "2026-12-22")
      .find((m) => m.id === TEST_MATERIEL_ID);
    expect(avail?.availableForPeriod).toBe(5);

    await materielStore.syncRevalidate();
    await waitForTick(5);
    avail = materielStore
      .getAvailableMaterielsForPeriod(TEST_TEAM_ID, "2026-12-18", "2026-12-22")
      .find((m) => m.id === TEST_MATERIEL_ID);
    expect(avail?.availableForPeriod).toBe(2);
  });
});
