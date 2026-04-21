import { describe, it, expect } from "vitest";
import {
  exportProductsToMarkdown,
  type MarkdownExportOptions,
} from "../product-markdown-export";

function makeOptions(
  overrides?: Partial<MarkdownExportOptions>,
): MarkdownExportOptions {
  return {
    eventName: "Test Event",
    dateRange: null,
    groups: [],
    ...overrides,
  };
}

describe("product-markdown-export", () => {
  describe("header", () => {
    it("includes event name as h1", () => {
      const md = exportProductsToMarkdown(makeOptions());
      expect(md).toContain("# Test Event");
    });

    it("includes separator line", () => {
      const md = exportProductsToMarkdown(makeOptions());
      expect(md.startsWith("---")).toBe(true);
    });

    it("includes date range when provided", () => {
      const md = exportProductsToMarkdown(
        makeOptions({
          dateRange: { start: "2026-04-19", end: "2026-04-21" },
        }),
      );
      expect(md).toMatch(/19 avril.*au.*21 avril/);
    });

    it("includes single date when only start provided", () => {
      const md = exportProductsToMarkdown(
        makeOptions({
          dateRange: { start: "2026-04-19", end: "2026-04-19" },
        }),
      );
      expect(md).toMatch(/19 avril/);
    });

    it("omits date line when no dateRange", () => {
      const md = exportProductsToMarkdown(makeOptions({ dateRange: null }));
      expect(md).not.toMatch(/^- \d/);
    });
  });

  describe("empty state", () => {
    it("shows placeholder when no groups", () => {
      const md = exportProductsToMarkdown(makeOptions());
      expect(md).toContain("_Aucun produit ne correspond aux filtres actuels._");
    });
  });

  describe("products", () => {
    it("renders a single product in a named group", () => {
      const md = exportProductsToMarkdown(
        makeOptions({
          groups: [
            {
              label: "Crémerie",
              products: [
                {
                  productName: "Beurre",
                  formattedQuantities: "500 gr.",
                  acquiredQuantities: [],
                  formattedAcquiredQuantities: "",
                  missingQuantities: [],
                  formattedMissingQuantities: "",
                },
              ],
            },
          ],
        }),
      );

      expect(md).toContain("## Crémerie");
      expect(md).toContain("- Beurre: 500 gr.");
    });

    it("renders acquired and missing when present", () => {
      const md = exportProductsToMarkdown(
        makeOptions({
          groups: [
            {
              label: "Sec",
              products: [
                {
                  productName: "Farine",
                  formattedQuantities: "2 kg",
                  acquiredQuantities: [{ q: 1, u: "kg" }],
                  formattedAcquiredQuantities: "1 kg",
                  missingQuantities: [{ q: 1, u: "kg" }],
                  formattedMissingQuantities: "1 kg",
                },
              ],
            },
          ],
        }),
      );

      expect(md).toContain("- Farine: 2 kg | acquis 1 kg | manque 1 kg");
    });

    it("does not show missing when only acquired exists", () => {
      const md = exportProductsToMarkdown(
        makeOptions({
          groups: [
            {
              label: "Sec",
              products: [
                {
                  productName: "Farine",
                  formattedQuantities: "2 kg",
                  acquiredQuantities: [{ q: 2, u: "kg" }],
                  formattedAcquiredQuantities: "2 kg",
                  missingQuantities: [],
                  formattedMissingQuantities: "",
                },
              ],
            },
          ],
        }),
      );

      expect(md).toContain("- Farine: 2 kg | acquis 2 kg");
      expect(md).not.toContain("manque");
    });

    it("uses dash when formattedQuantities is empty", () => {
      const md = exportProductsToMarkdown(
        makeOptions({
          groups: [
            {
              label: "Test",
              products: [
                {
                  productName: "Sel",
                  formattedQuantities: "",
                  acquiredQuantities: [],
                  formattedAcquiredQuantities: "",
                  missingQuantities: [],
                  formattedMissingQuantities: "",
                },
              ],
            },
          ],
        }),
      );

      expect(md).toContain("- Sel: -");
    });

    it("renders products without group header when label is empty", () => {
      const md = exportProductsToMarkdown(
        makeOptions({
          groups: [
            {
              label: "",
              products: [
                {
                  productName: "Sel",
                  formattedQuantities: "1 pincée",
                  acquiredQuantities: [],
                  formattedAcquiredQuantities: "",
                  missingQuantities: [],
                  formattedMissingQuantities: "",
                },
              ],
            },
          ],
        }),
      );

      expect(md).not.toContain("## ");
      expect(md).toContain("- Sel: 1 pincée");
    });

    it("renders multiple groups", () => {
      const md = exportProductsToMarkdown(
        makeOptions({
          groups: [
            {
              label: "Crémerie",
              products: [
                {
                  productName: "Beurre",
                  formattedQuantities: "500 gr.",
                  acquiredQuantities: [],
                  formattedAcquiredQuantities: "",
                  missingQuantities: [],
                  formattedMissingQuantities: "",
                },
              ],
            },
            {
              label: "Sec",
              products: [
                {
                  productName: "Farine",
                  formattedQuantities: "2 kg",
                  acquiredQuantities: [],
                  formattedAcquiredQuantities: "",
                  missingQuantities: [],
                  formattedMissingQuantities: "",
                },
              ],
            },
          ],
        }),
      );

      expect(md).toContain("## Crémerie");
      expect(md).toContain("## Sec");
      expect(md).toContain("- Beurre: 500 gr.");
      expect(md).toContain("- Farine: 2 kg");
    });
  });
});
