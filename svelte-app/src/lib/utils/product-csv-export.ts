export interface CsvExportProduct {
  productName: string;
  productType: string;
  storeName: string;
  who: string;
  formattedQuantities: string;
  formattedAcquiredQuantities: string;
  formattedMissingQuantities: string;
  mergedProductNames?: string; // Noms des produits fusionnés, séparés par ", "
}

export interface CsvExportOptions {
  products: CsvExportProduct[];
}

/**
 * Escape a CSV cell value (handles semicolons, quotes, newlines).
 */
function escapeCsvCell(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export products to a CSV string (semicolon separator, UTF-8 BOM prefix).
 */
export function exportProductsToCsv(options: CsvExportOptions): string {
  const lines: string[] = [];

  // Column headers
  lines.push(
    "Produit;Type;Magasin;Responsable(s);Besoin;Acheté;Manque;Fusionné",
  );

  for (const product of options.products) {
    lines.push(
      [
        escapeCsvCell(product.productName),
        escapeCsvCell(product.productType),
        escapeCsvCell(product.storeName),
        escapeCsvCell(product.who),
        escapeCsvCell(product.formattedQuantities || "-"),
        escapeCsvCell(product.formattedAcquiredQuantities || "-"),
        escapeCsvCell(product.formattedMissingQuantities || "-"),
        escapeCsvCell(product.mergedProductNames || ""),
      ].join(";"),
    );
  }

  // UTF-8 BOM prefix for Excel compatibility
  return "\uFEFF" + lines.join("\n");
}
