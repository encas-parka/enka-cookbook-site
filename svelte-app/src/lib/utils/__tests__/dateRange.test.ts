import { describe, it, expect } from "vitest";
import { calculateProductStatsForDateRange } from "../dateRange";
import type {
  EnrichedProduct,
  NumericQuantity,
  TotalNeededOverrideData,
  ByDateEntry,
} from "$lib/types/store.types";
import type { Purchases } from "$lib/types/appwrite";

/**
 * Tests de non-régression pour le calcul du stock manquant avec override.
 *
 * Contexte : bug où un override legacy stocké dans une unité non normalisée
 * (kg/l.) empêchait les achats (normalisés en gr./ml.) de réduire le manquant.
 * Les achats s'accumulaient indéfiniment sans jamais couvrir le besoin.
 *
 * Le correctif centralise la normalisation de l'override dans
 * `getEffectiveNeededQuantities` (productsUtils), utilisé par dateRange.ts.
 */

function makeOverride(
  totalOverride: NumericQuantity,
  partial: Partial<TotalNeededOverrideData> = {},
): TotalNeededOverrideData {
  return {
    totalOverride,
    comment: "test",
    totalComputedWhenOverride: [],
    platesNbWhenOverride: 0,
    recipesNbWhenOverride: 0,
    ...partial,
  };
}

/** Produit standard (avec byDate Hugo) + override éventuel. */
function makeStandardProduct(
  overrides?: Partial<EnrichedProduct>,
): EnrichedProduct {
  const now = new Date().toISOString();
  return {
    $id: "prod-1",
    $createdAt: now,
    $updatedAt: now,
    productHugoUuid: "hugo-1",
    productName: "Farine",
    productType: "epicerie",
    pF: false,
    pS: false,
    nbRecipes: 1,
    totalAssiettes: 10,
    isSynced: true,
    mainId: "event-1",
    status: "active",
    who: [],
    store: "",
    stockReel: null,
    previousNames: null,
    mergeDate: null,
    mergedInto: null,
    mergedFrom: [],
    totalNeededOverride: null,
    updatedBy: null,
    purchases: [],
    byDate: {
      "2026-07-01T00:00:00.000Z": {
        totalConsolidated: [{ q: 500, u: "gr." }],
        recipes: [
          { r: "Gâteau", q: 500, u: "gr.", qEq: 500, uEq: "gr.", a: 10 },
        ],
        totalAssiettes: 10,
        recipeCount: 1,
      } as ByDateEntry,
    },
    storeInfo: null,
    stockParsed: null,
    totalNeededArray: [{ q: 500, u: "gr." }],
    totalPurchasesArray: [],
    missingQuantityArray: [],
    displayTotalNeeded: "500 gr.",
    displayMissingQuantity: "",
    displayTotalOverride: "",
    totalNeededOverrideParsed: null,
    dateDisplayInfo: {},
    specs: null,
    ...overrides,
  };
}

/** Produit manuel (sans lien Hugo, sans byDate) + override éventuel. */
function makeManualProduct(
  overrides?: Partial<EnrichedProduct>,
): EnrichedProduct {
  return makeStandardProduct({
    productHugoUuid: "",
    byDate: {},
    totalNeededArray: [{ q: 500, u: "gr." }],
    ...overrides,
  });
}

/** Achat « ordered » dans la plage (deliveryDate future pour être compté). */
function makePurchase(
  quantity: number,
  unit: string,
  partial: Partial<Purchases> = {},
): Purchases {
  return {
    $id: `p-${Math.random().toString(36).slice(2)}`,
    $createdAt: "2026-06-25T10:00:00Z",
    quantity,
    unit,
    status: "ordered",
    products: ["prod-1"],
    deliveryDate: "2026-06-30",
    ...partial,
  } as Purchases;
}

const START = "2026-07-01T00:00:00.000Z";
const END = "2026-07-01T23:59:59.000Z";

describe("calculateProductStatsForDateRange — override & stock manquant", () => {
  describe("produit standard (avec byDate)", () => {
    it("override legacy en kg : les achats en gr. réduisent bien le manquant", () => {
      // Override legacy stocké en kg (non normalisé)
      const product = makeStandardProduct({
        totalNeededOverrideParsed: makeOverride({ q: 2, u: "kg" }),
        purchases: [makePurchase(500, "gr.")],
      });

      const stats = calculateProductStatsForDateRange(product, START, END);

      // 2 kg normalisé → 2000 gr. ; 2000 - 500 (achat) = 1500 gr. manquants
      expect(stats.missingStockQuantities).toEqual([{ q: -1500, u: "gr." }]);
      expect(stats.hasMissingStock).toBe(true);
    });

    it("override legacy en kg : achats successifs cumulés couvrent le besoin", () => {
      // Scénario du bug : 2 validations rapides de 1000 gr. chacune
      const product = makeStandardProduct({
        totalNeededOverrideParsed: makeOverride({ q: 2, u: "kg" }),
        purchases: [makePurchase(1000, "gr."), makePurchase(1000, "gr.")],
      });

      const stats = calculateProductStatsForDateRange(product, START, END);

      // 2000 - 2000 = 0 → plus de manquant (bug : restait à -2 kg avant correctif)
      expect(stats.missingStockQuantities).toEqual([]);
      expect(stats.hasMissingStock).toBe(false);
    });

    it("override déjà normalisé en gr. : comportement inchangé", () => {
      const product = makeStandardProduct({
        totalNeededOverrideParsed: makeOverride({ q: 2000, u: "gr." }),
        purchases: [makePurchase(500, "gr.")],
      });

      const stats = calculateProductStatsForDateRange(product, START, END);

      expect(stats.missingStockQuantities).toEqual([{ q: -1500, u: "gr." }]);
    });

    it("sans override : utilise le besoin calculé depuis byDate", () => {
      const product = makeStandardProduct({
        purchases: [makePurchase(200, "gr.")],
      });

      const stats = calculateProductStatsForDateRange(product, START, END);

      // byDate = 500 gr. ; 500 - 200 = 300 manquants
      expect(stats.missingStockQuantities).toEqual([{ q: -300, u: "gr." }]);
    });

    it("override à zéro : aucun manquant même avec des achats", () => {
      // Un override à 0 signifie « je n'ai besoin de rien » : le besoin
      // effectif est 0, donc jamais de manquant, quel que soit le stock.
      const product = makeStandardProduct({
        totalNeededOverrideParsed: makeOverride({ q: 0, u: "gr." }),
        purchases: [makePurchase(500, "gr.")],
      });

      const stats = calculateProductStatsForDateRange(product, START, END);

      expect(stats.missingStockQuantities).toEqual([]);
      expect(stats.hasMissingStock).toBe(false);
    });
  });

  describe("produit manuel (sans byDate)", () => {
    it("override legacy en kg : les achats en gr. réduisent bien le manquant", () => {
      const product = makeManualProduct({
        totalNeededOverrideParsed: makeOverride({ q: 2, u: "kg" }),
        purchases: [makePurchase(500, "gr.")],
      });

      const stats = calculateProductStatsForDateRange(product, START, END);

      // 2 kg → 2000 gr. ; 2000 - 500 = 1500 manquants
      expect(stats.missingStockQuantities).toEqual([{ q: -1500, u: "gr." }]);
      expect(stats.hasMissingStock).toBe(true);
    });

    it("override legacy en l. : les achats en ml réduisent bien le manquant", () => {
      const product = makeManualProduct({
        totalNeededOverrideParsed: makeOverride({ q: 1, u: "l." }),
        purchases: [makePurchase(400, "ml")],
      });

      const stats = calculateProductStatsForDateRange(product, START, END);

      // 1 l. → 1000 ml ; 1000 - 400 = 600 manquants
      expect(stats.missingStockQuantities).toEqual([{ q: -600, u: "ml" }]);
    });

    it("override legacy en l. : achats cumulés couvrent le besoin", () => {
      const product = makeManualProduct({
        totalNeededOverrideParsed: makeOverride({ q: 1, u: "l." }),
        purchases: [makePurchase(600, "ml"), makePurchase(400, "ml")],
      });

      const stats = calculateProductStatsForDateRange(product, START, END);

      expect(stats.missingStockQuantities).toEqual([]);
      expect(stats.hasMissingStock).toBe(false);
    });
  });
});
