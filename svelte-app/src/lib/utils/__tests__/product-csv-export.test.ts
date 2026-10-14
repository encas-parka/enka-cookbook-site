import { describe, it, expect } from "vitest";
import {
  exportProductsToCsv,
  type CsvExportOptions,
  type CsvExportProduct,
} from "../product-csv-export";

function makeProduct(overrides: Partial<CsvExportProduct> = {}): CsvExportProduct {
  return {
    productName: "Crème de soja",
    productType: "Crémerie",
    storeName: "Biocoop",
    who: "Alice",
    formattedQuantities: "3 l",
    formattedAcquiredQuantities: "2 l",
    formattedMissingQuantities: "1 l",
    ...overrides,
  };
}

function makeOptions(products: CsvExportProduct[] = [makeProduct()]): CsvExportOptions {
  return { products };
}

describe("product-csv-export", () => {
  it("emits the header row including the merged and calculated-need columns", () => {
    const csv = exportProductsToCsv(makeOptions());
    const header = csv.replace(/^\uFEFF/, "").split("\n")[0];
    expect(header).toBe(
      "Produit;Type;Magasin;Responsable(s);Besoin;Acheté;Manque;Fusionné;Besoin calculé",
    );
  });

  it("carries merged product names in the last column", () => {
    const csv = exportProductsToCsv(
      makeOptions([
        makeProduct({
          formattedAcquiredQuantities: "",
          formattedMissingQuantities: "",
          mergedProductNames: "Crème d'amande, Crème liquide",
        }),
      ]),
    );
    const row = csv.split("\n").find((l) => l.includes("Crème de soja"));
    expect(row).toBe(
      "Crème de soja;Crémerie;Biocoop;Alice;3 l;-;-;Crème d'amande, Crème liquide;",
    );
  });

  it("leaves the merged column empty without merged sources", () => {
    const csv = exportProductsToCsv(makeOptions());
    const row = csv.split("\n").find((l) => l.includes("Crème de soja"));
    expect(row!.endsWith(";")).toBe(true);
  });

  it("shows the override in Besoin and the computed value in Besoin calculé", () => {
    const csv = exportProductsToCsv(
      makeOptions([
        makeProduct({
          displayTotalOverride: "4 kg",
          formattedCalculatedQuantities: "3 l",
        }),
      ]),
    );
    const row = csv.split("\n").find((l) => l.includes("Crème de soja"));
    expect(row).toBe("Crème de soja;Crémerie;Biocoop;Alice;4 kg;2 l;1 l;;3 l");
  });

  it("leaves Besoin calculé empty without override", () => {
    const csv = exportProductsToCsv(makeOptions());
    const row = csv.split("\n").find((l) => l.includes("Crème de soja"));
    expect(row).toBe("Crème de soja;Crémerie;Biocoop;Alice;3 l;2 l;1 l;;");
  });
});
