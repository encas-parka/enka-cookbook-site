/**
 * @vitest-environment jsdom
 */

/**
 * MaterielCard — le badge d'état dérivé (jamais persisté, ADR 0003).
 *
 * Seam : vrai composant monté en jsdom, fixture EnrichedMateriel minimale
 * (le cast suit le patron de materiel-list.utils.test.ts — la carte ne
 * lit qu'un sous-ensemble des champs enrichis).
 *
 * Le badge « Emprunté » coexiste aujourd'hui avec le compteur « N/quantity
 * en prêt(s) » : c'est le comportement actuel qui est épinglé — une décision
 * produit contraire (checklist click-through §12-8) mettra ce test à jour.
 */

vi.mock("$lib/stores/GlobalState.svelte", () => ({
  globalState: {
    userName: "test-user",
    userId: "testuser12345678",
    isAuthenticated: true,
  },
}));

import { describe, it, expect, afterEach, vi } from "vitest";
import type { EnrichedMateriel } from "$lib/types/materiel.types";
import type { MaterielDisplayState } from "$lib/types/materiel.types";
import MaterielCard from "../MaterielCard.svelte";
import {
  mountSvelte,
  cleanupSvelte,
  getByText,
  queryByText,
} from "$lib/test/mount-svelte";

function makeEnriched(
  overrides: Partial<EnrichedMateriel> = {},
): EnrichedMateriel {
  return {
    id: "t12mater0000001",
    name: "Gastro 1/1",
    type: "other",
    description: null,
    location: null,
    shareableWith: null,
    teamId: "t12team00000001",
    ownerUser: null,
    quantity: 12,
    repairQuantity: 0,
    availableQuantity: 12,
    totalLoanedQuantity: 0,
    loanDetails: [],
    displayState: "complete",
    ...overrides,
  } as EnrichedMateriel;
}

function mountCard(displayState: MaterielDisplayState, overrides = {}) {
  return mountSvelte(MaterielCard, {
    materiel: makeEnriched({ displayState, ...overrides }),
  });
}

describe("MaterielCard — badge d'état dérivé", () => {
  afterEach(() => cleanupSvelte());

  it("partiel : badge portant le nombre d'exemplaires à réparer", () => {
    const target = mountCard("partial", {
      repairQuantity: 2,
      quantity: 12,
      availableQuantity: 10,
    });
    expect(getByText(target, ".badge", "Partiel : 2 à réparer")).toBeTruthy();
  });

  it("complet : état neutre, pas de badge", () => {
    const target = mountCard("complete");
    expect(queryByText(target, ".badge", "Complet")).toBeNull();
  });

  it("stock épuisé : badge dédié", () => {
    const target = mountCard("depleted", { quantity: 0, availableQuantity: 0 });
    expect(getByText(target, ".badge", "Stock épuisé")).toBeTruthy();
  });

  it("tout le stock en réparation : badge « En réparation »", () => {
    const target = mountCard("repair", {
      repairQuantity: 12,
      availableQuantity: 0,
    });
    expect(getByText(target, ".badge", "En réparation")).toBeTruthy();
  });

  it("emprunté : badge d'activité et compteur de prêts (comportement actuel)", () => {
    const target = mountCard("loan", { totalLoanedQuantity: 3 });
    expect(getByText(target, ".badge", "Emprunté")).toBeTruthy();
    expect(getByText(target, ".badge", "3/12 en prêt(s)")).toBeTruthy();
  });
});
