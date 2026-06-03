import type { NumericQuantity } from "../types/store.types";

export interface MarkdownExportGroup {
  label: string;
  products: MarkdownExportProduct[];
}

export interface MarkdownExportProduct {
  productName: string;
  formattedQuantities: string;
  acquiredQuantities: NumericQuantity[];
  formattedAcquiredQuantities: string;
  missingQuantities: NumericQuantity[];
  formattedMissingQuantities: string;
  mergedProductNames?: string[];
  displayTotalOverride?: string;
}

export interface MarkdownExportOptions {
  eventName: string;
  dateRange?: { start: string | null; end: string | null } | null;
  groups: MarkdownExportGroup[];
}

export function exportProductsToMarkdown(options: MarkdownExportOptions): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`# ${options.eventName}`);

  if (options.dateRange) {
    const { start, end } = options.dateRange;
    if (start && end) {
      const startStr = new Date(start).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      });
      const endStr = new Date(end).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      });
      lines.push(`- ${startStr} au ${endStr}`);
    } else if (start) {
      const dateStr = new Date(start).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      lines.push(`- ${dateStr}`);
    }
  }

  lines.push("");

  const groups = options.groups;

  if (groups.length === 0) {
    lines.push("_Aucun produit ne correspond aux filtres actuels._");
  } else {
    for (const group of groups) {
      if (group.label) {
        lines.push(`## ${group.label}`);
        lines.push("");
      }
      for (const product of group.products) {
        const total = product.formattedQuantities || "-";
        const hasAcquired = product.acquiredQuantities.length > 0;
        const hasMissing = product.missingQuantities.length > 0;
        const hasOverride = !!product.displayTotalOverride;
        const name = product.mergedProductNames?.length
          ? `${product.productName} (inclut: ${product.mergedProductNames.join(", ")})`
          : product.productName;
        const totalDisplay = hasOverride
          ? `~~${total}~~ ${product.displayTotalOverride}`
          : total;
        let line = `- ${name}: ${totalDisplay}`;
        if (hasAcquired) {
          const acquired = product.formattedAcquiredQuantities || "-";
          line += ` | acquis ${acquired}`;
          if (hasMissing) {
            const missing = product.formattedMissingQuantities || "-";
            line += ` | manque ${missing}`;
          }
        }
        lines.push(line);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
