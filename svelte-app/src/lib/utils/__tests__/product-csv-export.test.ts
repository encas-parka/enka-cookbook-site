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
  it("emits the header row including the merged column", () => {
    const csv = exportProductsToCsv(makeOptions());
    const header = csv.replace(/^\uFEFF/, "").split("\n")[0];
    expect(header).toBe(
      "Produit;Type;Magasin;Responsable(s);Besoin;Acheté;Manque;Fusionné",
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
      "Crème de soja;Crémerie;Biocoop;Alice;3 l;-;-;Crème d'amande, Crème liquide",
    );
  });

  it("leaves the merged column empty without merged sources", () => {
    const csv = exportProductsToCsv(makeOptions());
    const row = csv.split("\n").find((l) => l.includes("Crème de soja"));
    expect(row!.endsWith(";")).toBe(true);
  });
});
