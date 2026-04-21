/**
 * Utilitaire d'export CSV pour le matériel événement.
 *
 * Format groupé par besoin (header) avec colonnes :
 * Nom ; Type ; Besoin ; Trouvé ; À vérifier ; Notes
 *
 * Même pattern que product-csv-export.ts :
 * - Délimiteur point-virgule (`;`) pour compatibilité Excel France
 * - BOM UTF-8 (`\uFEFF`) pour l'encodage
 * - Échappement intelligent des cellules
 */

export interface CsvExportMaterielRow {
  name: string;
  type: string;
  besoin: number;
  trouve: string;
  aVerifier: string;
  notes: string;
}

/**
 * Formatte une liste d'apports en chaîne lisible :
 * "3 (Marie - Salle A)" ou "3 (Marie), 2 (Pierre - Bureau)"
 */
export function formatAllocations(
  allocations: { qty: number; who: string; where: string }[],
): string {
  if (allocations.length === 0) return "";

  return allocations
    .map((a) => {
      const parts: string[] = [];
      if (a.who) parts.push(a.who);
      if (a.where) parts.push(a.where);
      return parts.length > 0 ? `${a.qty} (${parts.join(" - ")})` : `${a.qty}`;
    })
    .join(", ");
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
 * Export materiel groups to a CSV string (semicolon separator, UTF-8 BOM prefix).
 */
export function exportMaterielToCsv(rows: CsvExportMaterielRow[]): string {
  const lines: string[] = [];

  // Column headers
  lines.push("Nom;Type;Besoin;Trouvé;À vérifier;Notes");

  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.name),
        escapeCsvCell(row.type),
        escapeCsvCell(String(row.besoin)),
        escapeCsvCell(row.trouve || "-"),
        escapeCsvCell(row.aVerifier || "-"),
        escapeCsvCell(row.notes || "-"),
      ].join(";"),
    );
  }

  // UTF-8 BOM prefix for Excel compatibility
  return "\uFEFF" + lines.join("\n");
}
