/**
 * @vitest-environment jsdom
 */

/**
 * MaterielStore — retour qui met le stock à la vérité, sélecteurs sans
 * filtre de statut, gestes de réparation (granularité des dommages).
 *
 * Seam : vrai store + vrai pb-sync + transport PB factice (sans réseau),
 * fake-indexeddb pour le vrai Dexie. Même machinerie que
 * materiel-store-loan-sync.test.ts.
 *
 * Couvre :
 *  - completeLoanWithReturn : les manquants décrémentent définitivement la
 *    quantité, les exemplaires à réparer incrémentent repairQuantity, aucun
 *    statut n'est écrit, un item sans dommage déclaré ne reçoit aucune
 *    écriture (un état saisi à la main survit), la clôture du prêt est
 *    inchangée (completed + returnedAt + notes + lignes en bloc)
 *  - sélecteurs : la disponibilité calculée décide seule — un item tout en
 *    réparation n'est pas proposé, un partiel l'est pour ses unités saines,
 *    la dispo sur période soustrait chevauchants + réparation
 *  - gestes : remise en service (repairQuantity −= n) et réforme
 *    (repairQuantity −= n ET quantity −= n), garde 1 ≤ n ≤ repairQuantity
 *    sans écriture en cas de violation
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
import { currentFakePb, type FakePocketBase } from "./harness/stub-pb";
import { clearDexie } from "./harness/seed-dexie";
import { waitForTick } from "./harness/wait-for-tick";
import {
  makeLoanRecord,
  makeMaterielRecord,
  TEST_LOAN_ID,
  TEST_MATERIEL_ID,
  TEST_TEAM_ID,
} from "./harness/fixtures";
import { materielStore } from "$lib/stores/MaterielStore.svelte";
import { pb } from "$lib/db-sync/pb-sync";
import type { MaterielLoanItem } from "$lib/types/materiel.types";
import type { Materiel, MaterielLoan } from "$lib/types/pb";

/** Second item du même prêt — l'item revenu intact. */
const INTACT_MATERIEL_ID = "t12mater0000002";

/** Ligne d'emprunt pour un materiel des fixtures. */
function loanItem(
  materielId: string,
  overrides: Partial<MaterielLoanItem> = {},
): MaterielLoanItem {
  return {
    materielId,
    materielName: "Gastro 1/1",
    quantity: 1,
    ...overrides,
  };
}

/**
 * Capture toute écriture materiel au transport (payloads tels qu'émis) —
 * le stub n'a pas de journal d'appels ; le spy intercepte `pb.collection()`
 * au moment de l'écriture, comme rejectEventMaterielWrites.
 */
function trackMaterielUpdates(fakePb: FakePocketBase): {
  updates: Array<{ id: string; data: Record<string, unknown> }>;
} {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const original = fakePb.collection.bind(fakePb);
  vi.spyOn(fakePb, "collection").mockImplementation(((name: string) => {
    const col = original(name);
    if (name !== "materiel") return col;
    return {
      ...col,
      update: async (id: string, data: Record<string, unknown>) => {
        updates.push({ id, data });
        return col.update(id, data);
      },
    };
  }) as typeof fakePb.collection);
  return { updates };
}

async function seedAndInitialize(
  materiels: Materiel[] = [makeMaterielRecord()],
  loans: MaterielLoan[] = [],
): Promise<void> {
  currentFakePb().seed("materiel", materiels);
  currentFakePb().seed("materiel_loan", loans);
  await materielStore.initialize();
  await waitForTick(5);
}

describe("MaterielStore — retour qui met le stock à la vérité", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    vi.restoreAllMocks();
    await materielStore.destroy();
    await clearDexie();
  });

  it("« 2 cassés sur 12, 6 empruntés » : repairQuantity 2, quantity intacte, proposé pour 10", async () => {
    const item = loanItem(TEST_MATERIEL_ID, { quantity: 6, brokenQuantity: 2 });
    await seedAndInitialize(
      [makeMaterielRecord({ quantity: 12 })],
      [makeLoanRecord({ materiels: [item] })],
    );

    await materielStore.completeLoanWithReturn(TEST_LOAN_ID, {
      materiels: [item],
    });
    await waitForTick(5);

    // Les cassés n'enlèvent rien au stock : ils basculent en réparation
    const server = await pb.collection("materiel").getOne(TEST_MATERIEL_ID);
    expect(server.repairQuantity).toBe(2);
    expect(server.quantity).toBe(12);
  });

  it("« 2 manquants sur 12 » : quantity 10, repairQuantity inchangé", async () => {
    const item = loanItem(TEST_MATERIEL_ID, { quantity: 6, lostQuantity: 2 });
    await seedAndInitialize(
      // repairQuantity posé à la main (réparation en cours) : doit rester 1
      [makeMaterielRecord({ quantity: 12, repairQuantity: 1 })],
      [makeLoanRecord({ materiels: [item] })],
    );

    await materielStore.completeLoanWithReturn(TEST_LOAN_ID, {
      materiels: [item],
    });
    await waitForTick(5);

    const server = await pb.collection("materiel").getOne(TEST_MATERIEL_ID);
    expect(server.quantity).toBe(10);
    expect(server.repairQuantity).toBe(1);
  });

  it("« 3 manquants sur un emprunt de 3, stock 50 » : quantity 47, aucune écriture de statut", async () => {
    const item = loanItem(TEST_MATERIEL_ID, { quantity: 3, lostQuantity: 3 });
    await seedAndInitialize(
      [makeMaterielRecord({ quantity: 50 })],
      [makeLoanRecord({ materiels: [item] })],
    );
    const { updates } = trackMaterielUpdates(currentFakePb());

    await materielStore.completeLoanWithReturn(TEST_LOAN_ID, {
      materiels: [item],
    });

    const server = await pb.collection("materiel").getOne(TEST_MATERIEL_ID);
    expect(server.quantity).toBe(47);

    // La perte ne propage plus à tout l'item : aucun statut dans le payload
    expect(updates).toHaveLength(1);
    expect(updates[0].data).not.toHaveProperty("status");
  });

  it("item sans dommage déclaré : aucune écriture émise pour lui, son état manuel survit", async () => {
    const damagedItem = loanItem(TEST_MATERIEL_ID, {
      quantity: 2,
      lostQuantity: 1,
    });
    const intactItem = loanItem(INTACT_MATERIEL_ID, { quantity: 2 });
    await seedAndInitialize(
      [
        makeMaterielRecord({ quantity: 5 }),
        makeMaterielRecord({
          id: INTACT_MATERIEL_ID,
          quantity: 4,
          repairQuantity: 2, // réparation saisie à la main avant le retour
        }),
      ],
      [makeLoanRecord({ materiels: [damagedItem, intactItem] })],
    );
    const { updates } = trackMaterielUpdates(currentFakePb());

    // Le prêt est réécrit en bloc : TOUS les items (intacts inclus) partent
    // dans le payload — seul l'item endommagé génère une écriture materiel
    await materielStore.completeLoanWithReturn(TEST_LOAN_ID, {
      materiels: [damagedItem, intactItem],
    });
    await waitForTick(5);

    expect(updates.map((u) => u.id)).toEqual([TEST_MATERIEL_ID]);

    const serverIntact = await pb
      .collection("materiel")
      .getOne(INTACT_MATERIEL_ID);
    expect(serverIntact.repairQuantity).toBe(2);
    expect(serverIntact.quantity).toBe(4);
  });

  it("clôture du prêt inchangée : completed, returnedAt, notes, lignes réécrites en bloc", async () => {
    const damagedItem = loanItem(TEST_MATERIEL_ID, {
      quantity: 2,
      brokenQuantity: 1,
    });
    const intactItem = loanItem(INTACT_MATERIEL_ID, { quantity: 1 });
    await seedAndInitialize(
      [
        makeMaterielRecord({ quantity: 5 }),
        makeMaterielRecord({ id: INTACT_MATERIEL_ID, quantity: 4 }),
      ],
      [makeLoanRecord({ materiels: [damagedItem, intactItem] })],
    );

    await materielStore.completeLoanWithReturn(TEST_LOAN_ID, {
      materiels: [damagedItem, intactItem],
      returnNotes: "1 verre cassé",
    });

    const serverLoan = await pb
      .collection("materiel_loan")
      .getOne(TEST_LOAN_ID);
    expect(serverLoan.status).toBe("completed");
    expect(typeof serverLoan.returnedAt).toBe("string");
    expect(serverLoan.returnNotes).toBe("1 verre cassé");
    expect(serverLoan.materiels).toEqual([damagedItem, intactItem]);
    // completedAt n'est pas écrit par le retour (reste null du create)
    expect(serverLoan.completedAt).toBeNull();
  });
});

describe("MaterielStore — sélecteurs et gestes (disponibilité calculée)", () => {
  beforeEach(async () => {
    currentFakePb().reset();
    vi.restoreAllMocks();
    await materielStore.destroy();
    await clearDexie();
  });

  it("scénario complet « 2 cassés sur 12, 6 empruntés » : après retour, l'item est proposé pour 10", async () => {
    const item = loanItem(TEST_MATERIEL_ID, { quantity: 6, brokenQuantity: 2 });
    await seedAndInitialize(
      [makeMaterielRecord({ quantity: 12 })],
      [makeLoanRecord({ materiels: [item] })],
    );

    await materielStore.completeLoanWithReturn(TEST_LOAN_ID, {
      materiels: [item],
    });
    await waitForTick(5);

    // Prêt complété ⇒ plus d'emprunté : 12 − 0 − 2 en réparation = 10
    const byOwner = materielStore
      .getAvailableMaterielsByOwner(TEST_TEAM_ID)
      .find((m) => m.id === TEST_MATERIEL_ID);
    expect(byOwner?.availableQuantity).toBe(10);

    const forPeriod = materielStore
      .getAvailableMaterielsForPeriod(TEST_TEAM_ID, "2026-12-19", "2026-12-21")
      .find((m) => m.id === TEST_MATERIEL_ID);
    expect(forPeriod?.availableForPeriod).toBe(10);
  });

  it("sélecteurs : la réparation soustrait partout, l'item partiel reste proposé pour ses unités saines", async () => {
    // Item tout en réparation (backfill ticket 01) : jamais proposé
    const fullRepair = makeMaterielRecord({
      id: INTACT_MATERIEL_ID,
      quantity: 5,
      repairQuantity: 5,
    });
    // Item partiel : 2 exemplaires en réparation, prêt futur de 6 sur la période
    const partial = makeMaterielRecord({ quantity: 12, repairQuantity: 2 });
    const futureLoan = makeLoanRecord({
      materiels: [loanItem(TEST_MATERIEL_ID, { quantity: 6 })],
    });
    await seedAndInitialize([partial, fullRepair], [futureLoan]);

    // Hors période : 12 − 0 emprunté actif (prêt futur) − 2 réparation = 10
    const byOwner = materielStore.getAvailableMaterielsByOwner(TEST_TEAM_ID);
    expect(byOwner.map((m) => m.id)).toEqual([TEST_MATERIEL_ID]);
    expect(byOwner[0].availableQuantity).toBe(10);

    // Sur la période : 12 − 6 chevauchant − 2 réparation = 4 — calculé
    // directement, PAS via availableQuantity (emprunts actifs ≠ chevauchants)
    const forPeriod = materielStore.getAvailableMaterielsForPeriod(
      TEST_TEAM_ID,
      "2026-12-19",
      "2026-12-21",
    );
    expect(forPeriod.map((m) => m.id)).toEqual([TEST_MATERIEL_ID]);
    expect(forPeriod[0].availableForPeriod).toBe(4);
  });

  it("geste remise en service : repairQuantity décrémenté, garde hors bornes sans écriture", async () => {
    await seedAndInitialize([
      makeMaterielRecord({ quantity: 12, repairQuantity: 2 }),
    ]);
    const { updates } = trackMaterielUpdates(currentFakePb());

    await materielStore.returnToService(TEST_MATERIEL_ID, 2);
    await waitForTick(5);

    const server = await pb.collection("materiel").getOne(TEST_MATERIEL_ID);
    expect(server.repairQuantity).toBe(0);
    expect(server.quantity).toBe(12);

    // Garde 1 ≤ n ≤ repairQuantity : au-delà du compteur restant (0) ou nul,
    // throw sans aucune écriture
    await expect(
      materielStore.returnToService(TEST_MATERIEL_ID, 1),
    ).rejects.toThrow();
    await expect(
      materielStore.returnToService(TEST_MATERIEL_ID, 0),
    ).rejects.toThrow();
    expect(updates).toHaveLength(1);
  });

  it("geste réforme : repairQuantity ET quantity décrémentés (les exemplaires deviennent manquants)", async () => {
    await seedAndInitialize([
      makeMaterielRecord({ quantity: 12, repairQuantity: 2 }),
    ]);

    await materielStore.scrapUnits(TEST_MATERIEL_ID, 2);
    await waitForTick(5);

    const server = await pb.collection("materiel").getOne(TEST_MATERIEL_ID);
    expect(server.repairQuantity).toBe(0);
    expect(server.quantity).toBe(10);
  });

  it("remise en service rouvre la disponibilité d'un item tout en réparation", async () => {
    await seedAndInitialize([
      makeMaterielRecord({ quantity: 5, repairQuantity: 5 }),
    ]);

    // Tout le stock en réparation : non proposé
    expect(
      materielStore.getAvailableMaterielsByOwner(TEST_TEAM_ID),
    ).toHaveLength(0);

    await materielStore.returnToService(TEST_MATERIEL_ID, 5);
    await waitForTick(5);

    const avail = materielStore.getAvailableMaterielsByOwner(TEST_TEAM_ID);
    expect(avail.map((m) => m.id)).toEqual([TEST_MATERIEL_ID]);
    expect(avail[0].availableQuantity).toBe(5);
  });
});
