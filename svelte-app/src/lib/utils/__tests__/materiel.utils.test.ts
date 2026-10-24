import { describe, it, expect } from "vitest";
import {
  enrichMateriel,
  getMaterielDisplayStateLabel,
} from "../materiel.utils";
import type { Materiel, MaterielLoan } from "$lib/types/pb";
import type { MaterielLoanItem } from "$lib/types/materiel.types";

const NOW = new Date("2026-10-24T12:00:00.000Z");

function makeMateriel(overrides: Partial<Materiel> = {}): Materiel {
  return {
    id: "m1",
    created: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-01T00:00:00.000Z",
    name: "Verres",
    type: "dish",
    description: null,
    ownerUser: null,
    teamId: "team1",
    deleted: false,
    createdBy: null,
    quantity: 12,
    repairQuantity: 0,
    location: null,
    shareableWith: null,
    isStorage: false,
    storeIn: null,
    ...overrides,
  };
}

function makeLoan(overrides: Partial<MaterielLoan> = {}): MaterielLoan {
  return {
    id: "l1",
    created: "2026-10-01T00:00:00.000Z",
    updated: "2026-10-01T00:00:00.000Z",
    borrowerUser: null,
    eventId: null,
    // Chevauche NOW : emprunt actif
    startDate: "2026-10-20T00:00:00.000Z",
    endDate: "2026-10-30T00:00:00.000Z",
    status: "accepted",
    createdBy: null,
    responsibleId: null,
    responsibleName: "Alice",
    ownerId: null,
    ownerName: null,
    materiels: [
      {
        materielId: "m1",
        materielName: "Verres",
        quantity: 3,
      } as MaterielLoanItem,
    ],
    notes: null,
    completedAt: null,
    returnedAt: null,
    returnNotes: null,
    eventName: null,
    ...overrides,
  };
}

describe("enrichMateriel — disponibilité (quantity − emprunté − réparation)", () => {
  it("nominal : stock entier disponible, état complet", () => {
    const enriched = enrichMateriel(makeMateriel(), [], NOW);
    expect(enriched.availableQuantity).toBe(12);
    expect(enriched.totalLoanedQuantity).toBe(0);
    expect(enriched.isAvailable).toBe(true);
    expect(enriched.isFullyLoaned).toBe(false);
    expect(enriched.displayState).toBe("complete");
  });

  it("partiel : N exemplaires en réparation, les sains restent disponibles", () => {
    // 2 verres cassés sur 12 (story 3) : le lot reste empruntable pour 10
    const enriched = enrichMateriel(
      makeMateriel({ repairQuantity: 2 }),
      [],
      NOW,
    );
    expect(enriched.availableQuantity).toBe(10);
    expect(enriched.isAvailable).toBe(true);
    expect(enriched.isFullyLoaned).toBe(false);
    expect(enriched.displayState).toBe("partial");
  });

  it("tout le stock en réparation : plus rien de disponible", () => {
    const enriched = enrichMateriel(
      makeMateriel({ repairQuantity: 12 }),
      [],
      NOW,
    );
    expect(enriched.availableQuantity).toBe(0);
    expect(enriched.isAvailable).toBe(false);
    expect(enriched.isFullyLoaned).toBe(true);
    expect(enriched.displayState).toBe("repair");
  });

  it("stock épuisé (quantity 0) : disponible à zéro, état épuisé", () => {
    const enriched = enrichMateriel(makeMateriel({ quantity: 0 }), [], NOW);
    expect(enriched.availableQuantity).toBe(0);
    expect(enriched.isAvailable).toBe(false);
    expect(enriched.displayState).toBe("depleted");
  });

  it("quantity null : indisponible (conservateur), état épuisé", () => {
    const enriched = enrichMateriel(makeMateriel({ quantity: null }), [], NOW);
    expect(enriched.availableQuantity).toBe(0);
    expect(enriched.isAvailable).toBe(false);
    expect(enriched.displayState).toBe("depleted");
  });

  it("emprunt actif : soustrait de la disponibilité, état emprunté", () => {
    const enriched = enrichMateriel(makeMateriel(), [makeLoan()], NOW);
    expect(enriched.totalLoanedQuantity).toBe(3);
    expect(enriched.availableQuantity).toBe(9);
    expect(enriched.displayState).toBe("loan");
  });

  it("emprunt planifié : dispo instantanée intacte, état réservé", () => {
    const loan = makeLoan({
      startDate: "2026-11-01T00:00:00.000Z",
      endDate: "2026-11-10T00:00:00.000Z",
    });
    const enriched = enrichMateriel(makeMateriel(), [loan], NOW);
    expect(enriched.totalLoanedQuantity).toBe(0);
    expect(enriched.availableQuantity).toBe(12);
    expect(enriched.displayState).toBe("reserved");
  });

  it("emprunt actif et réparation se cumulent dans la soustraction", () => {
    const enriched = enrichMateriel(
      makeMateriel({ repairQuantity: 2 }),
      [makeLoan()],
      NOW,
    );
    expect(enriched.availableQuantity).toBe(7);
    expect(enriched.displayState).toBe("loan");
  });

  it("emprunt clôturé (returned) : ne soustrait plus rien", () => {
    const loan = makeLoan({ status: "returned" });
    const enriched = enrichMateriel(makeMateriel(), [loan], NOW);
    expect(enriched.availableQuantity).toBe(12);
    expect(enriched.displayState).toBe("complete");
  });
});

describe("getMaterielDisplayStateLabel", () => {
  it("libellés FR des états dérivés", () => {
    expect(getMaterielDisplayStateLabel("complete")).toBe("Complet");
    expect(getMaterielDisplayStateLabel("repair")).toBe("En réparation");
    expect(getMaterielDisplayStateLabel("depleted")).toBe("Stock épuisé");
    expect(getMaterielDisplayStateLabel("loan")).toBe("Emprunté");
    expect(getMaterielDisplayStateLabel("reserved")).toBe("Réservé");
  });

  it("l'état partiel porte le nombre d'exemplaires à réparer", () => {
    expect(getMaterielDisplayStateLabel("partial", 2)).toBe(
      "Partiel : 2 à réparer",
    );
  });

  it("état inconnu ou absent : libellé de repli", () => {
    expect(getMaterielDisplayStateLabel(null)).toBe("Inconnu");
    expect(getMaterielDisplayStateLabel("mystere")).toBe("Inconnu");
  });
});
