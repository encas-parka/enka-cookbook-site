export interface CsvExportProduct {
  productName: string;
  productType: string;
  storeName: string;
  who: string;
  formattedQuantities: string;
  formattedAcquiredQuantities: string;
  formattedMissingQuantities: string;
  mergedProductNames?: string; // Noms des produits fusionnés, séparés par ", "
  displayTotalOverride?: string; // Quantité overwrite (besoin manuel)
  formattedCalculatedQuantities?: string; // Besoin calculé (uniquement si override existe)
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
    "Produit;Type;Magasin;Responsable(s);Besoin;Acheté;Manque;Fusionné;Besoin calculé",
  );

  for (const product of options.products) {
    // Si un override existe, "Besoin" = override, "Besoin calculé" = valeur calculée
    const besoin = product.displayTotalOverride || product.formattedQuantities || "-";
    const besoinCalcule = product.displayTotalOverride
      ? (product.formattedCalculatedQuantities || product.formattedQuantities || "-")
      : "";

    lines.push(
      [
        escapeCsvCell(product.productName),
        escapeCsvCell(product.productType),
        escapeCsvCell(product.storeName),
        escapeCsvCell(product.who),
        escapeCsvCell(besoin),
        escapeCsvCell(product.formattedAcquiredQuantities || "-"),
        escapeCsvCell(product.formattedMissingQuantities || "-"),
        escapeCsvCell(product.mergedProductNames || ""),
        escapeCsvCell(besoinCalcule),
      ].join(";"),
    );
  }

  // UTF-8 BOM prefix for Excel compatibility
  return "\uFEFF" + lines.join("\n");
}
