import { describe, it, expect } from "vitest";
import { parseNeedRow, toNeedRow } from "../product-need-serializer";
import { makeNeedRow, makeEnrichedProduct } from "./fixtures/enriched-products";

describe("product-need-serializer", () => {
  describe("parseNeedRow", () => {
    it("parses JSON fields from a ProductNeedRow", () => {
      const row = makeNeedRow();
      const parsed = parseNeedRow(row);

      expect(parsed.$id).toBe(row.$id);
      expect(parsed.mainId).toBe("event-001");
      expect(parsed.productName).toBe("Beurre");
      expect(parsed.productType).toBe("cremerie");
      expect(parsed.pF).toBe(true);
      expect(parsed.pS).toBe(false);
      expect(parsed.nbRecipes).toBe(1);
      expect(parsed.totalAssiettes).toBe(10);
    });

    it("parses byDate from JSON string", () => {
      const row = makeNeedRow();
      const parsed = parseNeedRow(row);

      expect(parsed.byDate).toEqual({
        "2026-04-20": {
          totalConsolidated: [{ q: 500, u: "gr." }],
          recipes: [{ r: "Gâteau", q: 500, u: "gr.", qEq: 500, uEq: "gr.", a: 10 }],
          totalAssiettes: 10,
          recipeCount: 1,
        },
      });
    });

    it("parses totalNeededArray from JSON string", () => {
      const row = makeNeedRow();
      const parsed = parseNeedRow(row);

      expect(parsed.totalNeededArray).toEqual([{ q: 500, u: "gr." }]);
    });

    it("parses dateDisplayInfo from JSON string", () => {
      const row = makeNeedRow({
        dateDisplayInfo: JSON.stringify({ "2026-04-20": { label: "Dim 20" } }),
      });
      const parsed = parseNeedRow(row);

      expect(parsed.dateDisplayInfo).toEqual({
        "2026-04-20": { label: "Dim 20" },
      });
    });

    it("handles empty arrays", () => {
      const row = makeNeedRow({
        totalNeededArray: JSON.stringify([]),
        byDate: JSON.stringify({}),
        dateDisplayInfo: JSON.stringify({}),
        nbRecipes: 0,
        totalAssiettes: 0,
      });
      const parsed = parseNeedRow(row);

      expect(parsed.totalNeededArray).toEqual([]);
      expect(parsed.byDate).toEqual({});
      expect(parsed.dateDisplayInfo).toEqual({});
      expect(parsed.nbRecipes).toBe(0);
      expect(parsed.totalAssiettes).toBe(0);
    });
  });

  describe("toNeedRow", () => {
    it("serializes EnrichedProduct need fields to a ProductNeedRow", () => {
      const enriched = makeEnrichedProduct();
      const row = toNeedRow(enriched, "event-001");

      expect(row.$id).toBe(enriched.$id);
      expect(row.mainId).toBe("event-001");
      expect(row.productHugoUuid).toBe("hugo-uuid-1");
      expect(row.productName).toBe("Beurre");
      expect(row.productType).toBe("cremerie");
      expect(row.pF).toBe(true);
      expect(row.pS).toBe(false);
      expect(row.nbRecipes).toBe(1);
      expect(row.totalAssiettes).toBe(10);
    });

    it("serializes byDate as JSON string", () => {
      const enriched = makeEnrichedProduct();
      const row = toNeedRow(enriched, "event-001");

      expect(row.byDate).toBe(JSON.stringify(enriched.byDate));
      const parsed = JSON.parse(row.byDate);
      expect(parsed["2026-04-20"].totalConsolidated).toEqual([
        { q: 500, u: "gr." },
      ]);
    });

    it("serializes totalNeededArray as JSON string", () => {
      const enriched = makeEnrichedProduct();
      const row = toNeedRow(enriched, "event-001");

      expect(row.totalNeededArray).toBe(JSON.stringify(enriched.totalNeededArray));
    });

    it("defaults productHugoUuid to empty string when null", () => {
      const enriched = makeEnrichedProduct({ productHugoUuid: null as any });
      const row = toNeedRow(enriched, "event-001");

      expect(row.productHugoUuid).toBe("");
    });

    it("sets $updatedAt to a valid ISO string", () => {
      const enriched = makeEnrichedProduct();
      const row = toNeedRow(enriched, "event-001");

      expect(new Date(row.$updatedAt).toISOString()).toBe(row.$updatedAt);
    });

    it("uses enriched $createdAt if present", () => {
      const enriched = makeEnrichedProduct({
        $createdAt: "2026-01-01T00:00:00Z",
      });
      const row = toNeedRow(enriched, "event-001");

      expect(row.$createdAt).toBe("2026-01-01T00:00:00Z");
    });

    it("defaults $createdAt to now if empty", () => {
      const enriched = makeEnrichedProduct({ $createdAt: "" });
      const row = toNeedRow(enriched, "event-001");

      expect(row.$createdAt).toBeTruthy();
    });
  });

  describe("round-trip", () => {
    it("toNeedRow → parseNeedRow preserves scalar fields", () => {
      const enriched = makeEnrichedProduct();
      const row = toNeedRow(enriched, "event-001");
      const parsed = parseNeedRow(row);

      expect(parsed.$id).toBe(enriched.$id);
      expect(parsed.productName).toBe(enriched.productName);
      expect(parsed.productType).toBe(enriched.productType);
      expect(parsed.pF).toBe(enriched.pF);
      expect(parsed.pS).toBe(enriched.pS);
      expect(parsed.nbRecipes).toBe(enriched.nbRecipes);
      expect(parsed.totalAssiettes).toBe(enriched.totalAssiettes);
    });

    it("toNeedRow → parseNeedRow preserves structured fields", () => {
      const enriched = makeEnrichedProduct();
      const row = toNeedRow(enriched, "event-001");
      const parsed = parseNeedRow(row);

      expect(parsed.byDate).toEqual(enriched.byDate);
      expect(parsed.totalNeededArray).toEqual(enriched.totalNeededArray);
    });
  });
});
