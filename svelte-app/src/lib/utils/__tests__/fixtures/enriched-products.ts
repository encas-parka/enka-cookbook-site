import type { ProductNeedRow } from "$lib/db-sync/aw-sync";
import type {
  ByDateEntry,
  EnrichedProduct,
  NumericQuantity,
} from "$lib/types/store.types";

export function makeNeedRow(
  overrides?: Partial<ProductNeedRow>,
): ProductNeedRow {
  return {
    $id: "test-product_abc1234567",
    mainId: "event-001",
    productHugoUuid: "hugo-uuid-1",
    productName: "Beurre",
    productType: "cremerie",
    pF: true,
    pS: false,
    byDate: JSON.stringify({
      "2026-04-20": {
        totalConsolidated: [{ q: 500, u: "gr." }],
        recipes: [{ r: "Gâteau", q: 500, u: "gr.", qEq: 500, uEq: "gr.", a: 10 }],
        totalAssiettes: 10,
        recipeCount: 1,
      },
    }),
    totalNeededArray: JSON.stringify([{ q: 500, u: "gr." }]),
    nbRecipes: 1,
    totalAssiettes: 10,
    dateDisplayInfo: JSON.stringify({}),
    $createdAt: "2026-04-19T10:00:00Z",
    $updatedAt: "2026-04-19T10:00:00Z",
    ...overrides,
  };
}

export function makeEnrichedProduct(
  overrides?: Partial<EnrichedProduct>,
): EnrichedProduct {
  const now = new Date().toISOString();
  return {
    $id: "test-product_abc1234567",
    $createdAt: now,
    $updatedAt: now,
    productHugoUuid: "hugo-uuid-1",
    productName: "Beurre",
    productType: "cremerie",
    pF: true,
    pS: false,
    nbRecipes: 1,
    totalAssiettes: 10,
    isSynced: false,
    mainId: "event-001",
    status: "active",
    who: [],
    store: "" as any,
    stockReel: null,
    previousNames: null,
    mergeDate: null,
    mergedInto: null,
    totalNeededOverride: null,
    updatedBy: null,
    purchases: [],
    byDate: {
      "2026-04-20": {
        totalConsolidated: [{ q: 500, u: "gr." }],
        recipes: [{ r: "Gâteau", q: 500, u: "gr.", qEq: 500, uEq: "gr.", a: 10 }],
        totalAssiettes: 10,
        recipeCount: 1,
      },
    } as Record<string, ByDateEntry>,
    storeInfo: null,
    stockParsed: null,
    totalNeededArray: [{ q: 500, u: "gr." }] as NumericQuantity[],
    totalPurchasesArray: [],
    missingQuantityArray: [],
    displayTotalNeeded: "500 gr.",
    displayMissingQuantity: "500 gr.",
    displayTotalOverride: "",
    totalNeededOverrideParsed: null,
    dateDisplayInfo: {},
    specs: null,
    ...overrides,
  };
}
