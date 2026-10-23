import { describe, it, expect } from "vitest";
import {
  groupByTypeOrder,
  groupMaterielsByType,
  filterLoanMateriels,
  summarizeSelection,
  clampQuantity,
  countAvailable,
} from "../materiel-list.utils";
import type {
  MaterielWithAvailability,
  LoanListFilters,
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

describe("groupByTypeOrder", () => {
  it("regroupe par type dans l'ordre canonique", () => {
    const groups = groupByTypeOrder(
      [
        { t: "dish", n: "a" },
        { t: "cooking", n: "b" },
        { t: "dish", n: "c" },
      ],
      (i) => i.t,
    );
    expect(groups.map((g) => g.type)).toEqual(["cooking", "dish"]);
    expect(groups[1].items.map((i) => i.n)).toEqual(["a", "c"]);
  });

  it("type inconnu ou absent : bascule dans 'other'", () => {
    const groups = groupByTypeOrder(
      [{ t: "mystere", n: "a" }, { n: "b" }],
      (i) => i.t,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("other");
    expect(groups[0].items).toHaveLength(2);
  });

  it("liste vide : aucun groupe", () => {
    expect(groupByTypeOrder([], () => null)).toEqual([]);
  });
});

describe("filterLoanMateriels", () => {
  const items = [
    makeItem({ id: "a", name: "Réchaud", availableForPeriod: 2 }),
    makeItem({ id: "b", name: "Louche", availableForPeriod: 0 }),
    makeItem({ id: "c", name: "Plaque", availableForPeriod: 5 }),
  ];

  function filterWith(
    filter: Partial<LoanListFilters> = {},
    quantities: Record<string, number> = {},
    search = "",
  ) {
    return filterLoanMateriels(items, {
      segment: "",
      availableOnly: false,
      ...filter,
      quantities,
      search,
    });
  }

  it("sans filtre : tout passe", () => {
    expect(filterWith()).toHaveLength(3);
  });

  it("segment exclusif 'selected' : quantité >= 1", () => {
    expect(
      filterWith({ segment: "selected" }, { a: 1 }).map((i) => i.id),
    ).toEqual(["a"]);
  });

  it("segment exclusif 'unselected' : quantité 0 ou absente", () => {
    expect(
      filterWith({ segment: "unselected" }, { a: 2 }).map((i) => i.id),
    ).toEqual(["b", "c"]);
  });

  it("availableOnly restreint aux disponibles sur la période", () => {
    expect(filterWith({ availableOnly: true }).map((i) => i.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("segment et availableOnly se composent en ET (l'indisponible non sélectionné reste masqué)", () => {
    expect(
      filterWith({ segment: "unselected", availableOnly: true }).map(
        (i) => i.id,
      ),
    ).toEqual(["a", "c"]);
    expect(
      filterWith({ segment: "selected", availableOnly: true }, { b: 1 }).map(
        (i) => i.id,
      ),
    ).toEqual([]);
  });

  it("recherche : filtre insensible à la casse sur le nom", () => {
    expect(filterWith({}, {}, "louc").map((i) => i.id)).toEqual(["b"]);
  });

  it("recherche et filtres se composent (critères indépendants)", () => {
    expect(
      filterWith({ segment: "selected" }, { c: 1 }, "pla").map((i) => i.id),
    ).toEqual(["c"]);
    expect(filterWith({ segment: "selected" }, {}, "pla")).toHaveLength(0);
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
