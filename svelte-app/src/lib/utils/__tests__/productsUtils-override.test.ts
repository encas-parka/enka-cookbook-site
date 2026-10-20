import { describe, it, expect } from "vitest";
import {
  normalizeQty,
  getNormalizedOverride,
  getEffectiveNeededQuantities,
} from "../productsUtils";
import type { TotalNeededOverrideData } from "$lib/types/store.types";

function makeOverride(q: number, u: string): TotalNeededOverrideData {
  return {
    totalOverride: { q, u },
    comment: "",
    totalComputedWhenOverride: [],
    platesNbWhenOverride: 0,
    recipesNbWhenOverride: 0,
  };
}

describe("normalizeQty", () => {
  it("convertit les kg en gr.", () => {
    expect(normalizeQty(4, "kg")).toEqual({ q: 4000, u: "gr." });
  });

  it("convertit les l. en ml", () => {
    expect(normalizeQty(30, "l.")).toEqual({ q: 30000, u: "ml" });
  });

  it("laisse les gr./ml. inchangés", () => {
    expect(normalizeQty(500, "gr.")).toEqual({ q: 500, u: "gr." });
    expect(normalizeQty(5, "ml")).toEqual({ q: 5, u: "ml" });
  });
});

describe("getNormalizedOverride", () => {
  it("normalise un override legacy saisi en kg", () => {
    expect(
      getNormalizedOverride({
        totalNeededOverrideParsed: makeOverride(4, "kg"),
      }),
    ).toEqual({ q: 4000, u: "gr." });
  });

  it("retourne null sans override", () => {
    expect(
      getNormalizedOverride({ totalNeededOverrideParsed: null }),
    ).toBeNull();
  });
});

describe("getEffectiveNeededQuantities", () => {
  it("prime l'override normalisé sur le fallback", () => {
    expect(
      getEffectiveNeededQuantities(
        { totalNeededOverrideParsed: makeOverride(30, "l.") },
        [{ q: 30, u: "gr." }],
      ),
    ).toEqual([{ q: 30000, u: "ml" }]);
  });

  it("retourne le fallback sans override", () => {
    const fallback = [{ q: 500, u: "gr." }];
    expect(
      getEffectiveNeededQuantities(
        { totalNeededOverrideParsed: null },
        fallback,
      ),
    ).toBe(fallback);
  });
});
