import { describe, it, expect } from "vitest";
import { calculateProductStatsForDateRange } from "../dateRange";
import { makeEnrichedProduct } from "./fixtures/enriched-products";

/**
 * Régression : un override legacy saisi dans une unité non normalisée
 * (ex. « Poivre 30 l. » alors que le besoin calculé était « 30 gr. »)
 * doit être normalisé avant le calcul du stock, sinon le « manque » ne se
 * résorbe jamais et le bouton de validation rapide reste actif.
 */
describe("calculateProductStatsForDateRange avec override legacy", () => {
  it("normalise l'override d'un produit manuel (l. → ml)", () => {
    const product = makeEnrichedProduct({
      ingredientRef: "",
      byDate: {},
      totalNeededArray: [{ q: 30, u: "gr." }],
      totalNeededOverrideParsed: {
        totalOverride: { q: 30, u: "l." },
        comment: "",
        totalComputedWhenOverride: [{ q: 30, u: "gr." }],
        platesNbWhenOverride: 1,
        recipesNbWhenOverride: 1,
      },
    });

    const stats = calculateProductStatsForDateRange(
      product,
      "2026-04-01",
      "2026-04-30",
    );

    expect(stats.requiredQuantities).toEqual([{ q: 30000, u: "ml" }]);
  });

  it("garde le totalNeededArray sans override", () => {
    const product = makeEnrichedProduct({
      ingredientRef: "",
      byDate: {},
      totalNeededArray: [{ q: 500, u: "gr." }],
      totalNeededOverrideParsed: null,
    });

    const stats = calculateProductStatsForDateRange(
      product,
      "2026-04-01",
      "2026-04-30",
    );

    expect(stats.requiredQuantities).toEqual([{ q: 500, u: "gr." }]);
  });
});
