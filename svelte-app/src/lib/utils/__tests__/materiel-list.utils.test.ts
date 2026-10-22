import { describe, it, expect } from "vitest";
import {
  groupMaterielsByType,
  filterLoanMateriels,
  summarizeSelection,
  clampQuantity,
  countAvailable,
} from "../materiel-list.utils";
import type {
  MaterielWithAvailability,
  LoanSegment,
} from "../materiel-list.utils";

// Les utils ne lisent que id/name/type/availableForPeriod : le cast évite de
// construire un EnrichedMateriel complet dans chaque fixture.
function makeItem(
  overrides: Partial<MaterielWithAvailability> = {},
): MaterielWithAvailability {
  return {
    id: "m1",
    name: "Réchaud",
    type: "cooking",
    availableForPeriod: 3,
    ...overrides,
  } as MaterielWithAvailability;
}

describe("groupMaterielsByType", () => {
  it("regroupe par type dans l'ordre canonique des sections", () => {
    const groups = groupMaterielsByType([
      makeItem({ id: "1", type: "dish" }),
      makeItem({ id: "2", type: "cooking" }),
      makeItem({ id: "3", type: "gaz" }),
    ]);
    expect(groups.map((g) => g.type)).toEqual(["cooking", "dish", "gaz"]);
  });

  it("classe les types inconnus ou vides dans 'other' (en dernier)", () => {
    const groups = groupMaterielsByType([
      makeItem({ id: "1", type: "" as any }),
      makeItem({ id: "2", type: "cooking" }),
      makeItem({ id: "3", type: "inconnu" as any }),
    ]);
    expect(groups.map((g) => g.type)).toEqual(["cooking", "other"]);
    expect(groups[1].items).toHaveLength(2);
  });

  it("renvoie un tableau vide pour une liste vide", () => {
    expect(groupMaterielsByType([])).toEqual([]);
  });
});

describe("filterLoanMateriels", () => {
  const items = [
    makeItem({ id: "a", name: "Réchaud", availableForPeriod: 2 }),
    makeItem({ id: "b", name: "Louche", availableForPeriod: 0 }),
    makeItem({ id: "c", name: "Plaque", availableForPeriod: 5 }),
  ];

  function filterWith(
    segments: LoanSegment[],
    quantities: Record<string, number> = {},
    search = "",
  ) {
    return filterLoanMateriels(items, { segments, quantities, search });
  }

  it("aucun segment actif : tout passe", () => {
    expect(filterWith([])).toHaveLength(3);
  });

  it("un segment actif : filtre exclusif classique", () => {
    expect(filterWith(["selected"], { a: 1 }).map((i) => i.id)).toEqual(["a"]);
    expect(filterWith(["unselected"], { a: 2 }).map((i) => i.id)).toEqual([
      "b",
      "c",
    ]);
    expect(filterWith(["available"]).map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("plusieurs segments : union sans doublon", () => {
    // a est à la fois sélectionné et disponible : une seule occurrence
    expect(
      filterWith(["selected", "available"], { a: 1 }).map((i) => i.id),
    ).toEqual(["a", "c"]);
    // l'union sélectionnés ∪ non sélectionnés couvre tout
    expect(
      filterWith(["selected", "unselected"], { a: 1 }).map((i) => i.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("recherche : filtre insensible à la casse sur le nom", () => {
    expect(filterWith([], {}, "louc").map((i) => i.id)).toEqual(["b"]);
  });

  it("recherche et union se composent (critères indépendants)", () => {
    expect(
      filterWith(["selected", "available"], { a: 1, c: 1 }, "pla").map(
        (i) => i.id,
      ),
    ).toEqual(["c"]);
    expect(filterWith(["selected"], {}, "pla")).toHaveLength(0);
  });
});

describe("summarizeSelection", () => {
  it("compte les items >= 1 et la somme des unités", () => {
    expect(summarizeSelection({ a: 2, b: 0, c: 5 })).toEqual({
      itemCount: 2,
      totalUnits: 7,
    });
  });

  it("sélection vide", () => {
    expect(summarizeSelection({})).toEqual({ itemCount: 0, totalUnits: 0 });
  });
});

describe("clampQuantity", () => {
  it("plafonne au maximum disponible", () => {
    expect(clampQuantity(8, 5)).toBe(5);
  });

  it("plancher à 0, valeurs négatives et NaN rejetées", () => {
    expect(clampQuantity(-3, 5)).toBe(0);
    expect(clampQuantity(NaN, 5)).toBe(0);
  });
});

describe("countAvailable", () => {
  it("compte les items avec dispo > 0", () => {
    expect(
      countAvailable([
        makeItem({ availableForPeriod: 2 }),
        makeItem({ availableForPeriod: 0 }),
        makeItem({ availableForPeriod: undefined }),
      ]),
    ).toBe(1);
  });
});
