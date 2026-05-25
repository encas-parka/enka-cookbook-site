import { describe, it, expect, vi } from "vitest";
import { buildRawProductBase, applyNeedToBase } from "../productEnrichment";
import type { EnrichedProduct, NumericQuantity, ByDateEntry } from "$lib/types/store.types";
import type { ParsedNeed } from "../product-need-serializer";

vi.mock("$lib/stores/RecipesStore.svelte", () => ({
  recipesStore: {},
}));

vi.mock("$lib/services/toast.service.svelte", () => ({
  toastService: { track: vi.fn() },
}));

function makeRawProduct(overrides?: Partial<any>): any {
  return {
    $id: "raw-product-001",
    $createdAt: "2026-01-01T00:00:00Z",
    $updatedAt: "2026-01-01T00:00:00Z",
    productName: "Beurre doux",
    productHugoUuid: "hugo-beurre-001",
    productType: "cremerie",
    status: "active",
    who: ["Alice", "Bob"],
    store: JSON.stringify({ storeName: "Carrefour", storeComment: "Bio" }),
    stockReel: null,
    previousNames: null,
    mergeDate: null,
    mergedInto: null,
    totalNeededOverride: null,
    updatedBy: null,
    isSynced: true,
    mainId: "event-001",
    specs: null,
    purchases: [],
    ...overrides,
  };
}

describe("buildRawProductBase", () => {
  describe("cas raw seul (produit Appwrite sans besoin Hugo)", () => {
    it("copie les métadonnées Appwrite brutes", () => {
      const raw = makeRawProduct();
      const result = buildRawProductBase(raw);

      expect(result.$id).toBe("raw-product-001");
      expect(result.productName).toBe("Beurre doux");
      expect(result.productHugoUuid).toBe("hugo-beurre-001");
      expect(result.status).toBe("active");
      expect(result.isSynced).toBe(true);
      expect(result.mainId).toBe("event-001");
    });

    it("utilise le productType du raw", () => {
      const raw = makeRawProduct({ productType: "boucherie" });
      const result = buildRawProductBase(raw);

      expect(result.productType).toBe("boucherie");
    });

    it("fallback productType à 'none' si null", () => {
      const raw = makeRawProduct({ productType: null });
      const result = buildRawProductBase(raw);

      expect(result.productType).toBe("none");
    });

    it("pars et normalise le stock (kg → gr.)", () => {
      const raw = makeRawProduct({
        stockReel: JSON.stringify({ quantity: "2", unit: "kg", notes: "", dateTime: "" }),
      });
      const result = buildRawProductBase(raw);

      expect(result.stockParsed).not.toBeNull();
      expect(result.stockParsed!.quantity).toBe(2000);
      expect(result.stockParsed!.unit).toBe("gr.");
    });

    it("pars le store JSON en storeInfo", () => {
      const raw = makeRawProduct();
      const result = buildRawProductBase(raw);

      expect(result.storeInfo).toEqual({
        storeName: "Carrefour",
        storeComment: "Bio",
      });
    });

    it("storeInfo est null si store est vide", () => {
      const raw = makeRawProduct({ store: "" });
      const result = buildRawProductBase(raw);

      expect(result.storeInfo).toBeNull();
    });

    it("stockParsed est null si stockReel est null", () => {
      const raw = makeRawProduct({ stockReel: null });
      const result = buildRawProductBase(raw);

      expect(result.stockParsed).toBeNull();
    });

    it("pF/pS par défaut à false si pas de specs", () => {
      const raw = makeRawProduct({ specs: null });
      const result = buildRawProductBase(raw);

      expect(result.pF).toBe(false);
      expect(result.pS).toBe(false);
    });

    it("pF/pS extraits des specs si présentes", () => {
      const raw = makeRawProduct({
        specs: JSON.stringify({ pF: true, pS: false, quantity: { q: 500, u: "gr." } }),
      });
      const result = buildRawProductBase(raw);

      expect(result.pF).toBe(true);
      expect(result.pS).toBe(false);
    });

    it("totalNeededArray vient de specs.quantity pour un produit manuel", () => {
      const raw = makeRawProduct({
        specs: JSON.stringify({ quantity: { q: 500, u: "gr." } }),
      });
      const result = buildRawProductBase(raw);

      expect(result.totalNeededArray).toEqual([{ q: 500, u: "gr." }]);
    });

    it("totalNeededArray est vide si pas de specs.quantity", () => {
      const raw = makeRawProduct({ specs: null });
      const result = buildRawProductBase(raw);

      expect(result.totalNeededArray).toEqual([]);
    });

    it("nbRecipes et totalAssiettes sont 0", () => {
      const raw = makeRawProduct();
      const result = buildRawProductBase(raw);

      expect(result.nbRecipes).toBe(0);
      expect(result.totalAssiettes).toBe(0);
    });

    it("byDate est vide {}", () => {
      const raw = makeRawProduct();
      const result = buildRawProductBase(raw);

      expect(result.byDate).toEqual({});
    });

    it("dateDisplayInfo est vide {}", () => {
      const raw = makeRawProduct();
      const result = buildRawProductBase(raw);

      expect(result.dateDisplayInfo).toEqual({});
    });

    it("filtre les purchases avec status 'deleted'", () => {
      const raw = makeRawProduct({
        purchases: [
          { $id: "p1", quantity: 2, unit: "kg", status: "ordered", products: ["raw-product-001"] },
          { $id: "p2", quantity: 1, unit: "kg", status: "deleted", products: ["raw-product-001"] },
          { $id: "p3", quantity: 500, unit: "gr.", status: "delivered", products: ["raw-product-001"] },
        ],
      });
      const result = buildRawProductBase(raw);

      expect(result.purchases).toHaveLength(3);
      expect(result.totalPurchasesArray).toEqual([
        { q: 2, u: "kg" },
        { q: 500, u: "gr." },
      ]);
    });

    it("totalPurchasesArray est vide si pas de purchases", () => {
      const raw = makeRawProduct({ purchases: [] });
      const result = buildRawProductBase(raw);

      expect(result.totalPurchasesArray).toEqual([]);
    });
  });

  describe("override manuel", () => {
    it("totalNeededOverrideParsed est parsé depuis totalNeededOverride", () => {
      const override = {
        totalOverride: { q: 1000, u: "gr." },
        comment: "Test override",
        totalComputedWhenOverride: [{ q: 500, u: "gr." }],
        platesNbWhenOverride: 10,
        recipesNbWhenOverride: 2,
      };
      const raw = makeRawProduct({
        totalNeededOverride: JSON.stringify(override),
      });
      const result = buildRawProductBase(raw);

      expect(result.totalNeededOverrideParsed).not.toBeNull();
      expect(result.totalNeededOverrideParsed!.totalOverride).toEqual({ q: 1000, u: "gr." });
    });

    it("missingQuantityArray utilise l'override comme besoin effectif", () => {
      const override = {
        totalOverride: { q: 1000, u: "gr." },
        comment: "Test",
        totalComputedWhenOverride: [{ q: 500, u: "gr." }],
        platesNbWhenOverride: 10,
        recipesNbWhenOverride: 2,
      };
      const raw = makeRawProduct({
        totalNeededOverride: JSON.stringify(override),
        purchases: [
          { $id: "p1", quantity: 300, unit: "gr.", status: "ordered", products: ["raw-product-001"] },
        ],
      });
      const result = buildRawProductBase(raw);

      expect(result.missingQuantityArray).toEqual([{ q: 700, u: "gr." }]);
    });

    it("totalNeededOverrideParsed est null si pas d'override", () => {
      const raw = makeRawProduct({ totalNeededOverride: null });
      const result = buildRawProductBase(raw);

      expect(result.totalNeededOverrideParsed).toBeNull();
    });
  });

  describe("champs calculés de display", () => {
    it("displayTotalNeeded formate totalNeededArray", () => {
      const raw = makeRawProduct({
        specs: JSON.stringify({ quantity: { q: 1500, u: "gr." } }),
      });
      const result = buildRawProductBase(raw);

      expect(result.displayTotalNeeded).toBeTruthy();
      expect(result.displayTotalNeeded).toContain("1.5 kg");
    });

    it("displayMissingQuantity affiche le manquant", () => {
      const raw = makeRawProduct({
        specs: JSON.stringify({ quantity: { q: 1000, u: "gr." } }),
        purchases: [
          { $id: "p1", quantity: 300, unit: "gr.", status: "ordered", products: ["raw-product-001"] },
        ],
      });
      const result = buildRawProductBase(raw);

      expect(result.displayMissingQuantity).toContain("700");
    });

    it("displayTotalOverride formate l'override", () => {
      const override = {
        totalOverride: { q: 2000, u: "gr." },
        comment: "Test",
        totalComputedWhenOverride: [],
        platesNbWhenOverride: 0,
        recipesNbWhenOverride: 0,
      };
      const raw = makeRawProduct({
        totalNeededOverride: JSON.stringify(override),
      });
      const result = buildRawProductBase(raw);

      expect(result.displayTotalOverride).toContain("2 kg");
    });

    it("displayTotalOverride est vide si pas d'override", () => {
      const raw = makeRawProduct({ totalNeededOverride: null });
      const result = buildRawProductBase(raw);

      expect(result.displayTotalOverride).toBe("");
    });
  });
});

describe("applyNeedToBase", () => {
  function makeNeed(overrides?: Partial<ParsedNeed>): ParsedNeed {
    return {
      $id: "raw-product-001",
      mainId: "event-001",
      productHugoUuid: "hugo-beurre-001",
      productName: "Beurre doux",
      productType: "cremerie",
      pF: true,
      pS: false,
      byDate: {
        "2026-04-20": {
          totalConsolidated: [{ q: 500, u: "gr." }],
          recipes: [{ r: "Gâteau", q: 500, u: "gr.", qEq: 500, uEq: "gr.", a: 10 }],
          totalAssiettes: 10,
          recipeCount: 1,
        },
      } as Record<string, ByDateEntry>,
      totalNeededArray: [{ q: 500, u: "gr." }],
      nbRecipes: 1,
      totalAssiettes: 10,
      dateDisplayInfo: { "2026-04-20": { formattedDate: "Dim 20", timeIcon: null } },
      $createdAt: "2026-01-01T00:00:00Z",
      $updatedAt: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  it("surcharge productType depuis le need (priorité Hugo)", () => {
    const raw = makeRawProduct({ productType: "boucherie" });
    const base = buildRawProductBase(raw);
    const need = makeNeed({ productType: "cremerie" });

    applyNeedToBase(base, need);
    expect(base.productType).toBe("cremerie");
  });

  it("surcharge pF/pS depuis le need", () => {
    const raw = makeRawProduct({ specs: JSON.stringify({ pF: false, pS: true }) });
    const base = buildRawProductBase(raw);
    const need = makeNeed({ pF: true, pS: false });

    applyNeedToBase(base, need);
    expect(base.pF).toBe(true);
    expect(base.pS).toBe(false);
  });

  it("applique byDate, totalNeededArray, nbRecipes, totalAssiettes", () => {
    const raw = makeRawProduct();
    const base = buildRawProductBase(raw);
    const need = makeNeed();

    applyNeedToBase(base, need);
    expect(base.byDate).toBe(need.byDate);
    expect(base.totalNeededArray).toBe(need.totalNeededArray);
    expect(base.nbRecipes).toBe(1);
    expect(base.totalAssiettes).toBe(10);
  });

  it("RECALCULE missingQuantityArray avec le bon totalNeededArray", () => {
    const raw = makeRawProduct({
      purchases: [
        { $id: "p1", quantity: 200, unit: "gr.", status: "ordered", products: ["raw-product-001"] },
      ],
    });
    const base = buildRawProductBase(raw);

    expect(base.missingQuantityArray).toEqual([]);

    const need = makeNeed({ totalNeededArray: [{ q: 500, u: "gr." }] });
    applyNeedToBase(base, need);

    expect(base.missingQuantityArray).toEqual([{ q: 300, u: "gr." }]);
    expect(base.displayMissingQuantity).toContain("300");
  });

  it("RECALCULE displayTotalNeeded avec le nouveau totalNeededArray", () => {
    const raw = makeRawProduct();
    const base = buildRawProductBase(raw);
    const need = makeNeed({ totalNeededArray: [{ q: 2000, u: "gr." }] });

    applyNeedToBase(base, need);
    expect(base.displayTotalNeeded).toContain("2 kg");
  });

  it("préserve l'override : missing calculé depuis l'override, pas le need", () => {
    const override = {
      totalOverride: { q: 3000, u: "gr." },
      comment: "Override test",
      totalComputedWhenOverride: [{ q: 500, u: "gr." }],
      platesNbWhenOverride: 10,
      recipesNbWhenOverride: 1,
    };
    const raw = makeRawProduct({
      totalNeededOverride: JSON.stringify(override),
      purchases: [
        { $id: "p1", quantity: 1000, unit: "gr.", status: "ordered", products: ["raw-product-001"] },
      ],
    });
    const base = buildRawProductBase(raw);
    const need = makeNeed({ totalNeededArray: [{ q: 500, u: "gr." }] });

    applyNeedToBase(base, need);

    expect(base.totalNeededArray).toEqual([{ q: 500, u: "gr." }]);
    expect(base.missingQuantityArray).toEqual([{ q: 2000, u: "gr." }]);
  });

  it("applique dateDisplayInfo depuis le need", () => {
    const raw = makeRawProduct();
    const base = buildRawProductBase(raw);
    const need = makeNeed();

    applyNeedToBase(base, need);
    expect(base.dateDisplayInfo).toBe(need.dateDisplayInfo);
  });
});
