import { describe, it, expect } from "vitest";
import {
  computeFuzzySearchMatches,
  matchesFilters,
  type FiltersState,
} from "../productsUtils";
import { makeEnrichedProduct } from "./fixtures/enriched-products";

function makeFilters(overrides: Partial<FiltersState> = {}): FiltersState {
  return {
    searchQuery: "",
    searchInRecipes: false,
    selectedStores: [],
    selectedWho: [],
    selectedProductTypes: [],
    selectedTemperatures: [],
    temperatureFilter: "all",
    storeFilterMode: "all",
    whoFilterMode: "all",
    deliveryDateFilter: null,
    completionStatus: "all",
    groupBy: "productType",
    sortColumn: "",
    sortDirection: "asc",
    ...overrides,
  };
}

const searchable = [
  {
    id: "p1",
    productName: "Crème liquide",
    recipeNames: "Tarte aux pommes Quiche",
  },
  { id: "p2", productName: "Beurre doux", recipeNames: "Gâteau" },
];

describe("computeFuzzySearchMatches", () => {
  it("matche sur le nom du produit sans les recettes", () => {
    const ids = computeFuzzySearchMatches(searchable, "beurre", false);
    expect(ids.has("p2")).toBe(true);
    expect(ids.has("p1")).toBe(false);
  });

  it("matche sur les titres de recettes quand searchInRecipes", () => {
    const ids = computeFuzzySearchMatches(searchable, "tarte", true);
    expect(ids.has("p1")).toBe(true);
    expect(ids.has("p2")).toBe(false);
  });

  it("ignore les titres de recettes sans le flag", () => {
    const ids = computeFuzzySearchMatches(searchable, "tarte", false);
    expect(ids.has("p1")).toBe(false);
  });

  it("retourne un set vide sur requête vide", () => {
    expect(computeFuzzySearchMatches(searchable, "  ", true).size).toBe(0);
  });
});

describe("matchesFilters — bypass pendant une recherche", () => {
  it("ignore les autres filtres quand une recherche est active", () => {
    const product = makeEnrichedProduct({ id: "p1", store: "Biocoop" });
    const filters = makeFilters({
      searchQuery: "crème",
      storeFilterMode: "none", // exclurait le produit hors recherche
    });
    expect(matchesFilters(product, filters, new Set(["p1"]))).toBe(true);
  });

  it("exclut les non-matchés pendant une recherche", () => {
    const product = makeEnrichedProduct({ id: "p2" });
    const filters = makeFilters({ searchQuery: "crème" });
    expect(matchesFilters(product, filters, new Set(["p1"]))).toBe(false);
  });

  it("applique les filtres normalement sans recherche", () => {
    const product = makeEnrichedProduct({
      id: "p1",
      storeInfo: { storeName: "Biocoop", storeComment: "" },
    });
    const filters = makeFilters({ storeFilterMode: "none" });
    expect(matchesFilters(product, filters, undefined)).toBe(false);
  });
});
