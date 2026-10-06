import { describe, it, expect, vi } from "vitest";

// products-display importe des icônes @lucide/svelte (composants, non compilés
// par vitest) — mock de la liste exportée utilisée par getProductTypeInfo
vi.mock("@lucide/svelte", () => ({
  Bean: {},
  Beef: {},
  Carrot: {},
  CandyCane: {},
  Egg: {},
  ChefHat: {},
  Leaf: {},
  Refrigerator: {},
  Package: {},
}));

import { formatPurchasesWithBadges } from "../products-display";

// Les badges consommés par ProductCard / ProductCardCompact : prouve que la
// date de livraison y est affichée formatée, jamais au format brut PocketBase
describe("formatPurchasesWithBadges", () => {
  it("formate deliveryDate (fr-FR) et n'expose jamais le format brut PB", () => {
    const [badge] = formatPurchasesWithBadges([
      {
        status: "ordered",
        unit: "unit",
        quantity: 2,
        deliveryDate: "2026-05-08 00:00:00.000Z",
      },
    ]);

    expect(badge.deliveryDate).toBeDefined();
    expect(badge.deliveryDate).toMatch(/[a-zà-ÿ]/i);
    expect(badge.deliveryDate).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(badge.deliveryDate).not.toContain(":");
  });

  it("laisse deliveryDate indéfini sans date de livraison", () => {
    const [badge] = formatPurchasesWithBadges([
      { status: "ordered", unit: "unit", quantity: 1, deliveryDate: "" },
    ]);

    expect(badge.deliveryDate).toBeUndefined();
  });
});
